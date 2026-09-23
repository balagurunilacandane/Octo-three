import { useState } from 'react'
import type { TaskStatus } from '../domain/types'
import { StatusPill } from '../components/StatusPill'
import { useWorld } from '../state/worldStore'
import { approveTask, rejectTask } from '../tasks/TaskSystem'
import { formatTokens, timeAgo } from '../ui/hooks'

const FILTERS: (TaskStatus | 'all')[] = ['all', 'in_progress', 'waiting', 'completed', 'failed']

export function TasksPage({ worldId }: { worldId: string }) {
  const b = useWorld((s) => s.bundles[worldId])
  const advanced = useWorld((s) => s.advanced)
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
  if (!b) return null
  const list = b.tasks.filter((t) => filter === 'all' || t.status === filter)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Tasks</h1>
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In progress' : f === 'waiting' ? 'Needs approval' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 && <div className="empty">No tasks here yet. Ask your teams for something from the World view.</div>}
      <div className="task-list">
        {list.map((t) => {
          const src = b.teams[t.sourceDepartment]
          const dst = b.teams[t.targetDepartment]
          const agent = b.agents[t.assignedAgent]
          return (
            <div key={t.id} className="card task-row">
              <div className="task-main">
                <div className="task-title">
                  <StatusPill status={t.status} /> {t.title}
                </div>
                <div className="muted small">
                  <span style={{ color: src?.color }}>{src?.name ?? '—'}</span>
                  {dst && dst.id !== src?.id && (
                    <>
                      {' → 🧠 → '}
                      <span style={{ color: dst.color }}>{dst.name}</span>
                    </>
                  )}
                  {agent && <> · {agent.name}</>} · {timeAgo(t.createdAt)}
                  {advanced && t.tokens ? <> · {formatTokens(t.tokens)} tokens</> : null}
                </div>
                {t.request && <div className="small quote">“{t.request}”</div>}
                {t.result && <div className="small result-text">{t.result}</div>}
              </div>
              {t.status === 'waiting' && (
                <div className="task-actions">
                  <div className="small warn">⚠ {t.approval?.reason}</div>
                  <button className="btn small primary" onClick={() => approveTask(worldId, t.id)}>
                    Approve
                  </button>
                  <button className="btn small ghost" onClick={() => rejectTask(worldId, t.id)}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
