export type MediaType = 'video' | 'audio' | 'image'

export interface MediaItem {
  id: string
  name: string
  url: string
  type: MediaType
  duration: number
  width?: number
  height?: number
  thumbnail?: string
  audioLevels?: number[]
}

export interface Keyframe {
  time: number // seconds into clip
  x: number   // % of preview width
  y: number   // % of preview height
}

export interface TextOverlay {
  id: string
  trackId: string
  text: string
  startTime: number
  duration: number
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  bold: boolean
  italic: boolean
  bgColor: string
  bgOpacity: number
  keyframes: Keyframe[]
}

export interface VideoClip {
  id: string
  trackId: string
  mediaId: string
  startTime: number   // position on timeline (seconds)
  duration: number    // how long it appears on timeline
  trimStart: number   // where in the source we start reading (seconds)
  trimEnd: number     // where in the source we stop reading (seconds)
  speed: number
  volume: number
  muted: boolean
  fadeIn: number
  fadeOut: number
  opacity: number
  grayscale: boolean
  rotation: number
  flipH: boolean
  flipV: boolean
  zIndex: number
}

export interface AudioClip {
  id: string
  trackId: string
  mediaId: string
  startTime: number
  duration: number
  trimStart: number
  trimEnd: number
  volume: number
  muted: boolean
  fadeIn: number
  fadeOut: number
}

export type TrackType = 'video' | 'audio' | 'text'

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  locked: boolean
  height: number
}

export interface EditorState {
  tracks: Track[]
  videoClips: VideoClip[]
  audioClips: AudioClip[]
  textOverlays: TextOverlay[]
  mediaLibrary: MediaItem[]
  playhead: number
  playing: boolean
  duration: number
  zoom: number          // pixels per second
  selectedId: string | null
  selectedType: 'clip' | 'audio' | 'text' | null
  snapEnabled: boolean
}
