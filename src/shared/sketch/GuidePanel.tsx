import type { Id } from '@/core/model'
import type { DrawingGuide, GuideKind, SymmetryKind } from './guides'

const UI = {
  title: 'Drawing guide',
  kinds: { off: 'Off', grid: '2D grid', isometric: 'Isometric', perspective: 'Perspective', symmetry: 'Symmetry' } as Record<GuideKind, string>,
  show: 'Show',
  size: 'Grid size',
  opacity: 'Strength',
  color: 'Color',
  points: 'Vanishing points',
  symmetry: { vertical: 'Left / right', horizontal: 'Top / bottom', quadrant: 'Four ways', radial: 'Radial' } as Record<SymmetryKind, string>,
  rotational: 'Rotate copies instead of mirroring',
  segments: 'Segments',
  assist: 'Drawing Assist on this layer',
  assistHelp: {
    grid: 'Strokes stay level or upright.',
    isometric: 'Strokes follow the isometric lines.',
    perspective: 'Strokes head for a vanishing point.',
    symmetry: 'Strokes are copied by the symmetry.',
    off: '',
  } as Record<GuideKind, string>,
  edit: 'Move points',
  editHelp: 'Drag the dots on the canvas.',
}

/** Side panel section for the drawing guide and Drawing Assist (Sketch Pro). */
export function GuidePanel({ guide, layerId, editing, onEditing, onChange }: { guide: DrawingGuide; layerId: Id | undefined; editing: boolean; onEditing(on: boolean): void; onChange(g: DrawingGuide): void }) {
  const set = (patch: Partial<DrawingGuide>) => onChange({ ...guide, ...patch })
  const assistOn = !!layerId && guide.assist.includes(layerId)
  const setAssist = (on: boolean) => layerId && set({ assist: on ? [...guide.assist.filter((x) => x !== layerId), layerId] : guide.assist.filter((x) => x !== layerId) })
  const pickKind = (kind: GuideKind) => {
    // Symmetry needs Drawing Assist to paint, so turn it on for the current layer right away.
    const assist = kind === 'symmetry' && layerId && !guide.assist.includes(layerId) ? [...guide.assist, layerId] : guide.assist
    set({ kind, visible: true, assist })
    if (kind !== 'perspective' && kind !== 'symmetry') onEditing(false)
  }
  const k = guide.kind
  return (
    <section className="guide-panel">
      <h4>{UI.title}</h4>
      <label className="sketch-row">
        <select className="input" value={k} onChange={(e) => pickKind(e.target.value as GuideKind)}>
          {(Object.keys(UI.kinds) as GuideKind[]).map((x) => (
            <option key={x} value={x}>
              {UI.kinds[x]}
            </option>
          ))}
        </select>
        {k !== 'off' && (
          <label className="sketch-check">
            <input type="checkbox" checked={guide.visible} onChange={(e) => set({ visible: e.target.checked })} />
            {UI.show}
          </label>
        )}
      </label>
      {(k === 'grid' || k === 'isometric') && <Num label={UI.size} min={8} max={400} step={1} value={guide.size} suffix="px" onChange={(size) => set({ size })} />}
      {k === 'perspective' && (
        <div className="sketch-row">
          <span>{UI.points}</span>
          <div className="guide-seg">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={`btn sketch-small${guide.points === n ? ' is-active' : ''}`} onClick={() => set({ points: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {k === 'symmetry' && (
        <>
          <label className="sketch-row">
            <select className="input" value={guide.symmetry} onChange={(e) => set({ symmetry: e.target.value as SymmetryKind })}>
              {(Object.keys(UI.symmetry) as SymmetryKind[]).map((x) => (
                <option key={x} value={x}>
                  {UI.symmetry[x]}
                </option>
              ))}
            </select>
          </label>
          {guide.symmetry === 'radial' && <Num label={UI.segments} min={2} max={16} step={1} value={guide.segments} onChange={(segments) => set({ segments })} />}
          <label className="sketch-check">
            <input type="checkbox" checked={guide.rotational} onChange={(e) => set({ rotational: e.target.checked })} />
            {UI.rotational}
          </label>
        </>
      )}
      {k !== 'off' && (
        <>
          <div className="sketch-row">
            <span>{UI.color}</span>
            <input type="color" value={guide.color} onChange={(e) => set({ color: e.target.value })} aria-label={UI.color} />
            <input type="range" min={0.1} max={1} step={0.05} value={guide.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} aria-label={UI.opacity} title={UI.opacity} />
          </div>
          <label className="sketch-check" title={UI.assistHelp[k]}>
            <input type="checkbox" checked={assistOn} disabled={!layerId} onChange={(e) => setAssist(e.target.checked)} />
            {UI.assist}
          </label>
          {(k === 'perspective' || k === 'symmetry') && (
            <label className="sketch-check" title={UI.editHelp}>
              <input type="checkbox" checked={editing} onChange={(e) => onEditing(e.target.checked)} />
              {UI.edit}
            </label>
          )}
        </>
      )}
    </section>
  )
}

function Num(p: { label: string; min: number; max: number; step: number; value: number; suffix?: string; onChange(v: number): void }) {
  return (
    <label className="sketch-slider">
      <span>{p.label}</span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
      <span className="sketch-slider-value">
        {Math.round(p.value)}
        {p.suffix ?? ''}
      </span>
    </label>
  )
}
