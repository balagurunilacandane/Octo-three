import { localPlanner, type OrgPlanner, type RequestPlan } from '../domain/planner'
import type { Director } from '../sim/Director'
import type { WorldRuntime } from '../sim/WorldRuntime'
import { useWorld } from '../state/worldStore'

// Entry point for work requested by the user. The UI never talks to the
// simulation directly: it goes through here, so the same calls can later be
// forwarded to a real backend (POST /worlds/:id/requests) instead.

interface Mounted {
  runtime: WorldRuntime
  director: Director | null
}

const mounted = new Map<string, Mounted>()
let planner: OrgPlanner = localPlanner

export function setPlanner(p: OrgPlanner) {
  planner = p
}

export function getPlanner() {
  return planner
}

export function registerWorld(worldId: string, m: Mounted) {
  mounted.set(worldId, m)
  return () => {
    if (mounted.get(worldId) === m) mounted.delete(worldId)
  }
}

export function getMounted(worldId: string) {
  return mounted.get(worldId)
}

/** Plan a natural-language request ("Research the top 20 competitors…"). */
export async function planRequest(worldId: string, text: string): Promise<RequestPlan | null> {
  const bundle = useWorld.getState().bundles[worldId]
  if (!bundle || !text.trim()) return null
  return planner.planRequest(text, bundle)
}

/** Execute a plan in the world. Returns false if the world isn't running. */
export function submitPlan(worldId: string, plan: RequestPlan, request: string): boolean {
  const m = mounted.get(worldId)
  const store = useWorld.getState()
  store.log(worldId, { text: `You asked: “${request}” — ${plan.explanation}`, kind: 'info' })
  if (!m?.director) return false
  m.director.runPlan(plan, request)
  return true
}

/** Human-in-the-loop approval for a waiting task. */
export function approveTask(worldId: string, taskId: string) {
  const m = mounted.get(worldId)
  if (m) m.runtime.bus.emit({ event: 'task.approved', taskId })
  else useWorld.getState().applyEvent(worldId, { event: 'task.approved', taskId })
}

export function rejectTask(worldId: string, taskId: string) {
  const m = mounted.get(worldId)
  const e = { event: 'task.rejected' as const, taskId, reason: 'Rejected by you' }
  if (m) m.runtime.bus.emit(e)
  else useWorld.getState().applyEvent(worldId, e)
}
