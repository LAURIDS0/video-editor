import { useRef } from 'react'
import { useEditor } from '../useEditorStore'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()
const LOCAL_CORE_BASES = [
  '/ffmpeg',
]
const CORE_CDN_BASES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
]
let ffLoaded = false
const ffmpegLogBuffer: string[] = []
let ffmpegLogSubscribed = false

async function loadFfmpegWithFallback() {
  let lastError: unknown = null

  for (const base of LOCAL_CORE_BASES) {
    try {
      const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript')
      const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')

      await ffmpeg.load({
        coreURL,
        wasmURL,
      })

      return
    } catch (error) {
      lastError = error
    }
  }

  for (const base of CORE_CDN_BASES) {
    try {
      const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript')
      const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')

      await ffmpeg.load({
        coreURL,
        wasmURL,
      })

      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Unable to load ffmpeg core from available CDNs')
}

export default function Toolbar() {
  const { state, addMedia } = useEditor()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportStateRef = useRef<{ busy: boolean; msg: string }>({ busy: false, msg: '' })

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(f => addMedia(f))
    e.target.value = ''
  }

  const handleExport = async () => {
    if (exportStateRef.current.busy) return
    exportStateRef.current.busy = true

    const clip = state.videoClips.find((candidate) => {
      const media = state.mediaLibrary.find((item) => item.id === candidate.mediaId)
      return media?.type === 'video'
    })

    if (!clip) {
      alert('Add at least one video clip to the timeline')
      exportStateRef.current.busy = false
      return
    }

    const media = state.mediaLibrary.find(m => m.id === clip.mediaId)
    if (!media) {
      exportStateRef.current.busy = false
      return
    }

    try {
      if (!ffLoaded) {
        await loadFfmpegWithFallback()
        ffLoaded = true
      }

      if (!ffmpegLogSubscribed) {
        ffmpeg.on('log', ({ message }) => {
          if (!message) return
          ffmpegLogBuffer.push(message)
          if (ffmpegLogBuffer.length > 120) {
            ffmpegLogBuffer.shift()
          }
        })
        ffmpegLogSubscribed = true
      }

      ffmpegLogBuffer.length = 0

      const ext = getInputExtension(media.name, media.type)
      const inputFile = `input.${ext}`

      const resp = await fetch(media.url)
      const buf = await resp.arrayBuffer()

      try {
        await ffmpeg.deleteFile(inputFile)
      } catch {
      }
      try {
        await ffmpeg.deleteFile('output.mp4')
      } catch {
      }

      await ffmpeg.writeFile(inputFile, new Uint8Array(buf))

      if (media.type === 'image') {
        await ffmpeg.exec([
          '-loop', '1',
          '-i', inputFile,
          '-t', String(Math.max(0.1, clip.duration)),
          '-pix_fmt', 'yuv420p',
          '-movflags', 'faststart',
          'output.mp4',
        ])
      } else {
        const filters = [`trim=start=${clip.trimStart}:end=${clip.trimEnd}`, 'setpts=PTS-STARTPTS']
        if (clip.grayscale) filters.push('hue=s=0')

        await ffmpeg.exec([
          '-i', inputFile,
          '-vf', filters.join(','),
          '-movflags', 'faststart',
          'output.mp4',
        ])
      }

      const out = await ffmpeg.readFile('output.mp4') as Uint8Array
      const normal = new Uint8Array(out.byteLength); normal.set(out)
      const blob = new Blob([normal], { type: 'video/mp4' })
      const a = document.createElement('a')
      const downloadUrl = URL.createObjectURL(blob)
      a.href = downloadUrl
      a.download = 'edited-video.mp4'
      a.click()
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : (() => {
              try {
                return JSON.stringify(err)
              } catch {
                return String(err)
              }
            })()

      const ffmpegTail = ffmpegLogBuffer.slice(-5).join(' | ')
      const details = ffmpegTail ? `${errorMessage}\nFFmpeg: ${ffmpegTail}` : errorMessage
      alert(`Export failed: ${details}`)
    } finally {
      exportStateRef.current.busy = false
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="logo">
          <span className="logo-icon">▶</span>
          <span className="logo-text">VideoEditor</span>
        </div>

        <div className="toolbar-tools">
          <button className="tool-btn" title="Undo (Ctrl+Z)">↩</button>
          <button className="tool-btn" title="Redo (Ctrl+Y)">↪</button>
          <div className="tool-sep" />
          <button className="tool-btn active" title="Select">▲</button>
          <button className="tool-btn" title="Cut (C)">✂</button>
          <button className="tool-btn" title="Zoom">🔍</button>
        </div>
      </div>

      <div className="toolbar-center">
        <div className="project-name">New project</div>
      </div>

      <div className="toolbar-right">
        <div className="timeline-info">
          Duration: {formatTime(state.duration)}
        </div>
        <label className="import-btn" title="Import media files">
          + Import
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            multiple
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </label>
        <button className="export-btn" onClick={handleExport}>
          Export ↓
        </button>
      </div>
    </header>
  )
}

function getInputExtension(filename: string, mediaType: 'video' | 'audio' | 'image') {
  const parts = filename.split('.')
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
  if (ext) return ext
  if (mediaType === 'image') return 'png'
  if (mediaType === 'audio') return 'mp3'
  return 'mp4'
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
