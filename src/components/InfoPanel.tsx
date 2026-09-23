import { MODEL_OPTIONS } from '../domain/catalog'
import type { WorldBundle } from '../domain/types'
import { useWorld } from '../state/worldStore'
import { activityLabel, formatTokens, STATE_LABEL, timeAgo, useAgentLive, useTeamActivity } from '../ui/hooks'
import { StatusPill } from './StatusPill'
import { mutedAccent } from '../world/materials'

/** Side panel for the current selection (agent, department or the Brain). */
export function InfoPanel({ worldId }: { worldId: string }) {
  const selection = useWorld((s) => s.selection)
  const select = useWorld((s) => s.select)
  const bundle = useWorld((s) => s.bundles[worldId])
  if (!selection || !bundle) return null
  return (
    <section className="info-panel" key={selection.kind + selection.id}>
      <button className="close" onClick={() => select(null)} aria-label="Close">
        ×
      </button>
      {selection.kind === 'agent' && <AgentInfo bundle={bundle} id={selection.id} />}
      {selection.kind === 'team' && <TeamInfo bundle={bundle} id={selection.id} />}
      {selection.kind === 'brain' && <BrainInfo bundle={bundle} />}
    </section>
  )
}

function AgentInfo({ bundle, id }: { bundle: WorldBundle; id: string }) {
  const agent = bundle.agents[id]
  const live = useAgentLive(bundle.world.id, id)
  const advanced = useWorld((s) => s.advanced)
  const setTab = useWorld((s) => s.setTab)
  const selectDepartment = useWorld((s) => s.selectDepartment)
  if (!agent) return null
  const team = bundle.teams[agent.teamId]
  const task = live?.taskId ? bundle.tasks.find((t) => t.id === live.taskId) : undefined
  const recent = bundle.tasks.filter((t) => t.assignedAgent === id).slice(0, 4)
  return (
    <>
      <div className="panel-head" style={{ ['--accent' as string]: mutedAccent(agent.appearance.accent) }}>
        <div className="avatar" />
        <div>
          <div className="panel-title">{agent.name}</div>
          <button className="link muted small" onClick={() => team && selectDepartment(team.id)}>
            {team?.icon} {team?.name}
          </button>
        </div>
      </div>
      <p className="muted">{agent.role}</p>
      <div className="stat-grid">
        <Stat k="Status" v={live ? STATE_LABEL[live.state] : 'Offline'} />
        <Stat k="Tokens" v={formatTokens(agent.tokensUsed)} />
        <Stat k="Completed" v={String(agent.tasksCompleted)} />
        <Stat k="Model" v={MODEL_OPTIONS.find((m) => m.id === agent.config.model)?.label ?? agent.config.model} />
      </div>
      <div className="section-title">Current task</div>
      <div className="card-lite">{task ? task.title : <span className="muted">No task — ready for work.</span>}</div>
      {recent.length > 0 && (
        <>
          <div className="section-title">Recent work</div>
          {recent.map((t) => (
            <div key={t.id} className="mini-task">
              <StatusPill status={t.status} />
              <span>{t.title}</span>
            </div>
          ))}
        </>
      )}
      {advanced && (
        <>
          <div className="section-title">Configuration</div>
          <div className="code small">
            tools: {agent.config.tools.join(', ') || '—'}
            <br />
            temperature: {agent.config.temperature} · max tokens: {agent.config.maxTokens}
            <br />
            memory: {[agent.config.memory.world && 'world', agent.config.memory.team && 'team'].filter(Boolean).join(', ')}
          </div>
        </>
      )}
      <button className="btn full" onClick={() => setTab('agents')}>
        Edit agent
      </button>
    </>
  )
}

function TeamInfo({ bundle, id }: { bundle: WorldBundle; id: string }) {
  const team = bundle.teams[id]
  const act = useTeamActivity(bundle.world.id, id)
  const selectAgent = useWorld((s) => s.selectAgent)
  const setTab = useWorld((s) => s.setTab)
  if (!team) return null
  const mine = bundle.tasks.filter((t) => t.sourceDepartment === id || t.targetDepartment === id)
  const active = mine.filter((t) => t.status === 'in_progress' || t.status === 'waiting')
  return (
    <>
      <div className="panel-head" style={{ ['--accent' as string]: mutedAccent(team.color ?? '#999') }}>
        <div className="avatar icon">{team.icon}</div>
        <div>
          <div className="panel-title">{team.name}</div>
          <div className="muted small">{team.description}</div>
        </div>
      </div>
      <div className="stat-grid">
        <Stat k="Agents" v={String(team.agentIds.length)} />
        <Stat k="Active" v={String(active.length)} />
        <Stat k="Completed" v={String(mine.filter((t) => t.status === 'completed').length)} />
        <Stat k="Activity" v={activityLabel(act)} />
      </div>
      <div className="meter">
        <span style={{ width: `${act * 100}%`, background: mutedAccent(team.color ?? '#999') }} />
      </div>
      <div className="section-title">Agents</div>
      {team.agentIds.map((aid) => {
        const a = bundle.agents[aid]
        if (!a) return null
        return (
          <button key={aid} className="agent-row" onClick={() => selectAgent(aid)}>
            <span className="dot" style={{ background: mutedAccent(a.appearance.accent) }} />
            <span className="grow">{a.name}</span>
            <span className="muted small">{formatTokens(a.tokensUsed)} tok</span>
          </button>
        )
      })}
      <button className="btn full" onClick={() => setTab('teams')}>
        Manage team
      </button>
    </>
  )
}

function BrainInfo({ bundle }: { bundle: WorldBundle }) {
  const byTeam = new Map<string, typeof bundle.knowledge>()
  for (const n of bundle.knowledge) byTeam.set(n.departmentId, [...(byTeam.get(n.departmentId) ?? []), n])
  const recent = bundle.knowledge.slice(-8).reverse()
  return (
    <>
      <div className="panel-head" style={{ ['--accent' as string]: '#8fd3c8' }}>
        <div className="avatar icon">🧠</div>
        <div>
          <div className="panel-title">The Brain</div>
          <div className="muted small">Shared knowledge of {bundle.world.name}</div>
        </div>
      </div>
      <div className="stat-grid">
        <Stat k="Knowledge" v={String(bundle.knowledge.length)} />
        <Stat k="Connections" v={String(bundle.edges.length)} />
      </div>
      <div className="section-title">By department</div>
      {[...byTeam.entries()].map(([tid, nodes]) => {
        const t = bundle.teams[tid]
        return (
          <div key={tid} className="kb-row">
            <span className="dot" style={{ background: mutedAccent(t?.color ?? '#94a3b8') }} />
            <span className="grow">{t?.name ?? 'Removed team'}</span>
            <span className="kb-bar">
              <span style={{ width: `${Math.min(100, (nodes.length / Math.max(1, bundle.knowledge.length)) * 300)}%`, background: mutedAccent(t?.color ?? '#94a3b8') }} />
            </span>
            <span className="muted small">{nodes.length}</span>
          </div>
        )
      })}
      <div className="section-title">Recently learned</div>
      {recent.map((n) => (
        <div key={n.id} className="kb-item">
          <span className="dot" style={{ background: mutedAccent(bundle.teams[n.departmentId]?.color ?? '#94a3b8') }} />
          <span className="grow">{n.label}</span>
          <span className="muted small">{timeAgo(n.createdAt)}</span>
        </div>
      ))}
    </>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <div className="muted small">{k}</div>
      <div className="stat-v">{v}</div>
    </div>
  )
}
