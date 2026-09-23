import { useWorld } from '../state/worldStore'
import { timeAgo } from '../ui/hooks'

const KIND_ICON = { info: '•', task: '◆', knowledge: '✦', warning: '⚠', success: '✓', error: '✕' } as const

/** Live mini-feed of what's happening in the World. */
export function ActivityTicker({ worldId }: { worldId: string }) {
  const entries = useWorld((s) => s.activity[worldId])
  const setTab = useWorld((s) => s.setTab)
  const list = (entries ?? []).slice(0, 5)
  return (
    <div className="ticker" onClick={() => setTab('activity')} title="Open activity">
      <div className="ticker-title">
        <span className="live-dot" /> Live activity
      </div>
      {list.length === 0 && <div className="muted small">The world is waking up…</div>}
      {list.map((e, i) => (
        <div key={e.id} className={`ticker-row kind-${e.kind}`} style={{ opacity: 1 - i * 0.16 }}>
          <span className="ticker-icon">{KIND_ICON[e.kind]}</span>
          <span className="grow">{e.text}</span>
          <span className="muted tiny">{timeAgo(e.at)}</span>
        </div>
      ))}
    </div>
  )
}
