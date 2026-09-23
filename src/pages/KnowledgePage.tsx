import { useMemo, useState } from 'react'
import { useWorld } from '../state/worldStore'
import { timeAgo } from '../ui/hooks'

export function KnowledgePage({ worldId }: { worldId: string }) {
  const b = useWorld((s) => s.bundles[worldId])
  const [q, setQ] = useState('')
  const degree = useMemo(() => {
    const d = new Map<string, number>()
    for (const e of b?.edges ?? []) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1)
      d.set(e.target, (d.get(e.target) ?? 0) + 1)
    }
    return d
  }, [b?.edges])
  if (!b) return null
  const nodes = b.knowledge.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).slice().reverse()

  return (
    <div className="page">
      <div className="page-head">
        <h1>Knowledge</h1>
        <input className="input" placeholder="Search what your World has learned…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted">
        {b.knowledge.length} knowledge nodes · {b.edges.length} connections. Every finished task feeds the Brain.
      </p>
      <div className="kb-grid">
        {nodes.map((n) => {
          const t = b.teams[n.departmentId]
          return (
            <div key={n.id} className="card kb-card" style={{ ['--accent' as string]: t?.color ?? '#94a3b8' }}>
              <div className="strong">{n.label}</div>
              <div className="muted small">
                {t?.icon} {t?.name ?? 'Removed team'} · {timeAgo(n.createdAt)}
              </div>
              <div className="kb-meta">
                <span className="meter small">
                  <span style={{ width: `${n.importance * 100}%`, background: t?.color }} />
                </span>
                <span className="muted tiny">{degree.get(n.id) ?? 0} links</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
