import { useEffect, useRef, useCallback } from 'react'
import { useEditor } from '../useEditorStore'
import type { TextOverlay } from '../types'

function lerpKeyframe(overlay: TextOverlay, playhead: number): { x: number; y: number } {
  const kfs = overlay.keyframes
  if (kfs.length === 0) return { x: overlay.x, y: overlay.y }

  const localTime = playhead - overlay.startTime
  if (localTime <= kfs[0].time) return { x: kfs[0].x, y: kfs[0].y }
  if (localTime >= kfs[kfs.length - 1].time) return { x: kfs[kfs.length - 1].x, y: kfs[kfs.length - 1].y }

  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]; const b = kfs[i + 1]
    if (localTime >= a.time && localTime <= b.time) {
      const t = (localTime - a.time) / (b.time - a.time)
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
  }
  return { x: overlay.x, y: overlay.y }
}

function getFadeGain(localTime: number, duration: number, fadeIn: number, fadeOut: number) {
  let gain = 1

  if (fadeIn > 0) {
    gain = Math.min(gain, Math.max(0, Math.min(1, localTime / fadeIn)))
  }

  if (fadeOut > 0) {
    const timeToEnd = duration - localTime
    gain = Math.min(gain, Math.max(0, Math.min(1, timeToEnd / fadeOut)))
  }

  return gain
}

export default function Preview() {
  const { state, dispatch } = useEditor()
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const playheadRef = useRef<number>(state.playhead)
  const playingRef = useRef<boolean>(state.playing)
  const durationRef = useRef<number>(state.duration)

  useEffect(() => {
    playheadRef.current = state.playhead
  }, [state.playhead])

  useEffect(() => {
    playingRef.current = state.playing
  }, [state.playing])

  useEffect(() => {
    durationRef.current = state.duration
  }, [state.duration])

  // Keep all active clips' video elements in sync with playhead
  const syncMedia = useCallback(() => {
    const { playhead, videoClips, audioClips, mediaLibrary, tracks, playing } = state
    const trackMuted = (trackId: string) => tracks.find(t => t.id === trackId)?.muted ?? false

    const topActiveVideo = videoClips
      .filter(clip => {
        const clipLocal = playhead - clip.startTime
        return clipLocal >= 0 && clipLocal < clip.duration && !trackMuted(clip.trackId)
      })
      .sort((a, b) => b.zIndex - a.zIndex)[0]

    videoClips.forEach(clip => {
      const media = mediaLibrary.find(m => m.id === clip.mediaId)
      if (!media || media.type !== 'video') return
      const vid = videoRefs.current.get(clip.id)
      if (!vid) return

      const clipLocal = playhead - clip.startTime
      const isActive = clipLocal >= 0 && clipLocal < clip.duration && !trackMuted(clip.trackId)
      vid.style.display = isActive ? 'block' : 'none'

      if (!isActive) {
        vid.pause()
        return
      }

      if (isActive) {
        const sourceTime = clip.trimStart + clipLocal * clip.speed
        if (Math.abs(vid.currentTime - sourceTime) > (playing ? 0.25 : 0.04)) {
          vid.currentTime = sourceTime
        }
        vid.playbackRate = clip.speed

        const shouldOutputAudio = Boolean(
          playing &&
          topActiveVideo?.id === clip.id &&
          !clip.muted &&
          !trackMuted(clip.trackId)
        )

        vid.muted = !shouldOutputAudio
        const fadeGain = getFadeGain(clipLocal, clip.duration, clip.fadeIn, clip.fadeOut)
        vid.volume = Math.max(0, Math.min(1, clip.volume * fadeGain))

        if (playing) {
          void vid.play().catch(() => undefined)
        } else {
          vid.pause()
        }
      }
    })

    audioClips.forEach(clip => {
      const media = mediaLibrary.find(m => m.id === clip.mediaId)
      if (!media || (media.type !== 'audio' && media.type !== 'video')) return

      const audio = audioRefs.current.get(clip.id)
      if (!audio) return

      const clipLocal = playhead - clip.startTime
      const isActive = clipLocal >= 0 && clipLocal < clip.duration

      if (!isActive) {
        audio.pause()
        return
      }

      const sourceTime = clip.trimStart + clipLocal
      if (Math.abs(audio.currentTime - sourceTime) > (playing ? 0.2 : 0.04)) {
        audio.currentTime = sourceTime
      }

      const isMuted = clip.muted || trackMuted(clip.trackId)
      const fadeGain = getFadeGain(clipLocal, clip.duration, clip.fadeIn, clip.fadeOut)
      audio.muted = isMuted
      audio.volume = Math.max(0, Math.min(1, clip.volume * fadeGain))

      if (playing && !isMuted && audio.volume > 0) {
        void audio.play().catch(() => undefined)
      } else {
        audio.pause()
      }
    })
  }, [state])

  // Playback loop
  useEffect(() => {
    if (!state.playing) {
      cancelAnimationFrame(animRef.current)
      lastTimeRef.current = 0
      return
    }

    const tick = (now: number) => {
      if (!playingRef.current) return

      const delta = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0
      lastTimeRef.current = now

      const next = Math.min(playheadRef.current + delta, durationRef.current)
      playheadRef.current = next
      dispatch({ type: 'SET_PLAYHEAD', time: next })

      if (next >= durationRef.current) {
        dispatch({ type: 'SET_PLAYING', playing: false })
        return
      }

      animRef.current = requestAnimationFrame(tick)
    }

    lastTimeRef.current = 0
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [state.playing, dispatch])

  useEffect(() => {
    syncMedia()
  }, [syncMedia, state.playhead, state.playing])

  const togglePlay = () => {
    dispatch({ type: 'SET_PLAYING', playing: !state.playing })
  }

  const jumpToStart = () => dispatch({ type: 'SET_PLAYHEAD', time: 0 })
  const jumpToEnd = () => dispatch({ type: 'SET_PLAYHEAD', time: state.duration })
  const stepBack = () => dispatch({ type: 'SET_PLAYHEAD', time: Math.max(0, state.playhead - 0.033) })
  const stepForward = () => dispatch({ type: 'SET_PLAYHEAD', time: Math.min(state.duration, state.playhead + 0.033) })

  const activeTextOverlays = state.textOverlays.filter(o => {
    const isTrackMuted = state.tracks.find(t => t.id === o.trackId)?.muted ?? false
    if (isTrackMuted) return false
    const local = state.playhead - o.startTime
    return local >= 0 && local < o.duration
  })

  return (
    <section className="preview-section">
      <div className="preview-canvas">
        {state.videoClips.length === 0 && state.textOverlays.length === 0 && (
          <div className="preview-empty">Add clips to the timeline to see a preview</div>
        )}

        {/* Render all video elements - hide inactive ones */}
        {state.videoClips.map(clip => {
          const media = state.mediaLibrary.find(m => m.id === clip.mediaId)
          const isTrackMuted = state.tracks.find(t => t.id === clip.trackId)?.muted ?? false
          if (!media || (media.type !== 'video' && media.type !== 'image')) return null
          const filters = [clip.grayscale ? 'grayscale(1)' : ''].filter(Boolean).join(' ')
          const transform = [
            `rotate(${clip.rotation}deg)`,
            clip.flipH ? 'scaleX(-1)' : '',
            clip.flipV ? 'scaleY(-1)' : '',
          ].filter(Boolean).join(' ')
          const local = state.playhead - clip.startTime
          const isActive = local >= 0 && local < clip.duration && !isTrackMuted

          if (media.type === 'image') {
            return (
              <img
                key={clip.id}
                src={media.url}
                alt={media.name}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'contain', filter: filters, transform,
                  opacity: clip.opacity, display: isActive ? 'block' : 'none',
                }}
              />
            )
          }

          return (
            <video
              key={clip.id}
              ref={el => {
                if (el) videoRefs.current.set(clip.id, el)
                else videoRefs.current.delete(clip.id)
              }}
              src={media.url}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'contain', filter: filters, transform,
                opacity: clip.opacity, display: isActive ? 'block' : 'none',
              }}
              playsInline
              muted
            />
          )
        })}

        {state.audioClips.map(clip => {
          const media = state.mediaLibrary.find(m => m.id === clip.mediaId)
          const isTrackMuted = state.tracks.find(t => t.id === clip.trackId)?.muted ?? false
          if (!media || (media.type !== 'audio' && media.type !== 'video')) return null
          if (isTrackMuted) return null

          return (
            <audio
              key={clip.id}
              ref={el => {
                if (el) audioRefs.current.set(clip.id, el)
                else audioRefs.current.delete(clip.id)
              }}
              src={media.url}
              preload="auto"
              muted
            />
          )
        })}

        {/* Text overlays */}
        {activeTextOverlays.map(overlay => {
          const pos = lerpKeyframe(overlay, state.playhead)
          return (
            <div
              key={overlay.id}
              className="text-overlay-el"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                fontSize: overlay.fontSize,
                color: overlay.color,
                fontFamily: overlay.fontFamily,
                fontWeight: overlay.bold ? 700 : 400,
                fontStyle: overlay.italic ? 'italic' : 'normal',
                background: overlay.bgOpacity > 0
                  ? `${overlay.bgColor}${Math.round(overlay.bgOpacity * 255).toString(16).padStart(2, '0')}`
                  : 'transparent',
                padding: overlay.bgOpacity > 0 ? '4px 8px' : 0,
              }}
              onClick={() => dispatch({ type: 'SELECT', id: overlay.id, selType: 'text' })}
            >
              {overlay.text}
            </div>
          )
        })}
      </div>

      <div className="preview-controls">
        <button className="ctrl-btn" onClick={jumpToStart} title="Jump to start">⏮</button>
        <button className="ctrl-btn" onClick={stepBack} title="Step one frame back">⏪</button>
        <button className="ctrl-btn play-pause" onClick={togglePlay} title="Play/Pause">
          {state.playing ? '⏸' : '▶'}
        </button>
        <button className="ctrl-btn" onClick={stepForward} title="Step one frame forward">⏩</button>
        <button className="ctrl-btn" onClick={jumpToEnd} title="Jump to end">⏭</button>
        <span className="timecode">
          {formatTimecode(state.playhead)} / {formatTimecode(state.duration)}
        </span>
      </div>
    </section>
  )
}

function formatTimecode(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 100)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}
