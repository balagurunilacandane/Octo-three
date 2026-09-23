import { useEffect, useRef } from 'react'
import { MODEL_OPTIONS } from '../domain/catalog'
import { useWorld } from '../state/worldStore'
import { activityLabel, formatTokens, STATE_LABEL, useAgentLive, useTeamActivity } from '../ui/hooks'

/** Cursor-following tooltip for agents, departments and the Brain. */
export function HoverTooltip({ worldId }: { worldId: string }) {
  const hover = useWorld((s) => s.hover)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!ref.current) return
      const x = Math.min(e.clientX + 16, window.innerWidth - 260)
      const y = Math.min(e.clientY + 16, window.innerHeight - 160)
      ref.current.style.transform = `translate(${x}px, ${y}px)`
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return (
    <div ref={ref} className={`tooltip${hover ? ' show' : ''}`}>
      {hover?.kind === 'agent' && <AgentTip worldId={worldId} id={hover.id} />}
      {hover?.kind === 'team' && <TeamTip worldId={worldId} id={hover.id} />}
      {hover?.kind === 'brain' && <BrainTip worldId={worldId} />}
    </div>
  )
}

function AgentTip({ worldId, id }: { worldId: string; id: string }) {
  const agent = useWorld((s) => s.bundles[worldId]?.agents[id])
  const live = useAgentLive(worldId, id)
  const task = useWorld((s) => (live?.taskId ? s.bundles[worldId]?.tasks.find((t) => t.id === live.taskId) : undefined))
  if (!agent) return null
  const model = MODEL_OPTIONS.find((m) => m.id === agent.config.model)
  return (
    <>
      <div className="tip-title" style={{ color: agent.appearance.accent }}>
        Agent: {agent.name}
      </div>
      <Row k="Status" v={live ? STATE_LABEL[live.state] : '—'} />
      <Row k="Task" v={task?.title ?? '—'} />
      <Row k="Model" v={model?.provider ?? agent.config.model} />
      <Row k="Tokens" v={formatTokens(agent.tokensUsed)} />
    </>
  )
}

function TeamTip({ worldId, id }: { worldId: string; id: string }) {
  const team = useWorld((s) => s.bundles[worldId]?.teams[id])
  const tasks = useWorld((s) => s.bundles[worldId]?.tasks)
  const act = useTeamActivity(worldId, id)
  if (!team) return null
  const mine = (tasks ?? []).filter((t) => t.sourceDepartment === id || t.targetDepartment === id)
  const active = mine.filter((t) => t.status === 'in_progress' || t.status === 'waiting').length
  const done = mine.filter((t) => t.status === 'completed').length
  return (
    <>
      <div className="tip-title" style={{ color: team.color }}>
        {team.icon} {team.name.toUpperCase()}
      </div>
      <Row k="Agents" v={String(team.agentIds.length)} />
      <Row k="Active tasks" v={String(active)} />
      <Row k="Completed" v={String(done)} />
      <Row k="Activity" v={activityLabel(act)} />
    </>
  )
}

function BrainTip({ worldId }: { worldId: string }) {
  const n = useWorld((s) => s.bundles[worldId]?.knowledge.length ?? 0)
  const e = useWorld((s) => s.bundles[worldId]?.edges.length ?? 0)
  return (
    <>
      <div className="tip-title" style={{ color: '#67e8f9' }}>
        🧠 THE BRAIN
      </div>
      <Row k="Knowledge" v={`${n} nodes`} />
      <Row k="Connections" v={String(e)} />
      <div className="muted small">Click to explore what your World has learned</div>
    </>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="tip-row">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  )
}
