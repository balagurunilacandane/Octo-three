import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TOOL_CATALOG } from '../domain/catalog'
import { bundleFromProposal, makeAgent, makeTeam, seedProposals } from '../domain/factory'
import { uid } from '../domain/ids'
import type { ProposedTeam } from '../domain/planner'
import type { ActivityEntry, Agent, PermissionRule, RuntimeSettings, Team, WorldBundle, World } from '../domain/types'
import type { WorldEvent } from '../events/types'

export type Tab = 'overview' | 'world' | 'teams' | 'agents' | 'tasks' | 'knowledge' | 'tools' | 'activity' | 'settings'
export type View = 'home' | 'wizard' | 'world'
export type Selection = { kind: 'agent' | 'team' | 'brain'; id: string } | null

const MAX_TASKS = 200
const MAX_KNOWLEDGE = 160
const MAX_EDGES = 320
const MAX_ACTIVITY = 120

export interface WorldState {
  bundles: Record<string, WorldBundle>
  order: string[]
  currentWorldId: string | null
  view: View
  tab: Tab
  advanced: boolean
  selection: Selection
  hover: Selection
  /** Ephemeral, per world; not persisted. */
  activity: Record<string, ActivityEntry[]>
  /** Bumped to ask the camera to re-focus the current selection. */
  focusNonce: number

  // navigation
  setView: (v: View) => void
  setTab: (t: Tab) => void
  setAdvanced: (on: boolean) => void
  enterWorld: (id: string, tab?: Tab) => void

  // selection
  select: (s: Selection) => void
  selectAgent: (id: string) => void
  selectDepartment: (id: string) => void
  setHover: (s: Selection) => void

  // worlds
  createWorld: (bundle: WorldBundle) => string
  updateWorld: (worldId: string, patch: Partial<World>) => void
  deleteWorld: (worldId: string) => void

  // organisation
  addTeam: (worldId: string, team: ProposedTeam) => void
  updateTeam: (worldId: string, teamId: string, patch: Partial<Team>) => void
  removeTeam: (worldId: string, teamId: string) => void
  addAgent: (worldId: string, agent: Agent) => void
  updateAgent: (worldId: string, agentId: string, patch: Partial<Agent>) => void
  removeAgent: (worldId: string, agentId: string) => void

  // configuration
  addPermissions: (worldId: string, rules: PermissionRule[]) => void
  removePermission: (worldId: string, ruleId: string) => void
  toggleTool: (worldId: string, toolId: string) => void
  updateTool: (worldId: string, toolId: string, patch: Partial<WorldBundle['tools'][string]>) => void
  updateRuntime: (worldId: string, patch: Partial<RuntimeSettings>) => void

  // events
  applyEvent: (worldId: string, e: WorldEvent) => void
  /** Simulated runs don't survive leaving a World: close out their in-flight tasks. */
  interruptActiveTasks: (worldId: string) => void
  log: (worldId: string, entry: Omit<ActivityEntry, 'id' | 'at'>) => void
}

function seedState(): Pick<WorldState, 'bundles' | 'order' | 'currentWorldId'> {
  const bundles: Record<string, WorldBundle> = {}
  const order: string[] = []
  for (const p of seedProposals()) {
    const b = bundleFromProposal(p)
    bundles[b.world.id] = b
    order.push(b.world.id)
  }
  return { bundles, order, currentWorldId: order[0] }
}

function interrupt(t: WorldBundle['tasks'][number]): WorldBundle['tasks'][number] {
  return t.status === 'in_progress' || t.status === 'backlog' || t.status === 'waiting'
    ? { ...t, status: 'failed', result: 'Interrupted — the World was closed while this was running.', approval: undefined }
    : t
}

type Set = (fn: (s: WorldState) => Partial<WorldState>) => void

/** Immutable helper: update one world bundle. */
function patchBundle(set: Set, worldId: string, fn: (b: WorldBundle) => WorldBundle) {
  set((s) => {
    const b = s.bundles[worldId]
    if (!b) return {}
    const next = fn(b)
    return { bundles: { ...s.bundles, [worldId]: { ...next, world: { ...next.world, updatedAt: new Date().toISOString() } } } }
  })
}

function syncWorldIndex(b: WorldBundle): WorldBundle {
  return { ...b, world: { ...b.world, teams: Object.keys(b.teams), agents: Object.keys(b.agents), tools: Object.keys(b.tools) } }
}

export const useWorld = create<WorldState>()(
  persist(
    (set, get) => ({
      ...seedState(),
      view: 'home',
      tab: 'world',
      advanced: false,
      selection: null,
      hover: null,
      activity: {},
      focusNonce: 0,

      setView: (view) => set(() => ({ view, selection: null, hover: null })),
      setTab: (tab) => set(() => ({ tab })),
      setAdvanced: (advanced) => set(() => ({ advanced })),
      enterWorld: (id, tab = 'world') => set(() => ({ currentWorldId: id, view: 'world', tab, selection: null, hover: null })),

      select: (selection) => set((s) => ({ selection, focusNonce: s.focusNonce + 1 })),
      selectAgent: (id) => get().select({ kind: 'agent', id }),
      selectDepartment: (id) => get().select({ kind: 'team', id }),
      setHover: (hover) => {
        const h = get().hover
        if (h?.id === hover?.id && h?.kind === hover?.kind) return
        set(() => ({ hover }))
      },

      createWorld: (bundle) => {
        set((s) => ({
          bundles: { ...s.bundles, [bundle.world.id]: bundle },
          order: [bundle.world.id, ...s.order],
          currentWorldId: bundle.world.id,
        }))
        return bundle.world.id
      },
      updateWorld: (worldId, patch) => patchBundle(set, worldId, (b) => ({ ...b, world: { ...b.world, ...patch } })),
      deleteWorld: (worldId) =>
        set((s) => {
          const bundles = { ...s.bundles }
          delete bundles[worldId]
          const order = s.order.filter((id) => id !== worldId)
          return {
            bundles,
            order,
            currentWorldId: s.currentWorldId === worldId ? (order[0] ?? null) : s.currentWorldId,
            view: s.currentWorldId === worldId ? 'home' : s.view,
          }
        }),

      addTeam: (worldId, pt) =>
        patchBundle(set, worldId, (b) => {
          const team = makeTeam(worldId, pt)
          const agents = { ...b.agents }
          for (const pa of pt.agents.filter((a) => a.include)) {
            const ag = makeAgent(worldId, team, pa.name, pa.role)
            agents[ag.id] = ag
            team.agentIds.push(ag.id)
          }
          if (team.agentIds.length === 0) {
            const ag = makeAgent(worldId, team, `${team.name} Agent`, team.description ?? 'Team member')
            agents[ag.id] = ag
            team.agentIds.push(ag.id)
          }
          return syncWorldIndex({ ...b, teams: { ...b.teams, [team.id]: team }, agents })
        }),
      updateTeam: (worldId, teamId, patch) =>
        patchBundle(set, worldId, (b) => {
          const t = b.teams[teamId]
          if (!t) return b
          const teams = { ...b.teams, [teamId]: { ...t, ...patch } }
          // Keep agent accents in sync with the team colour.
          let agents = b.agents
          if (patch.color) {
            agents = { ...b.agents }
            for (const id of t.agentIds) if (agents[id]) agents[id] = { ...agents[id], appearance: { ...agents[id].appearance, accent: patch.color } }
          }
          return { ...b, teams, agents }
        }),
      removeTeam: (worldId, teamId) =>
        patchBundle(set, worldId, (b) => {
          const teams = { ...b.teams }
          const agents = { ...b.agents }
          for (const id of teams[teamId]?.agentIds ?? []) delete agents[id]
          delete teams[teamId]
          return syncWorldIndex({ ...b, teams, agents })
        }),
      addAgent: (worldId, agent) =>
        patchBundle(set, worldId, (b) => {
          const team = b.teams[agent.teamId]
          if (!team) return b
          return syncWorldIndex({
            ...b,
            agents: { ...b.agents, [agent.id]: agent },
            teams: { ...b.teams, [team.id]: { ...team, agentIds: [...team.agentIds, agent.id] } },
          })
        }),
      updateAgent: (worldId, agentId, patch) =>
        patchBundle(set, worldId, (b) => (b.agents[agentId] ? { ...b, agents: { ...b.agents, [agentId]: { ...b.agents[agentId], ...patch } } } : b)),
      removeAgent: (worldId, agentId) =>
        patchBundle(set, worldId, (b) => {
          const a = b.agents[agentId]
          if (!a) return b
          const agents = { ...b.agents }
          delete agents[agentId]
          const team = b.teams[a.teamId]
          const teams = team ? { ...b.teams, [team.id]: { ...team, agentIds: team.agentIds.filter((x) => x !== agentId) } } : b.teams
          return syncWorldIndex({ ...b, agents, teams })
        }),

      addPermissions: (worldId, rules) =>
        patchBundle(set, worldId, (b) => {
          // New rules replace older ones for the same team + action.
          const keep = b.permissions.filter((p) => !rules.some((r) => r.teamId === p.teamId && r.action === p.action))
          return { ...b, permissions: [...keep, ...rules] }
        }),
      removePermission: (worldId, ruleId) => patchBundle(set, worldId, (b) => ({ ...b, permissions: b.permissions.filter((p) => p.id !== ruleId) })),
      toggleTool: (worldId, toolId) =>
        patchBundle(set, worldId, (b) => {
          const tools = { ...b.tools }
          if (tools[toolId]) delete tools[toolId]
          else {
            const t = TOOL_CATALOG.find((x) => x.id === toolId)
            if (t) tools[toolId] = { ...t }
          }
          return syncWorldIndex({ ...b, tools })
        }),
      updateTool: (worldId, toolId, patch) =>
        patchBundle(set, worldId, (b) => (b.tools[toolId] ? { ...b, tools: { ...b.tools, [toolId]: { ...b.tools[toolId], ...patch } } } : b)),
      updateRuntime: (worldId, patch) => patchBundle(set, worldId, (b) => ({ ...b, runtime: { ...b.runtime, ...patch } })),

      interruptActiveTasks: (worldId) =>
        patchBundle(set, worldId, (b) => ({ ...b, tasks: b.tasks.map(interrupt) })),

      log: (worldId, entry) =>
        set((s) => {
          const list = s.activity[worldId] ?? []
          const next = [{ ...entry, id: uid('act'), at: Date.now() }, ...list].slice(0, MAX_ACTIVITY)
          return { activity: { ...s.activity, [worldId]: next } }
        }),

      applyEvent: (worldId, e) => {
        const b = get().bundles[worldId]
        if (!b) return
        const log = (text: string, kind: ActivityEntry['kind'], extra: Partial<ActivityEntry> = {}) => get().log(worldId, { text, kind, ...extra })
        const teamName = (id?: string) => (id && b.teams[id]?.name) || 'Brain'
        const updateTask = (taskId: string, patch: Partial<WorldBundle['tasks'][number]>) =>
          patchBundle(set, worldId, (bb) => ({
            ...bb,
            tasks: bb.tasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: Date.now() } : t)),
          }))
        const task = 'taskId' in e ? b.tasks.find((t) => t.id === e.taskId) : undefined

        switch (e.event) {
          case 'task.created':
            patchBundle(set, worldId, (bb) => ({ ...bb, tasks: [e.task, ...bb.tasks].slice(0, MAX_TASKS) }))
            log(`New task: ${e.task.title}`, 'task', { teamId: e.task.sourceDepartment })
            break
          case 'task.assigned':
            updateTask(e.taskId, { assignedAgent: e.agentId })
            break
          case 'task.started':
            updateTask(e.taskId, { status: 'in_progress' })
            break
          case 'task.waiting':
            updateTask(e.taskId, { status: 'waiting' })
            log(`Needs your approval: ${task?.title ?? 'task'} — ${e.reason}`, 'warning', { teamId: task?.targetDepartment })
            break
          case 'task.approved':
            updateTask(e.taskId, { status: 'in_progress', approval: undefined })
            log(`Approved: ${task?.title ?? 'task'}`, 'info')
            break
          case 'task.rejected':
            updateTask(e.taskId, { status: 'failed', result: e.reason ?? 'Rejected', approval: undefined })
            log(`Rejected: ${task?.title ?? 'task'}`, 'warning')
            break
          case 'task.completed': {
            updateTask(e.taskId, { status: 'completed', result: e.result, tokens: e.tokens })
            if (task) {
              const ag = b.agents[task.assignedAgent]
              if (ag)
                get().updateAgent(worldId, ag.id, { tokensUsed: ag.tokensUsed + (e.tokens ?? 0), tasksCompleted: ag.tasksCompleted + 1 })
            }
            log(`Completed: ${task?.title ?? 'task'}`, 'success', { teamId: task?.targetDepartment })
            break
          }
          case 'task.failed':
            updateTask(e.taskId, { status: 'failed', result: e.error })
            log(`Failed: ${task?.title ?? 'task'} — ${e.error ?? 'unknown error'}`, 'error', { teamId: task?.sourceDepartment })
            break
          case 'knowledge.created':
            patchBundle(set, worldId, (bb) => ({ ...bb, knowledge: [...bb.knowledge, e.node].slice(-MAX_KNOWLEDGE) }))
            log(`Brain learned “${e.node.label}” from ${teamName(e.node.departmentId)}`, 'knowledge', { teamId: e.node.departmentId })
            break
          case 'knowledge.connected':
            patchBundle(set, worldId, (bb) => ({
              ...bb,
              edges: [...bb.edges, { source: e.source, target: e.target, strength: e.strength ?? 0.5 }].slice(-MAX_EDGES),
            }))
            break
          case 'agent.error':
            log(`${b.agents[e.agentId]?.name ?? 'Agent'} hit a problem: ${e.message ?? 'error'}`, 'error', { agentId: e.agentId })
            break
          case 'agent.created':
            log(`${b.agents[e.agentId]?.name ?? 'Agent'} joined ${teamName(e.department)}`, 'info')
            break
          default:
            break
        }
      },
    }),
    {
      name: 'ai-worlds/v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ bundles: s.bundles, order: s.order, currentWorldId: s.currentWorldId, advanced: s.advanced }),
      version: 1,
      // A reload ends every simulated run, so nothing should stay "in progress" afterwards.
      merge: (persisted, current) => {
        const p = persisted as Partial<WorldState> | undefined
        if (!p?.bundles) return current
        const bundles: Record<string, WorldBundle> = {}
        for (const [id, b] of Object.entries(p.bundles)) bundles[id] = b.runtime.eventSource === 'simulated' ? { ...b, tasks: b.tasks.map(interrupt) } : b
        return { ...current, ...p, bundles }
      },
    },
  ),
)

export const useCurrentBundle = () => useWorld((s) => (s.currentWorldId ? s.bundles[s.currentWorldId] : undefined))
