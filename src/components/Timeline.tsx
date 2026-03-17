import { useRef, useCallback, useState } from 'react'
import { useEditor } from '../useEditorStore'
import type { VideoClip, AudioClip, TextOverlay, Track } from '../types'

function formatTime(s: number) {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Build ruler ticks based on zoom level
function buildTicks(duration: number, zoom: number) {
  const total = duration * zoom
  let step = 1
  if (zoom < 30) step = 10
  else if (zoom < 60) step = 5
  else if (zoom < 120) step = 2

  const ticks: { time: number; x: number; major: boolean }[] = []
  for (let t = 0; t <= duration; t += step) {
    ticks.push({ time: t, x: t * zoom, major: true })
  }
  // Minor ticks at half-step
  if (step > 1) {
    const minor = step / 2
    for (let t = minor; t <= duration; t += step) {
      ticks.push({ time: t, x: t * zoom, major: false })
    }
  }
  return { ticks, total }
}

export default function Timeline() {
  const { state, dispatch, addClipToTrack, addAudioToTrack, addTextToTrack } = useEditor()
  const tlScrollRef = useRef<HTMLDivElement>(null)
  const labelsBodyRef = useRef<HTMLDivElement>(null)
  const dropHintRef = useRef<{ targetId: string; position: 'before' | 'after' } | null>(null)
  const [dropHint, setDropHint] = useState<{ targetId: string; position: 'before' | 'after' } | null>(null)
  const dragRef = useRef<{
    clipId: string; type: 'video' | 'audio' | 'text'
    offsetX: number; origStart: number; origTrackId: string; origScrollLeft: number
  } | null>(null)

  const { zoom, duration, playhead, tracks, videoClips, audioClips, textOverlays, snapEnabled } = state
  const { ticks, total } = buildTicks(duration, zoom)
  const timelineWidth = Math.max(total, 400)

  const snapThreshold = Math.max(0.02, 12 / zoom)

  const getSnapPoints = useCallback((excludeId?: string) => {
    const points = [0, playhead]

    for (const clip of videoClips) {
      if (clip.id === excludeId) continue
      points.push(clip.startTime, clip.startTime + clip.duration)
    }
    for (const clip of audioClips) {
      if (clip.id === excludeId) continue
      points.push(clip.startTime, clip.startTime + clip.duration)
    }
    for (const overlay of textOverlays) {
      if (overlay.id === excludeId) continue
      points.push(overlay.startTime, overlay.startTime + overlay.duration)
    }

    return points
  }, [playhead, videoClips, audioClips, textOverlays])

  const snapTime = useCallback((rawTime: number, excludeId?: string) => {
    if (!snapEnabled) return rawTime

    const points = getSnapPoints(excludeId)
    let nearest = rawTime
    let bestDistance = Number.POSITIVE_INFINITY

    for (const point of points) {
      const distance = Math.abs(point - rawTime)
      if (distance < bestDistance) {
        bestDistance = distance
        nearest = point
      }
    }

    return bestDistance <= snapThreshold ? nearest : rawTime
  }, [snapEnabled, getSnapPoints, snapThreshold])

  const autoScrollTimeline = useCallback((clientX: number) => {
    const scroller = tlScrollRef.current
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    const threshold = 48
    const speed = 18

    if (clientX > rect.right - threshold) {
      scroller.scrollLeft += speed
    } else if (clientX < rect.left + threshold) {
      scroller.scrollLeft -= speed
    }
  }, [])

  const autoScrollLabels = useCallback((clientY: number) => {
    const labels = labelsBodyRef.current
    if (!labels) return
    const rect = labels.getBoundingClientRect()
    const threshold = 38
    const speed = 14

    if (clientY > rect.bottom - threshold) {
      labels.scrollTop += speed
    } else if (clientY < rect.top + threshold) {
      labels.scrollTop -= speed
    }
  }, [])

  // --- Playhead drag on ruler ---
  const handleRulerMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    dispatch({ type: 'SET_PLAYHEAD', time: x / zoom })

    const onMove = (me: MouseEvent) => {
      const nx = me.clientX - rect.left
      dispatch({ type: 'SET_PLAYHEAD', time: Math.max(0, nx / zoom) })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, dispatch])

  // --- Clip drag ---
  const startClipDrag = useCallback((
    e: React.MouseEvent,
    clipId: string,
    type: 'video' | 'audio' | 'text',
    startTime: number,
    trackId: string,
  ) => {
    e.stopPropagation()
    const startX = e.clientX
    dragRef.current = {
      clipId,
      type,
      offsetX: startX,
      origStart: startTime,
      origTrackId: trackId,
      origScrollLeft: tlScrollRef.current?.scrollLeft ?? 0,
    }
    dispatch({ type: 'SELECT', id: clipId, selType: type === 'text' ? 'text' : type === 'audio' ? 'audio' : 'clip' })

    const onMove = (me: MouseEvent) => {
      const dr = dragRef.current
      if (!dr) return
      autoScrollTimeline(me.clientX)
      const scrollDelta = (tlScrollRef.current?.scrollLeft ?? 0) - dr.origScrollLeft
      const dx = me.clientX - dr.offsetX + scrollDelta
      const rawStart = Math.max(0, dr.origStart + dx / zoom)
      const newStart = Math.max(0, snapTime(rawStart, dr.clipId))

      const hoveredElement = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null
      const hoveredTrack = hoveredElement?.closest('.tl-track') as HTMLElement | null
      const hoveredTrackId = hoveredTrack?.dataset.trackId ?? dr.origTrackId
      const hoveredTrackType = hoveredTrack?.dataset.trackType as 'video' | 'audio' | 'text' | undefined
      const nextTrackId = hoveredTrackType === dr.type ? hoveredTrackId : dr.origTrackId

      if (dr.type === 'video') {
        dispatch({ type: 'UPDATE_VIDEO_CLIP', id: dr.clipId, patch: { startTime: newStart, trackId: nextTrackId } })
      } else if (dr.type === 'audio') {
        dispatch({ type: 'UPDATE_AUDIO_CLIP', id: dr.clipId, patch: { startTime: newStart, trackId: nextTrackId } })
      } else {
        dispatch({ type: 'UPDATE_TEXT_OVERLAY', id: dr.clipId, patch: { startTime: newStart, trackId: nextTrackId } })
      }
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, dispatch, autoScrollTimeline, snapTime])

  // --- Right-edge trim ---
  const startTrimRight = useCallback((
    e: React.MouseEvent,
    clip: VideoClip | AudioClip | TextOverlay,
    clipId: string,
    type: 'video' | 'audio' | 'text',
    currentDuration: number,
  ) => {
    e.stopPropagation()
    const startX = e.clientX
    const baseDuration = currentDuration
    const baseScrollLeft = tlScrollRef.current?.scrollLeft ?? 0
    const baseStart = clip.startTime

    const onMove = (me: MouseEvent) => {
      autoScrollTimeline(me.clientX)
      const dx = me.clientX - startX + ((tlScrollRef.current?.scrollLeft ?? 0) - baseScrollLeft)
      const rawDur = Math.max(0.1, baseDuration + dx / zoom)
      const rawEnd = baseStart + rawDur
      const snappedEnd = snapTime(rawEnd, clipId)
      const newDur = Math.max(0.1, snappedEnd - baseStart)

      if (type === 'video') {
        const videoClip = clip as VideoClip
        dispatch({
          type: 'UPDATE_VIDEO_CLIP',
          id: clipId,
          patch: {
            duration: newDur,
            trimEnd: videoClip.trimStart + newDur * videoClip.speed,
          },
        })
      } else if (type === 'audio') {
        const audioClip = clip as AudioClip
        dispatch({
          type: 'UPDATE_AUDIO_CLIP',
          id: clipId,
          patch: {
            duration: newDur,
            trimEnd: audioClip.trimStart + newDur,
          },
        })
      } else {
        dispatch({ type: 'UPDATE_TEXT_OVERLAY', id: clipId, patch: { duration: newDur } })
      }
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, dispatch, autoScrollTimeline, snapTime])

  const startTrimLeft = useCallback((
    e: React.MouseEvent,
    clip: VideoClip | AudioClip | TextOverlay,
    clipId: string,
    type: 'video' | 'audio' | 'text',
    currentStart: number,
    currentDuration: number,
  ) => {
    e.stopPropagation()
    const startX = e.clientX
    const baseStart = currentStart
    const baseDuration = currentDuration
    const baseScrollLeft = tlScrollRef.current?.scrollLeft ?? 0

    const onMove = (me: MouseEvent) => {
      autoScrollTimeline(me.clientX)
      const dx = me.clientX - startX + ((tlScrollRef.current?.scrollLeft ?? 0) - baseScrollLeft)
      const delta = dx / zoom
      const maxDelta = baseDuration - 0.1
      const clampedDelta = Math.max(-baseStart, Math.min(delta, maxDelta))

      const rawStart = baseStart + clampedDelta
      const snappedStart = Math.max(0, snapTime(rawStart, clipId))
      const nextDelta = snappedStart - baseStart
      const nextStart = snappedStart
      const nextDuration = Math.max(0.1, baseDuration - nextDelta)

      if (type === 'video') {
        const videoClip = clip as VideoClip
        dispatch({
          type: 'UPDATE_VIDEO_CLIP',
          id: clipId,
          patch: {
            startTime: nextStart,
            duration: nextDuration,
            trimStart: Math.max(0, videoClip.trimStart + nextDelta * videoClip.speed),
          },
        })
      } else if (type === 'audio') {
        const audioClip = clip as AudioClip
        dispatch({
          type: 'UPDATE_AUDIO_CLIP',
          id: clipId,
          patch: {
            startTime: nextStart,
            duration: nextDuration,
            trimStart: Math.max(0, audioClip.trimStart + nextDelta),
          },
        })
      } else {
        dispatch({ type: 'UPDATE_TEXT_OVERLAY', id: clipId, patch: { startTime: nextStart, duration: nextDuration } })
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, dispatch, autoScrollTimeline, snapTime])

  const startTrackReorder = useCallback((
    e: React.MouseEvent,
    trackId: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const onMove = (me: MouseEvent) => {
      autoScrollLabels(me.clientY)
      const hovered = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null
      const label = hovered?.closest('.tl-label') as HTMLElement | null
      if (!label) {
        dropHintRef.current = null
        setDropHint(null)
        return
      }

      const targetId = label.dataset.trackId
      if (!targetId) return

      const rect = label.getBoundingClientRect()
      const position: 'before' | 'after' = me.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
      const nextHint = { targetId, position }
      dropHintRef.current = nextHint
      setDropHint(nextHint)
    }

    const onUp = () => {
      const hint = dropHintRef.current
      if (hint && hint.targetId !== trackId) {
        dispatch({ type: 'MOVE_TRACK_RELATIVE', id: trackId, targetId: hint.targetId, position: hint.position })
      }

      dropHintRef.current = null
      setDropHint(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [dispatch, autoScrollLabels])

  const fitZoomToProject = useCallback(() => {
    const scroller = tlScrollRef.current
    if (!scroller) return
    const usableWidth = Math.max(120, scroller.clientWidth - 24)
    const fitZoom = usableWidth / Math.max(state.duration, 1)
    dispatch({ type: 'SET_ZOOM', zoom: fitZoom })
  }, [dispatch, state.duration])

  // --- Drop from media library ---
  const handleTrackDrop = useCallback((e: React.DragEvent, track: Track) => {
    e.preventDefault()
    const mediaId = e.dataTransfer.getData('mediaId')
    if (!mediaId) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const dropTime = Math.max(0, snapTime(x / zoom))

    if (track.type === 'video') addClipToTrack(mediaId, track.id, dropTime)
    else if (track.type === 'audio') addAudioToTrack(mediaId, track.id, dropTime)
    else if (track.type === 'text') addTextToTrack(track.id, dropTime)
  }, [zoom, addClipToTrack, addAudioToTrack, addTextToTrack, snapTime])

  // Add a new track
  const addTrack = (type: Track['type']) => {
    const count = tracks.filter(t => t.type === type).length + 1
    const names: Record<Track['type'], string> = { video: 'Video', audio: 'Audio', text: 'Text' }
    dispatch({ type: 'ADD_TRACK', track: { type, name: `${names[type]} ${count}`, muted: false, locked: false, height: type === 'text' ? 40 : type === 'audio' ? 48 : 64 } })
  }

  // Split clip at playhead
  const splitAtPlayhead = () => {
    const clip = videoClips.find(c => playhead > c.startTime && playhead < c.startTime + c.duration)
    if (clip) dispatch({ type: 'SPLIT_CLIP', id: clip.id, at: playhead })
  }

  const clipsForTrack = (trackId: string, type: Track['type']) => {
    if (type === 'video') return videoClips.filter(c => c.trackId === trackId)
    if (type === 'audio') return audioClips.filter(c => c.trackId === trackId)
    return textOverlays.filter(o => o.trackId === trackId)
  }

  const clipColor = (type: Track['type']) => {
    if (type === 'video') return 'var(--clip-video)'
    if (type === 'audio') return 'var(--clip-audio)'
    return 'var(--clip-text)'
  }

  const trackMeta = (track: Track) => {
    const clips = clipsForTrack(track.id, track.type)
    const count = clips.length
    const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0)
    return `${count} clips · ${formatTime(totalDuration)}`
  }

  return (
    <div className="timeline">
      {/* Timeline toolbar */}
      <div className="tl-toolbar">
        <button className="tl-tool" onClick={splitAtPlayhead} title="Split clip at playhead (S)">✂ Split</button>
        <div className="tl-sep" />
        <button className="tl-tool" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom * 1.25 })} title="Zoom in">+</button>
        <button className="tl-tool" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: zoom * 0.65 })} title="Zoom out">−</button>
        <button className="tl-tool" onClick={fitZoomToProject} title="Fit full project width">Fit</button>
        <button
          className={`tl-tool${snapEnabled ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_SNAP', enabled: !snapEnabled })}
          title="Toggle snapping"
        >
          Snap
        </button>
        <span className="tl-zoom-label">{Math.round(zoom)}px/s</span>
        <div className="tl-sep" />
        <button className="tl-new-track" onClick={() => addTrack('video')}>+ Video track</button>
        <button className="tl-new-track" onClick={() => addTrack('audio')}>+ Audio track</button>
        <button className="tl-new-track" onClick={() => addTrack('text')}>+ Text track</button>
      </div>

      {/* Scrollable timeline body */}
      <div className="tl-body">
        {/* Track labels column (fixed) */}
        <div className="tl-labels">
          <div className="tl-ruler-label" />
          <div className="tl-labels-body" ref={labelsBodyRef}>
            {tracks.map(track => (
              <div
                key={track.id}
                className={`tl-label track-type-${track.type}${dropHint?.targetId === track.id ? (dropHint.position === 'before' ? ' drop-before' : ' drop-after') : ''}`}
                style={{ height: track.height }}
                data-track-id={track.id}
                data-track-type={track.type}
              >
                <div className="tl-track-text">
                  <span className="tl-track-name">{track.name}</span>
                  <span className="tl-track-meta">{trackMeta(track)}</span>
                </div>
                <div className="tl-track-actions">
                  <button
                    className="tl-grab"
                    title="Drag to reorder track"
                    onMouseDown={(e) => startTrackReorder(e, track.id)}
                  >⋮⋮</button>
                  <button
                    className={`tl-mute${track.muted ? ' on' : ''}`}
                    title="Mute"
                    onClick={() => dispatch({ type: 'UPDATE_TRACK', id: track.id, patch: { muted: !track.muted } })}
                  >M</button>
                  <button
                    className="tl-del-track"
                    title="Delete track"
                    onClick={() => dispatch({ type: 'DELETE_TRACK', id: track.id })}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable track + ruler area */}
        <div className="tl-scroll-area" ref={tlScrollRef} onScroll={e => {
          const target = e.currentTarget
          if (labelsBodyRef.current) {
            labelsBodyRef.current.scrollTop = target.scrollTop
          }
        }}>
          {/* Ruler */}
          <div
            className="tl-ruler"
            style={{ width: timelineWidth }}
            onMouseDown={handleRulerMouseDown}
          >
            {ticks.map(tick => (
              <div
                key={tick.time}
                className={`tl-tick${tick.major ? ' major' : ''}`}
                style={{ left: tick.x }}
              >
                {tick.major && <span className="tl-tick-label">{formatTime(tick.time)}</span>}
              </div>
            ))}
            {/* Playhead on ruler */}
            <div className="tl-playhead-head" style={{ left: playhead * zoom }} />
          </div>

          {/* Track rows */}
          <div className="tl-tracks" style={{ width: timelineWidth }}>
            {/* Vertical playhead line */}
            <div className="tl-playhead-line" style={{ left: playhead * zoom, height: '100%' }} />

            {tracks.map(track => {
              const clips = clipsForTrack(track.id, track.type)
              const color = clipColor(track.type)
              return (
                <div
                  key={track.id}
                  className={`tl-track track-type-${track.type}`}
                  style={{ height: track.height }}
                  data-track-id={track.id}
                  data-track-type={track.type}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleTrackDrop(e, track)}
                  onClick={e => {
                    // Click empty space = add text or deselect
                    if ((e.target as HTMLElement).classList.contains('tl-track')) {
                      dispatch({ type: 'SELECT', id: null, selType: null })
                    }
                  }}
                >
                  {(clips as (VideoClip | AudioClip | TextOverlay)[]).map((clip) => {
                    const clipType = track.type
                    const id = clip.id
                    const start = clip.startTime
                    const dur = clip.duration
                    const isSelected = state.selectedId === id
                    const isTrackMuted = track.muted
                    const media = 'mediaId' in clip ? state.mediaLibrary.find(m => m.id === clip.mediaId) : null
                    const label = 'text' in clip ? clip.text : media?.name ?? 'Klip'
                    const showVideoFrame = clipType === 'video' && Boolean(media?.thumbnail)
                    const audioLevels = clipType === 'audio' ? media?.audioLevels : undefined

                    return (
                      <div
                        key={id}
                        className={`tl-clip${isSelected ? ' selected' : ''}`}
                        style={{
                          left: start * zoom,
                          width: Math.max(dur * zoom, 8),
                          background: color,
                          opacity: isTrackMuted ? 0.45 : 1,
                          height: '100%',
                        }}
                        onMouseDown={e => startClipDrag(e, id, clipType, start, track.id)}
                        onDoubleClick={() => {
                          if (clipType === 'video') dispatch({ type: 'SPLIT_CLIP', id, at: playhead })
                        }}
                        title={label}
                      >
                        {showVideoFrame && (
                          <img className="clip-thumb" src={media?.thumbnail} alt="" />
                        )}
                        {audioLevels && audioLevels.length > 0 && (
                          <div className="clip-waveform">
                            {audioLevels.map((level, idx) => (
                              <span
                                key={`${id}-wf-${idx}`}
                                className="wf-bar"
                                style={{ height: `${Math.max(8, Math.round(level * 100))}%` }}
                              />
                            ))}
                          </div>
                        )}
                        <span className="clip-label">{label}</span>
                        <span className="clip-duration">{formatTime(dur)}</span>
                        <div
                          className="trim-handle trim-handle-left"
                          onMouseDown={e => startTrimLeft(e, clip, id, clipType, start, dur)}
                        />
                        {/* Right trim handle */}
                        <div
                          className="trim-handle trim-handle-right"
                          onMouseDown={e => startTrimRight(e, clip, id, clipType, dur)}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
