import type { Obstacle, V2, WorldLayout } from '../world/layout'

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight grid navigation. The grid is baked from the generated layout
// (buildings, desks, props, the Brain) so every World gets a nav mesh for free.
// A* finds a path, line-of-sight smoothing removes zig-zags. Physics (Rapier)
// then resolves any remaining contact while agents follow the path.
// ─────────────────────────────────────────────────────────────────────────────

export interface NavNode {
  id: string
  position: V2
  neighbors: string[]
}

const AGENT_RADIUS = 0.32

export class NavGrid {
  readonly cell: number
  readonly size: number
  readonly origin: number
  private blocked: Uint8Array

  constructor(layout: WorldLayout, cell = 0.5) {
    this.cell = cell
    this.origin = -layout.half
    this.size = Math.ceil((layout.half * 2) / cell)
    this.blocked = new Uint8Array(this.size * this.size)
    const margin = 1.0
    for (let iz = 0; iz < this.size; iz++) {
      for (let ix = 0; ix < this.size; ix++) {
        const [x, z] = this.toWorld(ix, iz)
        const edge = Math.abs(x) > layout.half - margin || Math.abs(z) > layout.half - margin
        if (edge || layout.obstacles.some((o) => inside(o, x, z, AGENT_RADIUS))) this.blocked[iz * this.size + ix] = 1
      }
    }
  }

  toCell(x: number, z: number): [number, number] {
    return [
      Math.max(0, Math.min(this.size - 1, Math.floor((x - this.origin) / this.cell))),
      Math.max(0, Math.min(this.size - 1, Math.floor((z - this.origin) / this.cell))),
    ]
  }

  toWorld(ix: number, iz: number): V2 {
    return [this.origin + (ix + 0.5) * this.cell, this.origin + (iz + 0.5) * this.cell]
  }

  isBlocked(ix: number, iz: number) {
    if (ix < 0 || iz < 0 || ix >= this.size || iz >= this.size) return true
    return this.blocked[iz * this.size + ix] === 1
  }

  walkable(x: number, z: number) {
    const [ix, iz] = this.toCell(x, z)
    return !this.isBlocked(ix, iz)
  }

  private nearestFree(ix: number, iz: number): [number, number] {
    if (!this.isBlocked(ix, iz)) return [ix, iz]
    for (let r = 1; r < 12; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
          if (!this.isBlocked(ix + dx, iz + dz)) return [ix + dx, iz + dz]
        }
    return [ix, iz]
  }

  /** A* over the 8-connected grid. Returns world-space waypoints ending exactly at `to`. */
  findPath(from: V2, to: V2): V2[] {
    const [sx, sz] = this.nearestFree(...this.toCell(from[0], from[1]))
    const [gx, gz] = this.nearestFree(...this.toCell(to[0], to[1]))
    const N = this.size
    const start = sz * N + sx
    const goal = gz * N + gx
    if (start === goal) return [to]

    const g = new Float32Array(N * N).fill(Infinity)
    const came = new Int32Array(N * N).fill(-1)
    const closed = new Uint8Array(N * N)
    const heap = new MinHeap()
    g[start] = 0
    heap.push(start, h(sx, sz, gx, gz))

    while (heap.size) {
      const cur = heap.pop()
      if (cur === goal) break
      if (closed[cur]) continue
      closed[cur] = 1
      const cx = cur % N
      const cz = (cur / N) | 0
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue
          const nx = cx + dx
          const nz = cz + dz
          if (this.isBlocked(nx, nz)) continue
          // No corner cutting past obstacles.
          if (dx && dz && (this.isBlocked(cx + dx, cz) || this.isBlocked(cx, cz + dz))) continue
          const ni = nz * N + nx
          if (closed[ni]) continue
          const cost = g[cur] + (dx && dz ? Math.SQRT2 : 1)
          if (cost < g[ni]) {
            g[ni] = cost
            came[ni] = cur
            heap.push(ni, cost + h(nx, nz, gx, gz))
          }
        }
    }
    if (came[goal] === -1) return [to] // unreachable — physics will stop the agent at the obstacle

    const cells: number[] = []
    for (let c = goal; c !== -1; c = came[c]) cells.push(c)
    cells.reverse()
    const pts = cells.map((c) => this.toWorld(c % N, (c / N) | 0))
    pts[0] = from
    const smooth = this.smooth(pts)
    smooth.push(to)
    return smooth.slice(1)
  }

  private lineOfSight(a: V2, b: V2) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    const steps = Math.ceil(d / (this.cell * 0.4))
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      if (!this.walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false
    }
    return true
  }

  private smooth(pts: V2[]): V2[] {
    if (pts.length <= 2) return pts
    const out: V2[] = [pts[0]]
    let anchor = 0
    for (let i = 2; i < pts.length; i++) {
      if (!this.lineOfSight(pts[anchor], pts[i])) {
        out.push(pts[i - 1])
        anchor = i - 1
      }
    }
    out.push(pts[pts.length - 1])
    return out
  }

  /** Graph view of the grid (for debugging / external planners). */
  toNodes(stride = 4): NavNode[] {
    const nodes: NavNode[] = []
    for (let iz = 0; iz < this.size; iz += stride)
      for (let ix = 0; ix < this.size; ix += stride) {
        if (this.isBlocked(ix, iz)) continue
        const neighbors: string[] = []
        for (const [dx, dz] of [[stride, 0], [-stride, 0], [0, stride], [0, -stride]])
          if (!this.isBlocked(ix + dx, iz + dz)) neighbors.push(`${ix + dx},${iz + dz}`)
        nodes.push({ id: `${ix},${iz}`, position: this.toWorld(ix, iz), neighbors })
      }
    return nodes
  }
}

function h(ax: number, az: number, bx: number, bz: number) {
  const dx = Math.abs(ax - bx)
  const dz = Math.abs(az - bz)
  return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)
}

export function inside(o: Obstacle, x: number, z: number, pad = 0) {
  const dx = x - o.c[0]
  const dz = z - o.c[1]
  if (o.r !== undefined) return dx * dx + dz * dz < (o.r + pad) ** 2
  // rotate into the obstacle frame (inverse of rotation.y = rot)
  const c = Math.cos(o.rot)
  const s = Math.sin(o.rot)
  const lx = c * dx - s * dz
  const lz = s * dx + c * dz
  return Math.abs(lx) < o.hx + pad && Math.abs(lz) < o.hz + pad
}

class MinHeap {
  private ids: number[] = []
  private keys: number[] = []
  get size() {
    return this.ids.length
  }
  push(id: number, key: number) {
    this.ids.push(id)
    this.keys.push(key)
    let i = this.ids.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.keys[p] <= this.keys[i]) break
      this.swap(i, p)
      i = p
    }
  }
  pop(): number {
    const top = this.ids[0]
    const lastId = this.ids.pop()!
    const lastKey = this.keys.pop()!
    if (this.ids.length) {
      this.ids[0] = lastId
      this.keys[0] = lastKey
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r
        if (m === i) break
        this.swap(i, m)
        i = m
      }
    }
    return top
  }
  private swap(a: number, b: number) {
    ;[this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]]
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
  }
}
