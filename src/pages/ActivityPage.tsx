import { useWorld } from '../state/worldStore'
import { timeAgo } from '../ui/hooks'

export function ActivityPage({ worldId }: { worldId: string }) {
  const entries = useWorld((s) => s.activity[worldId])
  const teams = useWorld((s) => s.bundles[worldId]?.teams)
  return (
    <div className="page">
      <div className="page-head">
        <h1>Activity</h1>
      </div>
      <div className="card">
        {(entries ?? []).map((e) => (
          <div key={e.id} className={`feed-row kind-${e.kind}`}>
            {e.teamId && teams?.[e.teamId] && <span className="dot" style={{ background: teams[e.teamId].color }} />}
            <span className="grow">{e.text}</span>
            <span className="muted tiny">{timeAgo(e.at)}</span>
          </div>
        ))}
        {!entries?.length && <div className="muted">Nothing yet — activity appears as your agents work.</div>}
      </div>
    </div>
  )
}
