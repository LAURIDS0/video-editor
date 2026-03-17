import { createContext, useContext, useReducer, useCallback } from 'react'
import type { ReactNode } from 'react'
import type {
  EditorState, Track, VideoClip, AudioClip, TextOverlay, MediaItem
} from './types'

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

const defaultTracks: Track[] = [
  { id: 'v1', type: 'video', name: 'Video 1', muted: false, locked: false, height: 64 },
  { id: 'v2', type: 'video', name: 'Video 2', muted: false, locked: false, height: 64 },
  { id: 'a1', type: 'audio', name: 'Audio 1', muted: false, locked: false, height: 48 },
  { id: 'a2', type: 'audio', name: 'Audio 2', muted: false, locked: false, height: 48 },
  { id: 't1', type: 'text', name: 'Text 1', muted: false, locked: false, height: 40 },
  { id: 't2', type: 'text', name: 'Text 2', muted: false, locked: false, height: 40 },
]

const initialState: EditorState = {
  tracks: defaultTracks,
  videoClips: [],
  audioClips: [],
  textOverlays: [],
  mediaLibrary: [],
  playhead: 0,
  playing: false,
  duration: 60,
  zoom: 80,
  selectedId: null,
  selectedType: null,
  snapEnabled: true,
}

type Action =
  | { type: 'ADD_MEDIA'; media: MediaItem }
  | { type: 'ADD_VIDEO_CLIP'; clip: Omit<VideoClip, 'id'> }
  | { type: 'ADD_AUDIO_CLIP'; clip: Omit<AudioClip, 'id'> }
  | { type: 'ADD_TEXT_OVERLAY'; overlay: Omit<TextOverlay, 'id'> }
  | { type: 'UPDATE_VIDEO_CLIP'; id: string; patch: Partial<VideoClip> }
  | { type: 'UPDATE_AUDIO_CLIP'; id: string; patch: Partial<AudioClip> }
  | { type: 'UPDATE_TEXT_OVERLAY'; id: string; patch: Partial<TextOverlay> }
  | { type: 'DELETE_CLIP'; id: string }
  | { type: 'ADD_KEYFRAME'; overlayId: string; keyframe: { time: number; x: number; y: number } }
  | { type: 'DELETE_KEYFRAME'; overlayId: string; time: number }
  | { type: 'SET_PLAYHEAD'; time: number }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_SNAP'; enabled: boolean }
  | { type: 'SELECT'; id: string | null; selType: EditorState['selectedType'] }
  | { type: 'ADD_TRACK'; track: Omit<Track, 'id'> }
  | { type: 'UPDATE_TRACK'; id: string; patch: Partial<Track> }
  | { type: 'MOVE_TRACK_RELATIVE'; id: string; targetId: string; position: 'before' | 'after' }
  | { type: 'MOVE_TRACK_TO'; id: string; targetId: string }
  | { type: 'MOVE_TRACK'; id: string; direction: -1 | 1 }
  | { type: 'DELETE_TRACK'; id: string }
  | { type: 'SPLIT_CLIP'; id: string; at: number }

function calcDuration(state: EditorState): number {
  const ends = [
    ...state.videoClips.map(c => c.startTime + c.duration),
    ...state.audioClips.map(c => c.startTime + c.duration),
    ...state.textOverlays.map(o => o.startTime + o.duration),
    60,
  ]
  return Math.max(...ends)
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'ADD_MEDIA':
      return { ...state, mediaLibrary: [...state.mediaLibrary, action.media] }

    case 'ADD_VIDEO_CLIP': {
      const clip: VideoClip = { ...action.clip, id: generateId() }
      const next = { ...state, videoClips: [...state.videoClips, clip] }
      return { ...next, duration: calcDuration(next) }
    }

    case 'ADD_AUDIO_CLIP': {
      const clip: AudioClip = { ...action.clip, id: generateId() }
      const next = { ...state, audioClips: [...state.audioClips, clip] }
      return { ...next, duration: calcDuration(next) }
    }

    case 'ADD_TEXT_OVERLAY': {
      const overlay: TextOverlay = { ...action.overlay, id: generateId() }
      const next = { ...state, textOverlays: [...state.textOverlays, overlay] }
      return { ...next, duration: calcDuration(next) }
    }

    case 'UPDATE_VIDEO_CLIP': {
      const next = {
        ...state,
        videoClips: state.videoClips.map(c =>
          c.id === action.id ? { ...c, ...action.patch } : c
        ),
      }
      return { ...next, duration: calcDuration(next) }
    }

    case 'UPDATE_AUDIO_CLIP': {
      const next = {
        ...state,
        audioClips: state.audioClips.map(c =>
          c.id === action.id ? { ...c, ...action.patch } : c
        ),
      }
      return { ...next, duration: calcDuration(next) }
    }

    case 'UPDATE_TEXT_OVERLAY':
      return {
        ...state,
        textOverlays: state.textOverlays.map(o =>
          o.id === action.id ? { ...o, ...action.patch } : o
        ),
      }

    case 'DELETE_CLIP': {
      const next = {
        ...state,
        videoClips: state.videoClips.filter(c => c.id !== action.id),
        audioClips: state.audioClips.filter(c => c.id !== action.id),
        textOverlays: state.textOverlays.filter(o => o.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        selectedType: state.selectedId === action.id ? null : state.selectedType,
      }
      return { ...next, duration: calcDuration(next) }
    }

    case 'ADD_KEYFRAME':
      return {
        ...state,
        textOverlays: state.textOverlays.map(o =>
          o.id === action.overlayId
            ? {
                ...o,
                keyframes: [
                  ...o.keyframes.filter(k => k.time !== action.keyframe.time),
                  action.keyframe,
                ].sort((a, b) => a.time - b.time),
              }
            : o
        ),
      }

    case 'DELETE_KEYFRAME':
      return {
        ...state,
        textOverlays: state.textOverlays.map(o =>
          o.id === action.overlayId
            ? { ...o, keyframes: o.keyframes.filter(k => k.time !== action.time) }
            : o
        ),
      }

    case 'SET_PLAYHEAD':
      return { ...state, playhead: Math.max(0, Math.min(action.time, state.duration)) }

    case 'SET_PLAYING':
      return { ...state, playing: action.playing }

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(1, Math.min(500, action.zoom)) }

    case 'SET_SNAP':
      return { ...state, snapEnabled: action.enabled }

    case 'SELECT':
      return { ...state, selectedId: action.id, selectedType: action.selType }

    case 'ADD_TRACK': {
      const track: Track = { ...action.track, id: generateId() }
      return { ...state, tracks: [...state.tracks, track] }
    }

    case 'UPDATE_TRACK':
      return {
        ...state,
        tracks: state.tracks.map(t => t.id === action.id ? { ...t, ...action.patch } : t),
      }

    case 'MOVE_TRACK_RELATIVE': {
      const fromIndex = state.tracks.findIndex(t => t.id === action.id)
      const toIndex = state.tracks.findIndex(t => t.id === action.targetId)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return state

      const next = [...state.tracks]
      const [moved] = next.splice(fromIndex, 1)

      let insertAt = toIndex
      if (fromIndex < toIndex) {
        insertAt -= 1
      }
      if (action.position === 'after') {
        insertAt += 1
      }

      insertAt = Math.max(0, Math.min(insertAt, next.length))
      next.splice(insertAt, 0, moved)
      return { ...state, tracks: next }
    }

    case 'MOVE_TRACK_TO': {
      const fromIndex = state.tracks.findIndex(t => t.id === action.id)
      const toIndex = state.tracks.findIndex(t => t.id === action.targetId)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return state

      const source = state.tracks[fromIndex]
      const target = state.tracks[toIndex]
      if (source.type !== target.type) return state

      const next = [...state.tracks]
      next[fromIndex] = target
      next[toIndex] = source
      return { ...state, tracks: next }
    }

    case 'MOVE_TRACK': {
      const currentIndex = state.tracks.findIndex(t => t.id === action.id)
      if (currentIndex < 0) return state

      const movingTrack = state.tracks[currentIndex]
      const candidateIndex = currentIndex + action.direction
      if (candidateIndex < 0 || candidateIndex >= state.tracks.length) return state

      const candidateTrack = state.tracks[candidateIndex]
      if (candidateTrack.type !== movingTrack.type) return state

      const nextTracks = [...state.tracks]
      nextTracks[currentIndex] = candidateTrack
      nextTracks[candidateIndex] = movingTrack

      return { ...state, tracks: nextTracks }
    }

    case 'DELETE_TRACK': {
      const next = {
        ...state,
        tracks: state.tracks.filter(t => t.id !== action.id),
        videoClips: state.videoClips.filter(c => c.trackId !== action.id),
        audioClips: state.audioClips.filter(c => c.trackId !== action.id),
        textOverlays: state.textOverlays.filter(o => o.trackId !== action.id),
      }
      return { ...next, duration: calcDuration(next) }
    }

    case 'SPLIT_CLIP': {
      const clip = state.videoClips.find(c => c.id === action.id)
      if (!clip) return state
      const localAt = action.at - clip.startTime
      if (localAt <= 0 || localAt >= clip.duration) return state
      const ratio = localAt / clip.duration
      const trimMid = clip.trimStart + (clip.trimEnd - clip.trimStart) * ratio
      const a: VideoClip = { ...clip, duration: localAt, trimEnd: trimMid }
      const b: VideoClip = { ...clip, id: generateId(), startTime: action.at, duration: clip.duration - localAt, trimStart: trimMid }
      return {
        ...state,
        videoClips: [...state.videoClips.filter(c => c.id !== action.id), a, b],
      }
    }
  }
}

interface ContextValue {
  state: EditorState
  dispatch: React.Dispatch<Action>
  addMedia: (file: File) => Promise<void>
  addClipToTrack: (mediaId: string, trackId: string, startTime: number) => void
  addAudioToTrack: (mediaId: string, trackId: string, startTime: number) => void
  addTextToTrack: (trackId: string, startTime: number) => void
}

const EditorContext = createContext<ContextValue>(null!)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const addMedia = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file)
    const type = file.type.startsWith('audio') ? 'audio'
      : file.type.startsWith('image') ? 'image' : 'video'

    let duration = 5
    let width: number | undefined
    let height: number | undefined
    let thumbnail: string | undefined
    let audioLevels: number[] | undefined

    const createAudioLevels = async (sourceFile: File) => {
      try {
        const arrayBuffer = await sourceFile.arrayBuffer()
        const audioContext = new AudioContext()
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
        const data = decoded.getChannelData(0)
        const points = 56
        const block = Math.max(1, Math.floor(data.length / points))
        const levels: number[] = []

        for (let i = 0; i < points; i++) {
          const start = i * block
          const end = Math.min(start + block, data.length)
          let peak = 0
          for (let j = start; j < end; j++) {
            const value = Math.abs(data[j])
            if (value > peak) peak = value
          }
          levels.push(Math.min(1, Math.max(0.05, peak)))
        }

        await audioContext.close()
        return levels
      } catch {
        return undefined
      }
    }

    const createVideoThumbnail = async (src: string) => {
      return new Promise<string | undefined>((resolve) => {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.src = src
        video.muted = true
        video.playsInline = true

        const cleanup = () => {
          video.removeAttribute('src')
          video.load()
        }

        video.onloadedmetadata = () => {
          width = video.videoWidth
          height = video.videoHeight
          const targetTime = Math.min(0.15, Math.max(0, (video.duration || 0) / 8))
          video.currentTime = targetTime
        }

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = 240
            canvas.height = 136
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              cleanup()
              resolve(undefined)
              return
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const data = canvas.toDataURL('image/jpeg', 0.72)
            cleanup()
            resolve(data)
          } catch {
            cleanup()
            resolve(undefined)
          }
        }

        video.onerror = () => {
          cleanup()
          resolve(undefined)
        }
      })
    }

    if (type === 'video' || type === 'audio') {
      duration = await new Promise(resolve => {
        const el = type === 'video' ? document.createElement('video') : document.createElement('audio')
        el.preload = 'metadata'
        el.onloadedmetadata = () => {
          if (type === 'video' && el instanceof HTMLVideoElement) {
            width = el.videoWidth
            height = el.videoHeight
          }
          resolve(el.duration)
        }
        el.onerror = () => resolve(5)
        el.src = url
      })

      if (type === 'video') {
        thumbnail = await createVideoThumbnail(url)
      } else if (type === 'audio') {
        audioLevels = await createAudioLevels(file)
      }
    }

    if (type === 'image') {
      thumbnail = url
      await new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          width = img.naturalWidth
          height = img.naturalHeight
          resolve()
        }
        img.onerror = () => resolve()
        img.src = url
      })
    }

    const media: MediaItem = {
      id: Math.random().toString(36).slice(2, 10),
      name: file.name,
      url,
      type,
      duration,
      width,
      height,
      thumbnail,
      audioLevels,
    }
    dispatch({ type: 'ADD_MEDIA', media })
  }, [])

  const addClipToTrack = useCallback((mediaId: string, trackId: string, startTime: number) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId)
    if (!media) return
    if (media.type !== 'video' && media.type !== 'image') return

    const clipDuration = media.type === 'image' ? 5 : media.duration
    dispatch({
      type: 'ADD_VIDEO_CLIP',
      clip: {
        mediaId,
        trackId,
        startTime,
        duration: clipDuration,
        trimStart: 0,
        trimEnd: clipDuration,
        speed: 1,
        volume: 1,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
        opacity: 1,
        grayscale: false,
        rotation: 0,
        flipH: false,
        flipV: false,
        zIndex: 0,
      },
    })
  }, [state.mediaLibrary])

  const addAudioToTrack = useCallback((mediaId: string, trackId: string, startTime: number) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId)
    if (!media) return
    if (media.type !== 'audio' && media.type !== 'video') return
    dispatch({
      type: 'ADD_AUDIO_CLIP',
      clip: {
        mediaId,
        trackId,
        startTime,
        duration: media.duration,
        trimStart: 0,
        trimEnd: media.duration,
        volume: 1,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
      },
    })
  }, [state.mediaLibrary])

  const addTextToTrack = useCallback((trackId: string, startTime: number) => {
    dispatch({
      type: 'ADD_TEXT_OVERLAY',
      overlay: {
        trackId,
        text: 'Text here',
        startTime,
        duration: 5,
        x: 50,
        y: 80,
        fontSize: 36,
        color: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        bold: false,
        italic: false,
        bgColor: '#000000',
        bgOpacity: 0,
        keyframes: [],
      },
    })
  }, [])

  return (
    <EditorContext.Provider value={{ state, dispatch, addMedia, addClipToTrack, addAudioToTrack, addTextToTrack }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  return useContext(EditorContext)
}
