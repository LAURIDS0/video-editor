import { useState } from 'react'
import { useEditor } from '../useEditorStore'
import type { MediaItem } from '../types'

type Tab = 'media' | 'text' | 'transitions' | 'filters'

export default function MediaLibrary() {
  const { state, addMedia, addClipToTrack, addAudioToTrack, addTextToTrack } = useEditor()
  const [activeTab, setActiveTab] = useState<Tab>('media')
  const [dragging, setDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }
  const handleDragLeave = () => setDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    Array.from(e.dataTransfer.files).forEach(f => addMedia(f))
  }

  const addToTimeline = (item: MediaItem) => {
    const videoTrack = state.tracks.find(t => t.type === 'video')
    const audioTrack = state.tracks.find(t => t.type === 'audio')
    const playhead = state.playhead

    if (item.type === 'video' && videoTrack) {
      addClipToTrack(item.id, videoTrack.id, playhead)
    } else if (item.type === 'audio' && audioTrack) {
      addAudioToTrack(item.id, audioTrack.id, playhead)
    } else if (item.type === 'image' && videoTrack) {
      addClipToTrack(item.id, videoTrack.id, playhead)
    }
  }

  const addText = () => {
    const textTrack = state.tracks.find(t => t.type === 'text')
    if (textTrack) addTextToTrack(textTrack.id, state.playhead)
  }

  const formatDuration = (d: number) => {
    const m = Math.floor(d / 60); const s = Math.floor(d % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'media', label: 'Media' },
    { id: 'text', label: 'Text' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'filters', label: 'Filters' },
  ]

  return (
    <aside className="media-library">
      <nav className="lib-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`lib-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="lib-content">
        {activeTab === 'media' && (
          <>
            <ImportZone
              dragging={dragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={files => Array.from(files).forEach(f => addMedia(f))}
            />
            <div className="media-grid">
              {state.mediaLibrary.length === 0 && (
                <p className="empty-hint">Import files above or drag them here</p>
              )}
              {state.mediaLibrary.map(item => (
                <div
                  key={item.id}
                  className="media-card"
                  onDoubleClick={() => addToTimeline(item)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('mediaId', item.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                >
                  <div className="media-thumb">
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="media-thumb-image"
                      />
                    )}
                    {!item.thumbnail && item.type === 'video' && <span className="thumb-icon">🎬</span>}
                    {item.type === 'audio' && (
                      <>
                        <span className="thumb-icon">🎵</span>
                        <div className="audio-wave" />
                      </>
                    )}
                    <span className="media-dur">{formatDuration(item.duration)}</span>
                  </div>
                  <div className="media-name" title={item.name}>{item.name}</div>
                  <button
                    className="add-to-tl"
                    onClick={() => addToTimeline(item)}
                    title="Add to timeline at playhead"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'text' && (
          <div className="text-panel">
            <p className="panel-hint">Click to add text to the timeline</p>
            {TEXT_PRESETS.map(preset => (
              <button key={preset.label} className="text-preset" onClick={addText}>
                <span style={{ fontSize: preset.size, fontWeight: preset.bold ? 700 : 400 }}>
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'transitions' && (
          <div className="panel-grid">
            {TRANSITIONS.map(t => (
              <div key={t} className="effect-card">
                <div className="effect-thumb">⟶</div>
                <span className="effect-name">{t}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="panel-grid">
            {FILTERS_PRESETS.map(f => (
              <div key={f} className="effect-card">
                <div className="effect-thumb filter-preview">Aa</div>
                <span className="effect-name">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

// Small helper — ImportZone gets addMedia from parent
function ImportZone({ dragging, onDragOver, onDragLeave, onDrop, onFileSelect }: {
  dragging: boolean
  onDragOver: React.DragEventHandler
  onDragLeave: React.DragEventHandler
  onDrop: React.DragEventHandler
  onFileSelect: (files: FileList) => void
}) {
  return (
    <label className={`import-zone${dragging ? ' dragging' : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <span>⊕ Import / Drag files here</span>
      <input
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => e.target.files && onFileSelect(e.target.files)}
      />
    </label>
  )
}

const TEXT_PRESETS = [
  { label: 'Default text', size: 14, bold: false },
  { label: 'Title', size: 18, bold: true },
  { label: 'Subtitle', size: 14, bold: false },
  { label: 'End card', size: 12, bold: false },
]

const TRANSITIONS = ['Fade', 'Wipe', 'Dissolve', 'Zoom', 'Spin', 'Slide left', 'Slide right', 'Blur']
const FILTERS_PRESETS = ['Cinematic', 'Vintage', 'B&W', 'Warm', 'Cool', 'HDR', 'Fade', 'Vivid']
