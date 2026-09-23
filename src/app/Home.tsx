import { useWorld } from '../state/worldStore'
import { timeAgo } from '../ui/hooks'

/** "My Worlds" — every World is an independent AI organisation. */
export function Home() {
  const order = useWorld((s) => s.order)
  const bundles = useWorld((s) => s.bundles)
  const enterWorld = useWorld((s) => s.enterWorld)
  const setView = useWorld((s) => s.setView)

  return (
    <div className="page home">
      <div className="home-hero">
        <h1>My Worlds</h1>
        <p className="muted">Each World is its own AI organisation — with its own teams, agents, tasks and knowledge.</p>
      </div>
      <div className="world-grid">
        <button className="world-card create-card" onClick={() => setView('wizard')}>
          <span className="create-plus">＋</span>
          <span className="create-title">Create New World</span>
          <span className="muted small">Describe what you're building — AI Worlds designs the organisation.</span>
        </button>
        {order.map((id) => {
          const b = bundles[id]
          if (!b) return null
          const teams = b.world.teams.map((t) => b.teams[t]).filter(Boolean)
          const active = b.tasks.filter((t) => t.status === 'in_progress' || t.status === 'waiting').length
          return (
            <div key={id} className="world-card" role="button" tabIndex={0} onClick={() => enterWorld(id, 'overview')} onKeyDown={(e) => e.key === 'Enter' && enterWorld(id, 'overview')}>
              <div className="world-card-head">
                <span className="world-icon">{b.world.icon}</span>
                <div>
                  <div className="world-name">{b.world.name}</div>
                  <div className="muted small">
                    {b.world.agents.length} AI agents · {teams.length} teams
                  </div>
                </div>
              </div>
              <div className="team-chips">
                {teams.slice(0, 7).map((t) => (
                  <span key={t.id} className="chip" style={{ ['--accent' as string]: t.color }}>
                    {t.icon} {t.name}
                  </span>
                ))}
              </div>
              <div className="world-card-foot">
                <span className="muted small">{active ? `${active} tasks in progress` : `Updated ${timeAgo(Date.parse(b.world.updatedAt))}`}</span>
                <button
                  className="btn primary small"
                  onClick={(e) => {
                    e.stopPropagation()
                    enterWorld(id, 'world')
                  }}
                >
                  Enter World →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
