import { useEditor } from '../useEditorStore'

export default function Inspector() {
  const { state, dispatch } = useEditor()
  const { selectedId, selectedType } = state

  if (!selectedId) {
    return (
      <aside className="inspector">
        <div className="inspector-empty">
          <span>Select a clip to edit properties</span>
        </div>
      </aside>
    )
  }

  if (selectedType === 'text') {
    const overlay = state.textOverlays.find(o => o.id === selectedId)
    if (!overlay) return <aside className="inspector" />

    const patch = (p: object) => dispatch({ type: 'UPDATE_TEXT_OVERLAY', id: selectedId, patch: p })
    const addKf = () => {
      const localTime = Math.max(0, state.playhead - overlay.startTime)
      dispatch({
        type: 'ADD_KEYFRAME',
        overlayId: selectedId,
        keyframe: { time: localTime, x: overlay.x, y: overlay.y },
      })
    }

    return (
      <aside className="inspector">
        <h3>Text Overlay</h3>

        <Section title="Content">
          <label>Text
            <textarea
              value={overlay.text}
              onChange={e => patch({ text: e.target.value })}
              rows={3}
            />
          </label>
          <Row label="Font">
            <select value={overlay.fontFamily} onChange={e => patch({ fontFamily: e.target.value })}>
              {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
            </select>
          </Row>
          <Row label="Size">
            <NumberInput value={overlay.fontSize} min={8} max={200} step={1} onChange={v => patch({ fontSize: v })} />
          </Row>
          <Row label="Color">
            <input type="color" value={overlay.color} onChange={e => patch({ color: e.target.value })} />
          </Row>
          <Row label="">
            <Toggle value={overlay.bold} onChange={v => patch({ bold: v })} label="Bold" />
            <Toggle value={overlay.italic} onChange={v => patch({ italic: v })} label="Italic" />
          </Row>
        </Section>

        <Section title="Background">
          <Row label="Color">
            <input type="color" value={overlay.bgColor} onChange={e => patch({ bgColor: e.target.value })} />
          </Row>
          <Row label={`Opacity (${Math.round(overlay.bgOpacity * 100)}%)`}>
            <input type="range" min={0} max={1} step={0.01} value={overlay.bgOpacity} onChange={e => patch({ bgOpacity: +e.target.value })} />
          </Row>
        </Section>

        <Section title="Position">
          <Row label={`X (${Math.round(overlay.x)}%)`}>
            <input type="range" min={0} max={100} step={0.5} value={overlay.x} onChange={e => patch({ x: +e.target.value })} />
          </Row>
          <Row label={`Y (${Math.round(overlay.y)}%)`}>
            <input type="range" min={0} max={100} step={0.5} value={overlay.y} onChange={e => patch({ y: +e.target.value })} />
          </Row>
        </Section>

        <Section title="Tracking / Keyframes">
          <p className="hint-text">
            Keyframes control text motion over time. Move the text to a position and add a keyframe.
          </p>
          <button className="add-kf-btn" onClick={addKf}>
            + Add keyframe at {fmt(Math.max(0, state.playhead - overlay.startTime))}
          </button>
          {overlay.keyframes.length > 0 && (
            <table className="kf-table">
              <thead><tr><th>Time</th><th>X</th><th>Y</th><th /></tr></thead>
              <tbody>
                {overlay.keyframes.map(kf => (
                  <tr key={kf.time}>
                    <td>{fmt(kf.time)}</td>
                    <td>{Math.round(kf.x)}%</td>
                    <td>{Math.round(kf.y)}%</td>
                    <td>
                      <button className="kf-del" onClick={() => dispatch({ type: 'DELETE_KEYFRAME', overlayId: selectedId, time: kf.time })}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Timing">
          <Row label={`Start (${fmt(overlay.startTime)})`}>
            <input type="range" min={0} max={state.duration} step={0.01} value={overlay.startTime} onChange={e => patch({ startTime: +e.target.value })} />
          </Row>
          <Row label={`Duration (${fmt(overlay.duration)})`}>
            <input type="range" min={0.5} max={60} step={0.1} value={overlay.duration} onChange={e => patch({ duration: +e.target.value })} />
          </Row>
        </Section>

        <button className="delete-btn" onClick={() => dispatch({ type: 'DELETE_CLIP', id: selectedId })}>
          🗑 Delete overlay
        </button>
      </aside>
    )
  }

  if (selectedType === 'clip') {
    const clip = state.videoClips.find(c => c.id === selectedId)
    if (!clip) return <aside className="inspector" />

    const patch = (p: object) => dispatch({ type: 'UPDATE_VIDEO_CLIP', id: selectedId, patch: p })
    const media = state.mediaLibrary.find(m => m.id === clip.mediaId)

    return (
      <aside className="inspector">
        <h3>Video Clip</h3>
        {media && <div className="clip-source">{media.name}</div>}

        <Section title="Timing">
          <Row label={`Timeline position: ${fmt(clip.startTime)}`}>
            <input type="range" min={0} max={Math.max(state.duration - 0.1, 0)} step={0.01} value={clip.startTime} onChange={e => patch({ startTime: +e.target.value })} />
          </Row>
          <Row label={`Duration: ${fmt(clip.duration)}`}>
            <input type="range" min={0.1} max={media?.duration ?? 60} step={0.01} value={clip.duration} onChange={e => patch({ duration: +e.target.value })} />
          </Row>
        </Section>

        <Section title="Playback">
          <Row label={`Speed: ${clip.speed.toFixed(2)}x`}>
            <input type="range" min={0.1} max={4} step={0.05} value={clip.speed} onChange={e => patch({ speed: +e.target.value })} />
          </Row>
          <Row label={`Volume: ${Math.round(clip.volume * 100)}%`}>
            <input type="range" min={0} max={1} step={0.01} value={clip.volume} disabled={clip.muted} onChange={e => patch({ volume: +e.target.value })} />
          </Row>
          <Row label={`Fade in: ${clip.fadeIn.toFixed(1)}s`}>
            <input type="range" min={0} max={8} step={0.1} value={clip.fadeIn} onChange={e => patch({ fadeIn: +e.target.value })} />
          </Row>
          <Row label={`Fade out: ${clip.fadeOut.toFixed(1)}s`}>
            <input type="range" min={0} max={8} step={0.1} value={clip.fadeOut} onChange={e => patch({ fadeOut: +e.target.value })} />
          </Row>
          <Row label="">
            <Toggle value={clip.muted} onChange={v => patch({ muted: v })} label="Mute" />
          </Row>
        </Section>

        <Section title="Image">
          <Row label={`Opacity: ${Math.round(clip.opacity * 100)}%`}>
            <input type="range" min={0} max={1} step={0.01} value={clip.opacity} onChange={e => patch({ opacity: +e.target.value })} />
          </Row>
          <Row label="Rotation">
            <select value={clip.rotation} onChange={e => patch({ rotation: +e.target.value })}>
              {[0, 90, 180, 270].map(r => <option key={r} value={r}>{r}°</option>)}
            </select>
          </Row>
          <Row label="">
            <Toggle value={clip.grayscale} onChange={v => patch({ grayscale: v })} label="Grayscale" />
            <Toggle value={clip.flipH} onChange={v => patch({ flipH: v })} label="Flip H" />
            <Toggle value={clip.flipV} onChange={v => patch({ flipV: v })} label="Flip V" />
          </Row>
        </Section>

        <button className="delete-btn" onClick={() => dispatch({ type: 'DELETE_CLIP', id: selectedId })}>🗑 Delete clip</button>
      </aside>
    )
  }

  if (selectedType === 'audio') {
    const clip = state.audioClips.find(c => c.id === selectedId)
    if (!clip) return <aside className="inspector" />

    const patch = (p: object) => dispatch({ type: 'UPDATE_AUDIO_CLIP', id: selectedId, patch: p })
    const media = state.mediaLibrary.find(m => m.id === clip.mediaId)

    return (
      <aside className="inspector">
        <h3>Audio Clip</h3>
        {media && <div className="clip-source">{media.name}</div>}

        <Section title="Volume">
          <Row label={`Volume: ${Math.round(clip.volume * 100)}%`}>
            <input type="range" min={0} max={2} step={0.01} value={clip.volume} onChange={e => patch({ volume: +e.target.value })} />
          </Row>
          <Row label="">
            <Toggle value={clip.muted} onChange={v => patch({ muted: v })} label="Mute" />
          </Row>
        </Section>

        <Section title="Fade">
          <Row label={`Fade in: ${clip.fadeIn.toFixed(1)}s`}>
            <input type="range" min={0} max={5} step={0.1} value={clip.fadeIn} onChange={e => patch({ fadeIn: +e.target.value })} />
          </Row>
          <Row label={`Fade out: ${clip.fadeOut.toFixed(1)}s`}>
            <input type="range" min={0} max={5} step={0.1} value={clip.fadeOut} onChange={e => patch({ fadeOut: +e.target.value })} />
          </Row>
        </Section>

        <button className="delete-btn" onClick={() => dispatch({ type: 'DELETE_CLIP', id: selectedId })}>🗑 Delete clip</button>
      </aside>
    )
  }

  return <aside className="inspector" />
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="insp-section">
      <div className="insp-section-title">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="insp-row">
      {label && <span className="insp-label">{label}</span>}
      <div className="insp-control">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`toggle-btn${value ? ' on' : ''}`} onClick={() => onChange(!value)}>
      {label}
    </button>
  )
}

function NumberInput({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(+e.target.value)}
      style={{ width: '72px' }}
    />
  )
}

const FONTS = [
  'Inter, sans-serif',
  'Georgia, serif',
  'Impact, fantasy',
  '"Courier New", monospace',
  'Arial, sans-serif',
  '"Times New Roman", serif',
]

function fmt(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`
}
