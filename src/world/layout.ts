import type { BuildingType, Team, WorldBundle } from '../domain/types'
import { archetypeForTeam } from '../domain/planner'
import { BUILDING_FOOTPRINTS } from './buildings/footprints'

// ─────────────────────────────────────────────────────────────────────────────
// Procedural world layout. The organisation (teams + agents) goes in, a spatial
// layout (plots, desks, stations, obstacles, docks) comes out. Nothing is hand
// placed: every World generates its own environment from its own data.
// ─────────────────────────────────────────────────────────────────────────────

export type V2 = [number, number] // [x, z]

export interface Obstacle {
  /** world centre */
  c: V2
  /** half extents in local frame */
  hx: number
  hz: number
  rot: number
  height: number
  /** circle obstacles ignore hx/hz and use r */
  r?: number
}

export interface DeskSpot {
  desk: V2
  seat: V2
  facing: number
}

export interface PlotLayout {
  teamId: string
  index: number
  center: V2
  size: number
  height: number
  rot: number
  building: BuildingType
  color: string
  icon: string
  name: string
  buildingPos: V2
  labelPos: [number, number, number]
  desks: DeskSpot[]
  station: { pos: V2; stand: V2; facing: number }
  plants: V2[]
  /** Where the glowing path leaves the plot toward the Brain. */
  gate: V2
  /** Point on the Brain ring for this team. */
  dock: V2
  /** Point in the world above the building where data packets emerge. */
  emitter: [number, number, number]
  /** Where the department's stat card floats (pushed away from the Brain). */
  cardPos: [number, number, number]
  /** Which side of the plot the card sits on, in screen terms. */
  cardSide: 'top' | 'bottom' | 'left' | 'right'
  /** Office style: a meeting table instead of a building. */
  table: V2 | null
}

export interface WorldLayout {
  key: string
  style: 'office' | 'campus'
  half: number
  plots: PlotLayout[]
  plotById: Record<string, PlotLayout>
  brain: { radius: number; coreRadius: number; height: number }
  obstacles: Obstacle[]
  heightAt: (x: number, z: number) => number
}

export const PLOT_SIZE = 9
export const PLOT_HEIGHT = 0.18
export const BRAIN_HEIGHT = 0.22
const SPACING = 11
const CONTENT_ROT = Math.PI / 4 // all departments face the camera (iso "front")
const S = Math.SQRT1_2

/** local (u, v) inside a plot → world offset. +v faces the camera, −v is the back corner. */
export function localToWorld(center: V2, u: number, v: number): V2 {
  return [center[0] + (u + v) * S, center[1] + (v - u) * S]
}

// Slot order chosen so any prefix reads as a balanced composition in the iso view.
// (−,−) is the top of the screen, (+,+) the bottom, (+,−) right, (−,+) left.
const RING_1: V2[] = [
  [-1, -1], [1, 1], [1, -1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0],
]
function ringSlots(n: number): V2[] {
  if (n <= 8) {
    // For 3 teams prefer a triangle-ish arrangement around the Brain.
    if (n === 3) return [[-1, -1], [1, 0], [0, 1]]
    if (n === 5) return [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1]]
    if (n === 6) return [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]
    return RING_1.slice(0, n)
  }
  const out = RING_1.slice()
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) if (Math.max(Math.abs(x), Math.abs(z)) === 2) out.push([x, z])
  return out.slice(0, n)
}

function deskSpots(center: V2, count: number): DeskSpot[] {
  const local: V2[] = [
    [-1.4, 0.9], [1.4, 0.9], [-2.9, 0.9], [2.9, 0.9],
    [-1.4, 2.7], [1.4, 2.7], [-2.7, 2.6], [2.7, 2.6],
  ]
  return local.slice(0, Math.min(count, local.length)).map(([u, v]) => ({
    desk: localToWorld(center, u, v),
    seat: localToWorld(center, u, v + 0.62),
    facing: CONTENT_ROT + Math.PI, // face the back of the plot (the monitor)
  }))
}

export function layoutKey(b: WorldBundle): string {
  return (b.world.theme ?? 'office') + '#' + Object.values(b.teams)
    .map((t) => `${t.id}:${t.buildingType}:${t.color}:${t.agentIds.length}`)
    .join('|')
}

export function generateLayout(b: WorldBundle): WorldLayout {
  const style = b.world.theme ?? 'office'
  const teams: Team[] = b.world.teams.map((id) => b.teams[id]).filter(Boolean)
  const slots = ringSlots(teams.length)
  const extent = Math.max(1, ...slots.map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))))
  const half = extent * SPACING + PLOT_SIZE / 2 + 1.6
  const obstacles: Obstacle[] = []
  const brain = { radius: 3.8, coreRadius: 2.1, height: BRAIN_HEIGHT }
  obstacles.push({ c: [0, 0], hx: 0, hz: 0, rot: 0, height: 3, r: brain.coreRadius + 0.2 })

  const plots: PlotLayout[] = teams.map((team, index) => {
    const [sx, sz] = slots[index]
    const center: V2 = [sx * SPACING, sz * SPACING]
    const arch = archetypeForTeam(team)
    const building: BuildingType = team.buildingType ?? arch.building
    const fp = BUILDING_FOOTPRINTS[building] ?? BUILDING_FOOTPRINTS.generic
    const buildingPos = localToWorld(center, 0, -2.6)
    const table = style === 'office' ? localToWorld(center, 0, -2.5) : null
    if (table) obstacles.push({ c: table, hx: 0, hz: 0, rot: 0, height: 0.8, r: 0.95 })
    else obstacles.push({ c: buildingPos, hx: fp.w / 2, hz: fp.d / 2, rot: CONTENT_ROT, height: fp.h })

    const desks = deskSpots(center, team.agentIds.length)
    for (const d of desks) obstacles.push({ c: d.desk, hx: 0.55, hz: 0.33, rot: CONTENT_ROT, height: 0.8 })

    const stationPos = localToWorld(center, 0, -0.75)
    obstacles.push({ c: stationPos, hx: 0.35, hz: 0.25, rot: CONTENT_ROT, height: 1.2 })

    const plants: V2[] = [localToWorld(center, -3.5, -1.0), localToWorld(center, 3.5, -1.0), localToWorld(center, -1.2, 4.3), localToWorld(center, 1.2, 4.3)]
    for (const p of plants) obstacles.push({ c: p, hx: 0, hz: 0, rot: 0, height: 0.8, r: 0.3 })

    // The gate is the plot edge closest to the Brain (or the front corner for the centre column).
    const len = Math.hypot(center[0], center[1]) || 1
    const dir: V2 = [-center[0] / len, -center[1] / len]
    const diagonal = Math.abs(dir[0]) > 0.2 && Math.abs(dir[1]) > 0.2
    const reach = (PLOT_SIZE / 2) * (diagonal ? Math.SQRT2 : 1) - 0.4
    const gate: V2 = [center[0] + dir[0] * reach, center[1] + dir[1] * reach]
    const dock: V2 = [-dir[0] * brain.radius, -dir[1] * brain.radius]

    return {
      teamId: team.id,
      index,
      center,
      size: PLOT_SIZE,
      height: PLOT_HEIGHT,
      rot: CONTENT_ROT,
      building,
      color: team.color ?? arch.color,
      icon: team.icon ?? arch.icon,
      name: team.name,
      buildingPos,
      labelPos: [buildingPos[0], fp.h + 1.4, buildingPos[1]],
      desks,
      station: { pos: stationPos, stand: localToWorld(center, 0, -0.1), facing: CONTENT_ROT + Math.PI },
      plants,
      gate,
      dock,
      emitter: table ? [table[0], 1.4, table[1]] : [buildingPos[0], fp.h + 0.4, buildingPos[1]],
      cardPos: [center[0] - dir[0] * 4.6, style === 'office' ? 0.6 : fp.h + 0.8, center[1] - dir[1] * 4.6],
      cardSide: cardSide(center),
      table,
    }
  })

  const plotById: Record<string, PlotLayout> = {}
  for (const p of plots) plotById[p.teamId] = p

  const heightAt = (x: number, z: number) => {
    const r = Math.hypot(x, z)
    if (r < brain.radius + 0.3) return BRAIN_HEIGHT * clamp01((brain.radius + 0.3 - r) / 0.5)
    for (const p of plots) {
      const dx = PLOT_SIZE / 2 + 0.25 - Math.abs(x - p.center[0])
      const dz = PLOT_SIZE / 2 + 0.25 - Math.abs(z - p.center[1])
      if (dx > 0 && dz > 0) return PLOT_HEIGHT * clamp01(Math.min(dx, dz) / 0.5)
    }
    return 0
  }

  return { key: layoutKey(b), style, half, plots, plotById, brain, obstacles, heightAt }
}

/** In the iso view world (+x,+z) points down-screen and (+x,−z) points right. */
function cardSide([x, z]: V2): PlotLayout['cardSide'] {
  const down = x + z
  const right = x - z
  if (Math.abs(down) >= Math.abs(right)) return down > 0 ? 'bottom' : 'top'
  return right > 0 ? 'right' : 'left'
}

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
