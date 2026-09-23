import { useWorld } from '../state/worldStore'
import { StatusPill } from '../components/StatusPill'
import { timeAgo } from '../ui/hooks'

export function OverviewPage({ worldId }: { worldId: string }) {
  const b = useWorld((s) => s.bundles[worldId])
  const activity = useWorld((s) => s.activity[worldId])
  const setTab = useWorld((s) => s.setTab)
  const updateWorld = useWorld((s) => s.updateWorld)
  if (!b) return null
  const teams = b.world.teams.map((id) => b.teams[id]).filter(Boolean)
  const counts = { in_progress: 0, waiting: 0, completed: 0, failed: 0, backlog: 0 }
  for (const t of b.tasks) counts[t.status]++
  const recent = b.tasks.filter((t) => t.status === 'completed').slice(0, 5)

  return (
    <div className="page">
      <div className="overview-head">
        <span className="world-icon big">{b.world.icon}</span>
        <div className="grow">
          <h1>{b.world.name}</h1>
          <p className="muted">{b.world.description}</p>
          <input
            className="input goal"
            placeholder="Set a goal for your organisation…"
            value={b.world.goal ?? ''}
            onChange={(e) => updateWorld(worldId, { goal: e.target.value })}
          />
        </div>
        <button className="btn primary big" onClick={() => setTab('world')}>
          Enter World →
        </button>
      </div>

      <div className="kpis">
        <Kpi v={b.world.agents.length} k="Agents" />
        <Kpi v={teams.length} k="Teams" />
        <Kpi v={b.tasks.length} k="Tasks" />
        <Kpi v={b.knowledge.length} k="Knowledge" />
      </div>

      <div className="cards-3">
        <div className="card">
          <div className="card-title">Activity</div>
          {(activity ?? []).slice(0, 7).map((e) => (
            <div key={e.id} className={`feed-row kind-${e.kind}`}>
              <span className="grow">{e.text}</span>
              <span className="muted tiny">{timeAgo(e.at)}</span>
            </div>
          ))}
          {!activity?.length && <div className="muted small">Enter the World to watch your teams work.</div>}
        </div>
        <div className="card">
          <div className="card-title">Tasks</div>
          <div className="task-bars">
            {(['in_progress', 'waiting', 'completed', 'failed'] as const).map((s) => (
              <div key={s} className="task-bar-row" onClick={() => setTab('tasks')}>
                <StatusPill status={s} />
                <span className="task-bar">
                  <span className={`fill-${s}`} style={{ width: `${(counts[s] / Math.max(1, b.tasks.length)) * 100}%` }} />
                </span>
                <b>{counts[s]}</b>
              </div>
            ))}
          </div>
          <div className="card-title" style={{ marginTop: 16 }}>
            Teams
          </div>
          <div className="team-chips">
            {teams.map((t) => (
              <span key={t.id} className="chip" style={{ ['--accent' as string]: t.color }}>
                {t.icon} {t.name} · {t.agentIds.length}
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Recent work</div>
          {recent.map((t) => (
            <div key={t.id} className="result">
              <div className="result-title">{t.title}</div>
              <div className="muted small">{t.result}</div>
            </div>
          ))}
          {!recent.length && <div className="muted small">Completed work will appear here.</div>}
        </div>
      </div>
    </div>
  )
}

function Kpi({ v, k }: { v: number; k: string }) {
  return (
    <div className="kpi">
      <div className="kpi-v">{v}</div>
      <div className="muted small">{k}</div>
    </div>
  )
}
