import { useEffect, useState } from 'react'
import type { AgentState } from '../domain/types'
import { getMounted } from '../tasks/TaskSystem'
import { useWorld } from '../state/worldStore'

export function useBundle(worldId?: string | null) {
  return useWorld((s) => (worldId ? s.bundles[worldId] : undefined))
}

/** Poll an agent's live runtime state (4 Hz) without subscribing React to the frame loop. */
export function useAgentLive(worldId: string | null | undefined, agentId: string | null | undefined) {
  const [live, setLive] = useState<{ state: AgentState; taskId: string | null } | null>(null)
  useEffect(() => {
    if (!worldId || !agentId) return
    const tick = () => {
      const a = getMounted(worldId)?.runtime.agents.get(agentId)
      setLive((prev) => {
        const next = a ? { state: a.path.length ? ('walking' as AgentState) : a.state, taskId: a.currentTaskId } : null
        return prev?.state === next?.state && prev?.taskId === next?.taskId ? prev : next
      })
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [worldId, agentId])
  return live
}

export function useTeamActivity(worldId: string | null | undefined, teamId: string | null | undefined) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!worldId || !teamId) return
    const id = setInterval(() => setV(Math.round((getMounted(worldId)?.runtime.activityOf(teamId) ?? 0) * 20) / 20), 300)
    return () => clearInterval(id)
  }, [worldId, teamId])
  return v
}

export function activityLabel(v: number) {
  return v > 0.66 ? 'High' : v > 0.33 ? 'Medium' : 'Low'
}

export function formatTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}

export function timeAgo(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export const STATE_LABEL: Record<AgentState, string> = {
  idle: 'Idle',
  working: 'Working',
  thinking: 'Thinking',
  walking: 'Walking',
  researching: 'Researching',
  communicating: 'Communicating',
  waiting: 'Waiting for approval',
  completed: 'Completed',
  error: 'Needs attention',
}
