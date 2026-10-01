import type { SceneDef } from '../scenes'

/** 渲染汤面；达成指定里程碑后，某段文字会“变”成另一段。 */
export function SurfaceText({ text, def, milestones, dark = false }: { text: string; def: SceneDef; milestones: string[]; dark?: boolean }) {
  const active = (def.surfaceSwaps ?? []).filter(s => milestones.includes(s.milestone) && text.includes(s.from))
  if (!active.length) return <>{text}</>
  const parts: (string | { to: string })[] = [text]
  for (const s of active) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (typeof p !== 'string' || !p.includes(s.from)) continue
      const segs = p.split(s.from)
      const out: (string | { to: string })[] = []
      segs.forEach((seg, j) => {
        if (seg) out.push(seg)
        if (j < segs.length - 1) out.push({ to: s.to })
      })
      parts.splice(i, 1, ...out)
    }
  }
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className={`swap ${dark ? 'swap-dark' : ''}`}>
            {p.to}
          </span>
        ),
      )}
    </>
  )
}
