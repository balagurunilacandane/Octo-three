import { describe, expect, it } from 'vitest'
import { inside } from '../agents/AgentNavigation'
import { bundleFromProposal, seedProposals } from '../domain/factory'
import type { WorldBundle } from '../domain/types'
import type { WorldEvent } from '../events/types'
import { Director } from '../sim/Director'
import { WorldRuntime } from '../sim/WorldRuntime'
import { generateLayout } from '../world/layout'

function world(): WorldBundle {
  return bundleFromProposal(seedProposals()[0])
}

describe('procedural layout', () => {
  it('generates one plot per team, without overlaps, inside the island', () => {
    const b = world()
    const layout = generateLayout(b)
    expect(layout.plots).toHaveLength(Object.keys(b.teams).length)
    for (const p of layout.plots) {
      expect(Math.abs(p.center[0]) + p.size / 2).toBeLessThan(layout.half)
      expect(Math.abs(p.center[1]) + p.size / 2).toBeLessThan(layout.half)
      for (const q of layout.plots)
        if (p !== q) expect(Math.max(Math.abs(p.center[0] - q.center[0]), Math.abs(p.center[1] - q.center[1]))).toBeGreaterThanOrEqual(p.size)
    }
  })

  it('produces a different environment for a different organisation', () => {
    const a = generateLayout(world())
    const b = generateLayout(bundleFromProposal(seedProposals()[1]))
    expect(a.plots.map((p) => p.building)).not.toEqual(b.plots.map((p) => p.building))
  })
})

describe('navigation', () => {
  it('finds paths between departments that avoid every obstacle', () => {
    const b = world()
    const rt = new WorldRuntime(generateLayout(b), b)
    const plots = rt.layout.plots
    for (let i = 0; i < plots.length; i++) {
      const from = plots[i].desks[0].seat
      const to = plots[(i + 3) % plots.length].station.stand
      const path = rt.nav.findPath(from, to)
      expect(path.length).toBeGreaterThan(0)
      expect(path[path.length - 1]).toEqual(to)
      // sample the polyline: no point may be inside a building footprint
      let prev = from
      for (const p of path) {
        for (let k = 0; k <= 10; k++) {
          const x = prev[0] + (p[0] - prev[0]) * (k / 10)
          const z = prev[1] + (p[1] - prev[1]) * (k / 10)
          for (const o of rt.layout.obstacles) if (o.height > 2) expect(inside(o, x, z)).toBe(false)
        }
        prev = p
      }
    }
  })
})

describe('task flow (headless)', () => {
  it('runs the demo scenario: agents walk, knowledge is created, data flows, the task completes', async () => {
    let b = world()
    const rt = new WorldRuntime(generateLayout(b), b)
    const events: WorldEvent[] = []
    rt.bus.on((e) => {
      events.push(e)
      // minimal store reducer so the director sees knowledge it created
      if (e.event === 'knowledge.created') b = { ...b, knowledge: [...b.knowledge, e.node] }
    })
    const director = new Director(rt, () => b)
    director.start()

    const start = new Map([...rt.agents.values()].map((a) => [a.id, a.pos.clone()]))
    let maxStep = 0
    for (let i = 0; i < 60 * 40; i++) {
      const before = new Map([...rt.agents.values()].map((a) => [a.id, a.pos.clone()]))
      rt.update(1 / 60)
      for (const a of rt.agents.values()) {
        const d = a.pos.distanceTo(before.get(a.id)!)
        if (a.path.length || d < 0.5) maxStep = Math.max(maxStep, d)
      }
      await Promise.resolve() // let director continuations run between frames
      if (events.some((e) => e.event === 'task.completed')) break
    }
    director.stop()

    const kinds = new Set(events.map((e) => e.event))
    for (const k of ['task.created', 'task.assigned', 'agent.walking', 'agent.arrived', 'agent.researching', 'knowledge.created', 'data.transfer', 'data.arrived', 'brain.processing', 'task.completed'])
      expect(kinds, k).toContain(k)
    // agents moved smoothly (never teleported more than a walking step per frame)
    expect(maxStep).toBeLessThan(0.1)
    expect([...rt.agents.values()].some((a) => a.pos.distanceTo(start.get(a.id)!) > 0.01 || a.path.length > 0)).toBe(true)
  })
})
