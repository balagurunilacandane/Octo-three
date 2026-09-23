import { useEffect, useMemo, useState } from 'react'
import type { Task, TaskStatus, WorldBundle } from '../domain/types'
import { useWorld, type TaskFilter } from '../state/worldStore'
import { approveTask, planRequest, rejectTask, submitPlan } from '../tasks/TaskSystem'
import { mutedAccent } from '../world/materials'
import { InfoPanel } from './InfoPanel'

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'completed', label: 'Done' },
  { key: 'failed', label: 'Failed' },
]

const TAG: Record<TaskStatus, string> = { backlog: 'Backlog', in_progress: 'In progress', waiting: 'Waiting', completed: 'Done', failed: 'Failed' }

export function shortAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} m`
}

function roleOf(b: WorldBundle, agentId: string) {
  const name = b.agents[agentId]?.name
  return name ? name.replace(/\s+(agent|ai)(\s+\d+)?$/i, '').replace(/\s+\d+$/, '') : undefined
}

function meta(b: WorldBundle, t: Task) {
  const team = b.teams[t.targetDepartment]?.name
  const from = t.request ? 'from you' : t.sourceDepartment !== t.targetDepartment ? `from ${b.teams[t.sourceDepartment]?.name ?? 'another team'}` : undefined
  const age = shortAgo(t.updatedAt)
  const when =
    t.status === 'backlog' ? (age === 'just now' ? 'just added' : `queued ${age}`) : t.status === 'waiting' ? `waiting ${age === 'just now' ? 'now' : age}` : t.status === 'in_progress' ? 'working' : t.status === 'completed' ? 'finished' : 'stopped'
  return [roleOf(b, t.assignedAgent), team, when, from].filter(Boolean).join(' · ')
}

/**
 * Right-hand column of the World view: give any team work in plain language,
 * inspect the current selection, and follow every task in the office.
 */
export function TaskPanel({ worldId }: { worldId: string }) {
  const b = useWorld((s) => s.bundles[worldId])
  const selection = useWorld((s) => s.selection)
  const select = useWorld((s) => s.select)
  const filter = useWorld((s) => s.taskFilter)
  const setFilter = useWorld((s) => s.setTaskFilter)
  const [teamId, setTeamId] = useState<string>('auto')
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [, tick] = useState(0)

  // Selecting a department scopes the panel (and the task input) to that team.
  const scope = selection?.kind === 'team' ? selection.id : null
  useEffect(() => {
    if (scope) setTeamId(scope)
  }, [scope])
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000) // refresh relative times
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 6000)
    return () => clearTimeout(id)
  }, [note])

  const scoped = useMemo(() => (b?.tasks ?? []).filter((t) => !scope || t.sourceDepartment === scope || t.targetDepartment === scope), [b?.tasks, scope])
  const counts = useMemo(() => {
    const c: Record<TaskFilter, number> = { all: scoped.length, backlog: 0, in_progress: 0, waiting: 0, completed: 0, failed: 0 }
    for (const t of scoped) c[t.status]++
    return c
  }, [scoped])
  if (!b) return null
  const teams = b.world.teams.map((id) => b.teams[id]).filter(Boolean)
  const chosen = teamId === 'auto' ? undefined : b.teams[teamId]
  const list = scoped.filter((t) => filter === 'all' || t.status === filter).slice(0, 60)

  const add = async () => {
    const request = text.trim()
    if (!request) return
    const plan = await planRequest(worldId, request)
    if (!plan) return
    // A task typed "for marketing" goes to marketing; "auto" lets the planner route it.
    if (chosen) plan.steps = [{ teamId: chosen.id, title: plan.title }]
    if (chosen) plan.explanation = `Assigned to ${chosen.name}` + (plan.approval ? ` · “${plan.approval.reason}” will wait for your approval` : '')
    const ok = submitPlan(worldId, plan, request)
    setNote(ok ? plan.explanation : 'Logged — this World is driven by an external backend.')
    setText('')
  }

  return (
    <aside className={`task-panel${open ? ' open' : ''}`}>
      <button className="tp-handle" onClick={() => setOpen((o) => !o)} aria-label="Toggle task panel">
        <span />
        Task status · {counts.all}
      </button>
      <form
        className="tp-input"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label className="tp-team" style={{ ['--accent' as string]: chosen ? mutedAccent(chosen.color ?? '#999') : '#9aa0a6' }}>
          <span className="dc-dot" />
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team">
            <option value="auto">Auto</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="caret">▾</span>
        </label>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={chosen ? `Type a task for ${chosen.name.toLowerCase()}…` : 'Type a task…'} aria-label="New task" />
        <button className="pill-btn light" type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
      {note && <div className="tp-note">{note}</div>}

      <InfoPanel worldId={worldId} />

      <div className="tp-head">
        <h2 className="serif">Task status</h2>
        {scope ? (
          <button className="tp-scope" onClick={() => select(null)} title="Show the whole office">
            {b.teams[scope]?.name} ✕
          </button>
        ) : (
          <span className="tp-scope">Whole office</span>
        )}
      </div>
      <div className="tp-filters">
        {FILTERS.filter((f) => f.key !== 'failed' || counts.failed > 0).map((f) => (
          <button key={f.key} className={`chip-f${filter === f.key ? ' on' : ''}${f.key === 'waiting' ? ' warn' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label} <b className="serif">{counts[f.key]}</b>
          </button>
        ))}
      </div>
      <div className="tp-list">
        {list.length === 0 && <div className="tp-empty">Nothing here yet.</div>}
        {list.map((t) => (
          <div key={t.id} className={`tp-task status-${t.status}`}>
            <span className="tp-tag">{TAG[t.status]}</span>
            <div className="tp-body">
              <div className="tp-title">{t.title}</div>
              <div className="tp-meta">{meta(b, t)}</div>
              {t.status === 'completed' && t.result && <div className="tp-result">{t.result}</div>}
              {t.status === 'waiting' && (
                <div className="tp-actions">
                  <span className="tp-reason">⚠ {t.approval?.reason}</span>
                  <button className="pill-btn light" onClick={() => approveTask(worldId, t.id)}>
                    Approve
                  </button>
                  <button className="pill-btn" onClick={() => rejectTask(worldId, t.id)}>
                    Reject
                  </button>
                </div>
              )}
            </div>
            <span className="tp-time">{shortAgo(t.createdAt)}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
