import * as THREE from 'three'
import type { AgentState, WorldBundle } from '../domain/types'
import { EventBus } from '../events/eventBus'
import { DATA_COLORS, STATE_FROM_EVENT, type AgentLocation, type DataEndpoint, type DataType, type WorldEvent } from '../events/types'
import { NavGrid } from '../agents/AgentNavigation'
import { localToWorld, type DeskSpot, type V2, type WorldLayout } from '../world/layout'

// ─────────────────────────────────────────────────────────────────────────────
// WorldRuntime holds all high-frequency simulation state for one mounted World:
// agent positions/paths/animation states, data packets, department activity and
// the Brain pulse. It lives entirely outside React: components read it from
// useFrame, and it is driven by WorldEvents from the bus (simulated or backend).
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentBody {
  /** Called every frame with the desired displacement; returns the collision-corrected displacement. */
  move: (desired: THREE.Vector3) => THREE.Vector3
  teleport: (p: THREE.Vector3) => void
}

export interface AgentRuntime {
  id: string
  teamId: string
  home: DeskSpot | null
  homeFallback: V2
  pos: THREE.Vector3
  heading: number
  targetHeading: number
  state: AgentState
  /** State to enter once the current walk finishes. */
  arriveState: AgentState
  stateTime: number
  path: V2[]
  speed: number
  offset: number
  busy: boolean
  seated: boolean
  /** Whether the current walk ends in a seat. */
  willSit: boolean
  /** Smoothed 0..1 seat blend used by the animator */
  sit: number
  walkPhase: number
  stuckTime: number
  arriveFacing: number | null
  lookAtAgent: string | null
  currentTaskId: string | null
  body: AgentBody | null
  flash: number
}

export interface Transfer {
  id: string
  curve: THREE.CatmullRomCurve3
  t: number
  duration: number
  color: THREE.Color
  dataType: DataType
}

interface Timer {
  at: number
  resolve: () => void
}

const BRAIN_CORE: [number, number, number] = [0, 2.5, 0]
const MAX_TASKS_PER_TEAM = 3

export class WorldRuntime {
  readonly bus = new EventBus()
  readonly nav: NavGrid
  readonly agents = new Map<string, AgentRuntime>()
  readonly transfers: Transfer[] = []
  readonly worldId: string
  time = 0
  brainBoost = 0
  brainFlash = 0
  paused = false
  /** Simulation speed multiplier (debug: `?timescale=4`). */
  timeScale = Number(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('timescale') : 1) || 1

  private timers: Timer[] = []
  private activity = new Map<string, { value: number; override: number | null; attention: number }>()
  private tasks = new Map<string, { source: string; target: string; status: string }>()
  private stationUse = new Map<string, number>()
  private transferSeq = 0
  private off: () => void
  private tmp = new THREE.Vector3()

  constructor(
    readonly layout: WorldLayout,
    bundle: WorldBundle,
    maxAgentsPerTeam = 8,
  ) {
    this.worldId = bundle.world.id
    this.nav = new NavGrid(layout)
    for (const plot of layout.plots) {
      this.activity.set(plot.teamId, { value: 0.15, override: null, attention: 0 })
      const team = bundle.teams[plot.teamId]
      team.agentIds.slice(0, maxAgentsPerTeam).forEach((agentId, i) => {
        const home = plot.desks[i] ?? null
        const fallback = localToWorld(plot.center, (i % 2 ? 1 : -1) * (0.8 + (i % 3) * 0.6), 3.7)
        const p = home?.seat ?? fallback
        const offset = hashOffset(agentId)
        this.agents.set(agentId, {
          id: agentId,
          teamId: plot.teamId,
          home,
          homeFallback: fallback,
          pos: new THREE.Vector3(p[0], layout.heightAt(p[0], p[1]), p[1]),
          heading: home?.facing ?? plot.rot,
          targetHeading: home?.facing ?? plot.rot,
          state: offset > 0.5 ? 'working' : 'idle',
          arriveState: 'idle',
          stateTime: offset * 5,
          path: [],
          speed: 1.55 + offset * 0.5,
          offset,
          busy: false,
          seated: !!home,
          willSit: false,
          sit: home ? 1 : 0,
          walkPhase: offset * Math.PI * 2,
          stuckTime: 0,
          arriveFacing: null,
          lookAtAgent: null,
          currentTaskId: null,
          body: null,
          flash: 0,
        })
      })
    }
    this.off = this.bus.on((e) => this.react(e))
  }

  dispose() {
    this.off()
    this.timers = []
  }

  // ─── time ───────────────────────────────────────────────────────────────
  wait(sec: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      this.timers.push({ at: this.time + sec, resolve })
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  }

  // ─── queries ────────────────────────────────────────────────────────────
  activityOf(teamId: string) {
    return this.activity.get(teamId)?.value ?? 0
  }

  attentionOf(teamId: string) {
    return this.activity.get(teamId)?.attention ?? 0
  }

  activeTasksOf(teamId: string) {
    let n = 0
    for (const t of this.tasks.values()) if (t.source === teamId || t.target === teamId) n++
    return n
  }

  idleAgents(teamId: string) {
    return [...this.agents.values()].filter((a) => a.teamId === teamId && !a.busy && a.path.length === 0)
  }

  seatOf(a: AgentRuntime): { p: V2; facing: number } {
    return a.home ? { p: a.home.seat, facing: a.home.facing } : { p: a.homeFallback, facing: Math.PI / 4 }
  }

  // ─── event reactions (the renderer contract) ───────────────────────────
  private react(e: WorldEvent) {
    const agent = 'agentId' in e ? this.agents.get(e.agentId) : undefined
    const nextState = STATE_FROM_EVENT[e.event]

    switch (e.event) {
      case 'agent.walking':
        if (agent) this.walk(agent, e.to)
        return
      case 'agent.communicating':
        if (agent) {
          this.setState(agent, 'communicating')
          agent.lookAtAgent = e.withAgentId ?? null
        }
        return
      case 'agent.task.started':
        if (agent) agent.currentTaskId = e.taskId
        return
      case 'task.created':
        this.tasks.set(e.task.id, { source: e.task.sourceDepartment, target: e.task.targetDepartment, status: e.task.status })
        return
      case 'task.waiting': {
        const t = this.tasks.get(e.taskId)
        if (t) {
          t.status = 'waiting'
          const a = this.activity.get(t.target)
          if (a) a.attention = 1
        }
        return
      }
      case 'task.approved': {
        const t = this.tasks.get(e.taskId)
        if (t) {
          t.status = 'in_progress'
          const a = this.activity.get(t.target)
          if (a) a.attention = 0
        }
        return
      }
      case 'task.completed':
      case 'task.rejected':
      case 'task.failed': {
        const t = this.tasks.get(e.taskId)
        if (t && e.event === 'task.failed') {
          const a = this.activity.get(t.source)
          if (a) a.attention = 0.999 // decays → attention fades after a while
        }
        this.tasks.delete(e.taskId)
        for (const a of this.agents.values()) if (a.currentTaskId === e.taskId) a.currentTaskId = null
        return
      }
      case 'department.activity.changed': {
        const a = this.activity.get(e.department)
        if (a) a.override = e.activity
        return
      }
      case 'data.transfer':
        this.spawnTransfer(e.transferId, e.from, e.to, e.dataType)
        return
      case 'knowledge.created':
        this.brainFlash = 1
        return
      case 'brain.processing':
        this.brainBoost = Math.max(this.brainBoost, Math.min(1.5, e.durationSec / 2))
        return
      default:
        if (agent && nextState) {
          this.setState(agent, nextState)
          if (nextState === 'completed' || nextState === 'error') agent.flash = 1
          if (nextState === 'error') {
            const a = this.activity.get(agent.teamId)
            if (a) a.attention = 0.999
          }
        }
    }
  }

  private setState(a: AgentRuntime, s: AgentState) {
    if (a.path.length > 0 && s !== 'walking') {
      // Arriving state for a walk in progress.
      a.arriveState = s
      return
    }
    if (a.state !== s) {
      a.state = s
      a.stateTime = 0
    }
    if (s !== 'communicating') {
      a.lookAtAgent = null
      if (a.seated) a.targetHeading = this.seatOf(a).facing
    }
  }

  resolveLocation(a: AgentRuntime, to: AgentLocation): { p: V2; facing: number | null; seated: boolean } {
    switch (to.kind) {
      case 'desk': {
        const s = this.seatOf(a)
        return { p: s.p, facing: s.facing, seated: !!a.home }
      }
      case 'station': {
        const plot = this.layout.plotById[to.teamId]
        if (!plot) return { p: [a.pos.x, a.pos.z], facing: null, seated: false }
        const key = to.teamId
        const n = this.stationUse.get(key) ?? 0
        this.stationUse.set(key, n + 1)
        const slot = [0, -0.75, 0.75, -1.5, 1.5][n % 5]
        return { p: localToWorld(plot.center, slot, -0.1), facing: plot.station.facing, seated: false }
      }
      case 'brain': {
        const plot = this.layout.plotById[a.teamId]
        const d = plot?.dock ?? [this.layout.brain.radius, 0]
        const ang = Math.atan2(d[0], d[1]) + (a.offset - 0.5) * 0.5
        const r = this.layout.brain.radius - 0.4
        return { p: [Math.sin(ang) * r, Math.cos(ang) * r], facing: Math.atan2(-Math.sin(ang), -Math.cos(ang)), seated: false }
      }
      case 'agent': {
        const other = this.agents.get(to.agentId)
        if (!other) return { p: [a.pos.x, a.pos.z], facing: null, seated: false }
        const dx = a.pos.x - other.pos.x
        const dz = a.pos.z - other.pos.z
        const len = Math.hypot(dx, dz) || 1
        let p: V2 = [other.pos.x + (dx / len) * 0.95, other.pos.z + (dz / len) * 0.95]
        if (!this.nav.walkable(p[0], p[1])) {
          // Seated colleagues are behind desks — stand in the aisle beside them instead.
          const alt = [0.95, -0.95].map((s) => [other.pos.x + s * Math.SQRT1_2, other.pos.z + s * Math.SQRT1_2] as V2)
          p = alt.find((q) => this.nav.walkable(q[0], q[1])) ?? p
        }
        return { p, facing: Math.atan2(other.pos.x - p[0], other.pos.z - p[1]), seated: false }
      }
      case 'team': {
        const plot = this.layout.plotById[to.teamId]
        if (!plot) return { p: [a.pos.x, a.pos.z], facing: null, seated: false }
        return { p: localToWorld(plot.center, (a.offset - 0.5) * 1.0, 1.9), facing: plot.rot + Math.PI, seated: false }
      }
    }
  }

  walk(a: AgentRuntime, to: AgentLocation) {
    const dest = this.resolveLocation(a, to)
    a.path = this.nav.findPath([a.pos.x, a.pos.z], dest.p)
    a.arriveFacing = dest.facing
    a.seated = false
    a.arriveState = to.kind === 'desk' ? (Math.random() > 0.4 ? 'working' : 'idle') : 'idle'
    a.willSit = dest.seated
    a.state = 'walking'
    a.stateTime = 0
    a.stuckTime = 0
    a.lookAtAgent = null
  }

  // ─── data packets ───────────────────────────────────────────────────────
  endpointPos(ep: DataEndpoint): THREE.Vector3 {
    if (ep.kind === 'brain') return new THREE.Vector3(...BRAIN_CORE)
    if (ep.kind === 'team') {
      const plot = this.layout.plotById[ep.teamId]
      return plot ? new THREE.Vector3(...plot.emitter) : new THREE.Vector3(...BRAIN_CORE)
    }
    const ag = this.agents.get(ep.agentId)
    return ag ? ag.pos.clone().add(new THREE.Vector3(0, 1.25, 0)) : new THREE.Vector3(...BRAIN_CORE)
  }

  private spawnTransfer(id: string, from: DataEndpoint, to: DataEndpoint, dataType: DataType) {
    const a = this.endpointPos(from)
    const b = this.endpointPos(to)
    const dist = a.distanceTo(b)
    const mid = a.clone().lerp(b, 0.5)
    mid.y = Math.max(a.y, b.y) + 0.8 + dist * 0.18
    const q1 = a.clone().lerp(mid, 0.5)
    q1.y = mid.y * 0.85 + a.y * 0.15
    const q2 = b.clone().lerp(mid, 0.5)
    q2.y = mid.y * 0.85 + b.y * 0.15
    const curve = new THREE.CatmullRomCurve3([a, q1, mid, q2, b], false, 'centripetal')
    this.transfers.push({
      id,
      curve,
      t: 0,
      duration: Math.max(0.9, dist / 7.5),
      color: new THREE.Color(DATA_COLORS[dataType]),
      dataType,
    })
  }

  nextTransferId() {
    return `tx-${this.worldId.slice(-4)}-${++this.transferSeq}`
  }

  // ─── frame update ───────────────────────────────────────────────────────
  update(dt: number) {
    if (this.paused) return
    dt = Math.min(dt, 0.1) * this.timeScale
    this.time += dt

    // timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time)
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.time)
        for (const t of due) t.resolve()
      }
    }

    // department activity
    for (const [teamId, a] of this.activity) {
      let target = a.override ?? Math.min(1, this.activeTasksOf(teamId) / MAX_TASKS_PER_TEAM)
      for (const ag of this.agents.values())
        if (ag.teamId === teamId && (ag.state === 'researching' || ag.state === 'working') && !ag.seated) target += 0.12
      target = Math.min(1, Math.max(0.08, target))
      a.value += (target - a.value) * Math.min(1, dt * 1.2)
      if (a.attention > 0 && a.attention < 1) a.attention = Math.max(0, a.attention - dt / 10)
    }

    this.brainBoost = Math.max(0, this.brainBoost - dt * 0.5)
    this.brainFlash = Math.max(0, this.brainFlash - dt * 1.2)

    // transfers
    for (let i = this.transfers.length - 1; i >= 0; i--) {
      const tr = this.transfers[i]
      tr.t += dt / tr.duration
      if (tr.t >= 1) {
        this.transfers.splice(i, 1)
        this.bus.emit({ event: 'data.arrived', transferId: tr.id })
      }
    }

    // agents
    for (const a of this.agents.values()) this.updateAgent(a, dt)
  }

  private updateAgent(a: AgentRuntime, dt: number) {
    a.stateTime += dt
    a.flash = Math.max(0, a.flash - dt * 0.8)
    const willSit = a.willSit

    if (a.path.length > 0) {
      const [tx, tz] = a.path[0]
      const dx = tx - a.pos.x
      const dz = tz - a.pos.z
      const dist = Math.hypot(dx, dz)
      const last = a.path.length === 1
      // Stand up first when leaving a desk.
      if (a.sit > 0.05) {
        a.sit = Math.max(0, a.sit - dt * 3)
        return
      }
      if (dist < (last ? 0.06 : 0.25)) {
        a.path.shift()
        if (a.path.length === 0) this.arrive(a, willSit)
      } else {
        const step = Math.min(dist, a.speed * dt)
        const desired = this.tmp.set((dx / dist) * step, 0, (dz / dist) * step)
        const moved = a.body ? a.body.move(desired) : desired
        const progress = Math.hypot(moved.x, moved.z)
        a.pos.x += moved.x
        a.pos.z += moved.z
        a.targetHeading = Math.atan2(dx, dz)
        a.walkPhase += progress * 6.2
        if (progress < step * 0.25) {
          a.stuckTime += dt
          if (a.stuckTime > 0.9) {
            // Blocked by physics: skip this waypoint (or finish, if it was the last one).
            a.stuckTime = 0
            a.path.shift()
            if (a.path.length === 0) this.arrive(a, willSit)
          }
        } else a.stuckTime = Math.max(0, a.stuckTime - dt)
      }
    } else {
      const target = a.seated ? 1 : 0
      a.sit += (target - a.sit) * Math.min(1, dt * 5)
      if (a.lookAtAgent) {
        const o = this.agents.get(a.lookAtAgent)
        if (o) a.targetHeading = Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z)
      }
    }
    a.pos.y = this.layout.heightAt(a.pos.x, a.pos.z)
    a.heading = lerpAngle(a.heading, a.targetHeading, Math.min(1, dt * 8))
  }

  private arrive(a: AgentRuntime, seated?: boolean) {
    a.seated = !!seated
    if (a.arriveFacing !== null) a.targetHeading = a.arriveFacing
    if (seated) {
      const s = this.seatOf(a)
      a.body?.teleport(new THREE.Vector3(s.p[0], a.pos.y, s.p[1]))
      a.pos.x = s.p[0]
      a.pos.z = s.p[1]
    }
    a.state = a.arriveState
    a.stateTime = 0
    this.bus.emit({ event: 'agent.arrived', agentId: a.id })
  }

  releaseStation(teamId: string) {
    const n = this.stationUse.get(teamId) ?? 0
    this.stationUse.set(teamId, Math.max(0, n - 1))
  }
}

function hashOffset(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

export function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}
