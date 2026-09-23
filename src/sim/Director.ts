import { archetypeForTeam, type RequestPlan } from '../domain/planner'
import { hash01, uid } from '../domain/ids'
import type { Task, WorldBundle } from '../domain/types'
import type { WorldEvent } from '../events/types'
import type { AgentRuntime, WorldRuntime } from './WorldRuntime'

// ─────────────────────────────────────────────────────────────────────────────
// The Director is the built-in simulated backend. It decides what the AI
// organisation does and expresses every decision as a WorldEvent on the bus —
// exactly what a real orchestration backend would stream. Swap it for a
// WebSocket/SSE source and the renderer behaves identically.
// ─────────────────────────────────────────────────────────────────────────────

interface FlowOptions {
  source: string
  target: string
  title: string
  request?: string
  approval?: Task['approval']
  userIssued?: boolean
}

const RESULT_TEMPLATES = [
  (t: string, team: string) => `${team} finished “${t}”. Key findings summarised with 3 recommended next steps.`,
  (t: string, team: string) => `Draft ready for “${t}”. ${team} attached a short report and sources.`,
  (t: string, team: string) => `“${t}” complete. ${team} highlighted 2 risks and 4 opportunities.`,
]

export class Director {
  private abort = new AbortController()
  private running = 0
  private started = false

  constructor(
    private rt: WorldRuntime,
    private getBundle: () => WorldBundle | undefined,
  ) {}

  private get signal() {
    return this.abort.signal
  }

  private emit(e: WorldEvent) {
    this.rt.bus.emit(e)
  }

  private wait(sec: number) {
    return this.rt.wait(sec, this.signal)
  }

  private arrived(agentId: string) {
    return this.rt.bus.waitFor((e) => e.event === 'agent.arrived' && e.agentId === agentId, this.signal)
  }

  private async walk(a: AgentRuntime, to: Extract<WorldEvent, { event: 'agent.walking' }>['to']) {
    const done = this.arrived(a.id)
    this.emit({ event: 'agent.walking', agentId: a.id, to })
    await done
  }

  private async transfer(from: Parameters<WorldRuntime['endpointPos']>[0], to: Parameters<WorldRuntime['endpointPos']>[0], dataType: 'research' | 'insight' | 'result' | 'message' | 'alert') {
    const id = this.rt.nextTransferId()
    const done = this.rt.bus.waitFor((e) => e.event === 'data.arrived' && e.transferId === id, this.signal)
    this.emit({ event: 'data.transfer', transferId: id, from, to, dataType })
    await done
  }

  start() {
    if (this.started) return
    this.started = true
    this.guard(this.ambientLoop())
    this.guard(this.autonomyLoop())
  }

  stop() {
    this.abort.abort()
    this.abort = new AbortController()
    this.started = false
    for (const a of this.rt.agents.values()) a.busy = false
  }

  private guard(p: Promise<unknown>) {
    p.catch((err) => {
      if ((err as DOMException)?.name !== 'AbortError') console.error('[director]', err)
    })
  }

  private teams() {
    return this.rt.layout.plots.map((p) => p.teamId)
  }

  private async claimAgent(teamId: string, timeoutSec = 25, avoid?: string): Promise<AgentRuntime | null> {
    const t0 = this.rt.time
    while (this.rt.time - t0 < timeoutSec) {
      const idle = this.rt.idleAgents(teamId).filter((a) => a.id !== avoid)
      if (idle.length) {
        const a = idle[Math.floor(Math.random() * idle.length)]
        a.busy = true
        return a
      }
      await this.wait(0.5)
    }
    return null
  }

  // ─── ambient life: micro-states and casual collaboration ─────────────────
  private async ambientLoop() {
    for (;;) {
      await this.wait(0.6)
      for (const a of this.rt.agents.values()) {
        if (a.busy || a.path.length || !a.seated) continue
        if (a.stateTime < 2.5 + a.offset * 4) continue
        const r = Math.random()
        if (r < 0.08) {
          const next = a.state === 'working' ? (Math.random() < 0.5 ? 'thinking' : 'idle') : 'working'
          this.emit({ event: next === 'working' ? 'agent.working' : next === 'thinking' ? 'agent.thinking' : 'agent.idle', agentId: a.id })
        }
      }
      if (Math.random() < 0.05) this.guard(this.chat())
    }
  }

  private async chat() {
    const all = [...this.rt.agents.values()].filter((a) => !a.busy && !a.path.length)
    if (all.length < 2) return
    const a = all[Math.floor(Math.random() * all.length)]
    const sameTeam = all.filter((b) => b.id !== a.id && b.teamId === a.teamId)
    const pool = Math.random() < 0.6 && sameTeam.length ? sameTeam : all.filter((b) => b.id !== a.id)
    const b = pool[Math.floor(Math.random() * pool.length)]
    a.busy = true
    b.busy = true
    try {
      await this.walk(a, { kind: 'agent', agentId: b.id })
      this.emit({ event: 'agent.communicating', agentId: a.id, withAgentId: b.id })
      this.emit({ event: 'agent.communicating', agentId: b.id, withAgentId: a.id })
      await this.transfer({ kind: 'agent', agentId: a.id }, { kind: 'agent', agentId: b.id }, 'message')
      await this.wait(1.2)
      await this.transfer({ kind: 'agent', agentId: b.id }, { kind: 'agent', agentId: a.id }, 'message')
      this.emit({ event: 'agent.working', agentId: b.id })
      await this.walk(a, { kind: 'desk' })
    } finally {
      a.busy = false
      b.busy = false
    }
  }

  // ─── autonomous work: the organisation keeps itself busy ────────────────
  private async autonomyLoop() {
    await this.wait(3.5)
    // First demo scenario: research → Brain → marketing (or the closest equivalents).
    const teams = this.teams()
    if (teams.length) {
      const bundle = this.getBundle()
      const find = (keys: string[]) => teams.find((id) => bundle && keys.includes(archetypeForTeam(bundle.teams[id]).key))
      const source = find(['research']) ?? teams[0]
      const target = find(['marketing', 'content', 'product']) ?? teams[teams.length - 1]
      this.guard(this.flow({ source, target, title: this.taskTitle(source) }))
    }
    for (;;) {
      const autonomy = this.getBundle()?.runtime.autonomy ?? 0.6
      await this.wait(4 + (1 - autonomy) * 14 + Math.random() * 4)
      if (autonomy <= 0.01) continue
      const ids = this.teams()
      if (ids.length === 0 || this.running >= Math.max(2, Math.ceil(ids.length / 2) + 1)) continue
      const source = ids[Math.floor(Math.random() * ids.length)]
      const others = ids.filter((t) => t !== source)
      const target = others.length && Math.random() < 0.8 ? others[Math.floor(Math.random() * others.length)] : source
      this.guard(this.flow({ source, target, title: this.taskTitle(source) }))
    }
  }

  private taskTitle(teamId: string) {
    const team = this.getBundle()?.teams[teamId]
    if (!team) return 'Complete work'
    const a = archetypeForTeam(team)
    return a.tasks[Math.floor(Math.random() * a.tasks.length)]
  }

  /** Run a natural-language request that the planner turned into steps. */
  runPlan(plan: RequestPlan, request: string) {
    const steps = plan.steps
    if (!steps.length) return
    this.guard(
      (async () => {
        if (steps.length === 1) {
          await this.flow({ source: steps[0].teamId, target: steps[0].teamId, title: plan.title, request, approval: plan.approval, userIssued: true })
          return
        }
        for (let i = 0; i < steps.length - 1; i++) {
          const last = i === steps.length - 2
          await this.flow({
            source: steps[i].teamId,
            target: steps[i + 1].teamId,
            title: last ? plan.title : steps[i].title,
            request,
            approval: last ? plan.approval : undefined,
            userIssued: true,
          })
        }
      })(),
    )
  }

  /**
   * One complete task/data flow:
   * task → agent stands → walks to station → researches → knowledge node →
   * data to Brain → Brain processes → insight to target team → target agent works →
   * (approval) → result returns to source → completion → agents return to desks.
   */
  async flow(o: FlowOptions) {
    const bundle = this.getBundle()
    if (!bundle || !bundle.teams[o.source] || !bundle.teams[o.target]) return
    this.running++
    const task: Task = {
      id: uid('task'),
      worldId: bundle.world.id,
      title: o.title,
      sourceDepartment: o.source,
      targetDepartment: o.target,
      assignedAgent: '',
      status: 'backlog',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      request: o.request,
      approval: o.approval,
    }
    let a: AgentRuntime | null = null
    let b: AgentRuntime | null = null
    try {
      this.emit({ event: 'task.created', task })
      await this.wait(0.8)
      a = await this.claimAgent(o.source)
      if (!a) {
        this.emit({ event: 'task.failed', taskId: task.id, error: 'No agent was available' })
        return
      }
      this.emit({ event: 'task.assigned', taskId: task.id, agentId: a.id })
      this.emit({ event: 'agent.task.started', agentId: a.id, taskId: task.id, department: o.source })
      this.emit({ event: 'task.started', taskId: task.id })
      this.emit({ event: 'agent.thinking', agentId: a.id })
      await this.wait(1)

      await this.walk(a, { kind: 'station', teamId: o.source })
      this.emit({ event: 'agent.researching', agentId: a.id, taskId: task.id })
      await this.wait(2 + Math.random() * 1.5)
      this.rt.releaseStation(o.source)

      if (!o.userIssued && Math.random() < 0.07) {
        this.emit({ event: 'agent.error', agentId: a.id, message: 'Source unavailable (rate limited)' })
        this.emit({ event: 'task.failed', taskId: task.id, error: 'Source unavailable (rate limited)' })
        await this.wait(2.5)
        await this.walk(a, { kind: 'desk' })
        return
      }

      // Knowledge enters the Brain from the department.
      const team = this.getBundle()?.teams[o.source]
      const arch = team ? archetypeForTeam(team) : undefined
      const label = arch ? arch.knowledge[Math.floor(Math.random() * arch.knowledge.length)] : 'Finding'
      const nodeId = uid('k')
      this.emit({
        event: 'knowledge.created',
        node: { id: nodeId, label: o.userIssued ? o.title.slice(0, 36) : label, departmentId: o.source, importance: 0.3 + Math.random() * 0.7, createdAt: Date.now() },
      })
      await this.transfer({ kind: 'team', teamId: o.source }, { kind: 'brain' }, 'research')
      this.connectKnowledge(nodeId, o.source)
      this.emit({ event: 'brain.processing', durationSec: 2 })
      await this.wait(1.8)

      if (o.target !== o.source) await this.transfer({ kind: 'brain' }, { kind: 'team', teamId: o.target }, 'insight')
      else await this.transfer({ kind: 'brain' }, { kind: 'team', teamId: o.source }, 'insight')

      b = o.target === o.source ? a : await this.claimAgent(o.target, 8)
      if (!b) b = a
      if (b !== a) {
        this.emit({ event: 'agent.communicating', agentId: b.id })
        await this.wait(0.6)
      }
      await this.walk(b, { kind: 'station', teamId: o.target })
      this.emit({ event: 'agent.working', agentId: b.id, taskId: task.id })
      await this.wait(2 + Math.random())

      if (o.approval) {
        this.emit({ event: 'task.waiting', taskId: task.id, reason: o.approval.reason })
        this.emit({ event: 'agent.waiting', agentId: b.id, taskId: task.id })
        const decision = await this.rt.bus.waitFor(
          (e) => (e.event === 'task.approved' || e.event === 'task.rejected') && e.taskId === task.id,
          this.signal,
        )
        if (decision.event === 'task.rejected') {
          this.rt.releaseStation(o.target)
          this.emit({ event: 'agent.idle', agentId: b.id })
          await this.wait(0.8)
          const back = [this.walk(a, { kind: 'desk' })]
          if (b !== a) back.push(this.walk(b, { kind: 'desk' }))
          await Promise.all(back)
          return
        }
        this.emit({ event: 'agent.working', agentId: b.id, taskId: task.id })
        await this.wait(1.2)
      }
      this.rt.releaseStation(o.target)

      if (o.target !== o.source) await this.transfer({ kind: 'team', teamId: o.target }, { kind: 'team', teamId: o.source }, 'result')

      const teamName = this.getBundle()?.teams[o.target]?.name ?? 'Team'
      const tokens = Math.round(800 + hash01(task.id) * 5200)
      const result = RESULT_TEMPLATES[Math.floor(Math.random() * RESULT_TEMPLATES.length)](o.title, teamName)
      this.emit({ event: 'task.completed', taskId: task.id, result, tokens })
      this.emit({ event: 'agent.completed', agentId: a.id, taskId: task.id })
      if (b !== a) this.emit({ event: 'agent.completed', agentId: b.id, taskId: task.id })
      await this.wait(1.5)

      const back = [this.walk(a, { kind: 'desk' })]
      if (b !== a) back.push(this.walk(b, { kind: 'desk' }))
      await Promise.all(back)
    } finally {
      this.running--
      if (a) a.busy = false
      if (b) b.busy = false
    }
  }

  private connectKnowledge(nodeId: string, teamId: string) {
    const nodes = this.getBundle()?.knowledge ?? []
    const same = nodes.filter((n) => n.departmentId === teamId && n.id !== nodeId)
    const other = nodes.filter((n) => n.departmentId !== teamId)
    const picks = [same[same.length - 1], other[Math.floor(Math.random() * other.length)], nodes[Math.floor(Math.random() * nodes.length)]]
    const seen = new Set<string>()
    for (const p of picks) {
      if (!p || p.id === nodeId || seen.has(p.id)) continue
      seen.add(p.id)
      this.emit({ event: 'knowledge.connected', source: nodeId, target: p.id, strength: 0.3 + Math.random() * 0.7 })
    }
  }
}
