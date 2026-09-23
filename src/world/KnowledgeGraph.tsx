import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { hash01 } from '../domain/ids'
import { useWorld } from '../state/worldStore'
import { G, mutedAccent } from './materials'
import { useRuntime } from './RuntimeContext'

const MAX_NODES = 200
const MAX_EDGES = 360
const SPARKS = 14
const dummy = new THREE.Object3D()
const white = new THREE.Color('#ffffff')
const tmpC = new THREE.Color()

/**
 * The Brain's knowledge as a living graph: nodes cluster toward the department
 * that produced them, important nodes are larger, new nodes flash, edges glow
 * and energy sparks travel along connections.
 */
export function KnowledgeGraph({ radius = 1.0 }: { radius?: number }) {
  const { runtime } = useRuntime()
  const worldId = runtime.worldId
  const nodes = useWorld((s) => s.bundles[worldId]?.knowledge)
  const edges = useWorld((s) => s.bundles[worldId]?.edges)

  const nodeMesh = useRef<THREE.InstancedMesh>(null)
  const sparkMesh = useRef<THREE.InstancedMesh>(null)
  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_EDGES * 6), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_EDGES * 6), 3))
    return g
  }, [])
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  )

  // Stable base positions: biased toward the producing department's direction.
  const layout = useMemo(() => {
    const list = (nodes ?? []).slice(-MAX_NODES)
    const index = new Map<string, number>()
    const base: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    list.forEach((n, i) => {
      index.set(n.id, i)
      const plot = runtime.layout.plotById[n.departmentId]
      const dir = plot ? new THREE.Vector3(plot.center[0], 0, plot.center[1]).normalize() : new THREE.Vector3()
      const r = new THREE.Vector3(hash01(n.id, 1) - 0.5, hash01(n.id, 2) - 0.5, hash01(n.id, 3) - 0.5).multiplyScalar(1.6)
      const p = dir.multiplyScalar(0.55).add(r)
      if (p.lengthSq() < 0.01) p.set(0.2, 0.1, 0)
      p.setLength(radius * (0.35 + 0.6 * hash01(n.id, 4)))
      base.push(p)
      colors.push(new THREE.Color(mutedAccent(plot?.color ?? '#9fd8cf')).lerp(white, 0.35))
    })
    const e = (edges ?? [])
      .map((ed) => [index.get(ed.source), index.get(ed.target), ed.strength] as const)
      .filter((x): x is readonly [number, number, number] => x[0] !== undefined && x[1] !== undefined)
      .slice(-MAX_EDGES)
    return { list, base, colors, edges: e }
  }, [nodes, edges, runtime.layout, radius])

  const current = useRef<THREE.Vector3[]>([])
  const sparks = useRef(Array.from({ length: SPARKS }, () => ({ edge: 0, t: Math.random(), speed: 0.4 + Math.random() * 0.8 })))

  useEffect(() => {
    current.current = layout.base.map((p) => p.clone())
    if (nodeMesh.current) nodeMesh.current.count = layout.list.length
    lineGeom.setDrawRange(0, layout.edges.length * 2)
  }, [layout, lineGeom])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const now = Date.now()
    const mesh = nodeMesh.current
    if (!mesh) return
    const boost = runtime.brainBoost
    layout.list.forEach((n, i) => {
      const b = layout.base[i]
      const p = current.current[i]
      if (!p) return
      const o = i * 1.37
      p.set(b.x + Math.sin(t * 0.7 + o) * 0.04, b.y + Math.cos(t * 0.9 + o) * 0.05, b.z + Math.sin(t * 0.5 + o * 2) * 0.04)
      const age = (now - n.createdAt) / 1000
      const fresh = age < 2.5 ? 1 - age / 2.5 : 0
      const pulse = 1 + Math.sin(t * 3 + o) * 0.15 + boost * 0.3
      dummy.position.copy(p)
      dummy.scale.setScalar((0.035 + n.importance * 0.05) * pulse * (1 + fresh * 1.6))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      tmpC.copy(layout.colors[i]).lerp(white, fresh * 0.8).multiplyScalar(1 + fresh * 0.8 + boost * 0.3)
      mesh.setColorAt(i, tmpC)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    const pos = lineGeom.attributes.position as THREE.BufferAttribute
    const col = lineGeom.attributes.color as THREE.BufferAttribute
    layout.edges.forEach(([a, b, s], i) => {
      const pa = current.current[a]
      const pb = current.current[b]
      if (!pa || !pb) return
      pos.setXYZ(i * 2, pa.x, pa.y, pa.z)
      pos.setXYZ(i * 2 + 1, pb.x, pb.y, pb.z)
      const k = 0.35 + s * 0.65
      col.setXYZ(i * 2, layout.colors[a].r * k, layout.colors[a].g * k, layout.colors[a].b * k)
      col.setXYZ(i * 2 + 1, layout.colors[b].r * k, layout.colors[b].g * k, layout.colors[b].b * k)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
    lineMat.opacity = 0.28 + Math.sin(t * 1.5) * 0.08 + boost * 0.2

    // energy sparks travelling across edges
    const sm = sparkMesh.current
    if (sm) {
      const ne = layout.edges.length
      sparks.current.forEach((sp, i) => {
        sp.t += 0.016 * sp.speed * (1 + boost * 2)
        if (sp.t >= 1 || sp.edge >= ne) {
          sp.t = 0
          sp.edge = ne ? Math.floor(Math.random() * ne) : 0
        }
        const e = layout.edges[sp.edge]
        if (!e || !current.current[e[0]] || !current.current[e[1]]) {
          dummy.scale.setScalar(0)
        } else {
          dummy.position.lerpVectors(current.current[e[0]], current.current[e[1]], sp.t)
          dummy.scale.setScalar(0.025)
        }
        dummy.updateMatrix()
        sm.setMatrixAt(i, dummy.matrix)
      })
      sm.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <instancedMesh ref={nodeMesh} args={[G.sphereLo, undefined, MAX_NODES]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments geometry={lineGeom} material={lineMat} frustumCulled={false} />
      <instancedMesh ref={sparkMesh} args={[G.sphereLo, undefined, SPARKS]} frustumCulled={false}>
        <meshBasicMaterial color="#f2f5f5" />
      </instancedMesh>
    </group>
  )
}
