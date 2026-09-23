import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { hash01 } from '../domain/ids'
import { G, PALETTE, mutedAccent } from './materials'
import { useRuntime } from './RuntimeContext'

const DOTS_PER_ARC = 4
const dummy = new THREE.Object3D()
const p = new THREE.Vector3()

/** Dashed line material whose dashes can scroll (three's LineDashedMaterial has no offset). */
function scrollingDashes(params: THREE.LineDashedMaterialParameters) {
  const m = new THREE.LineDashedMaterial(params) as THREE.LineDashedMaterial & { offset: { value: number } }
  m.offset = { value: 0 }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDashOffset = m.offset
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float dashSize;', 'uniform float dashSize;\nuniform float uDashOffset;')
      .replace('mod( vLineDistance, totalSize )', 'mod( vLineDistance + uDashOffset, totalSize )')
  }
  return m
}

interface Arc {
  teamId: string
  curve: THREE.CatmullRomCurve3
  geometry: THREE.BufferGeometry
  material: ReturnType<typeof scrollingDashes>
  color: THREE.Color
  /** Integration lines leave the island toward the connected tools. */
  kind: 'brain' | 'integration' | 'peer'
}

function arc(a: THREE.Vector3, b: THREE.Vector3, lift: number) {
  const mid = a.clone().lerp(b, 0.5)
  mid.y = Math.max(a.y, b.y) + lift
  return new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(mid.y * 0.8 + a.y * 0.2), mid, b.clone().lerp(mid, 0.5).setY(mid.y * 0.8 + b.y * 0.2), b], false, 'centripetal')
}

/**
 * Dark lanes on the floor from every department to the Brain, and dashed
 * animated arcs showing where information flows: department ↔ Brain, between
 * neighbouring departments, and up/out to connected tools. Dots travel along
 * the arcs faster and more often as a department gets busier.
 */
export function DataPaths({ density = 1 }: { density?: number }) {
  const { runtime } = useRuntime()
  const plots = runtime.layout.plots
  const dots = useRef<THREE.InstancedMesh>(null)

  const lanes = useMemo(
    () =>
      plots.map((pl) => {
        const dir = new THREE.Vector2(-pl.center[0], -pl.center[1]).normalize()
        const start = new THREE.Vector3(pl.gate[0] + dir.x * 0.5, 0.012, pl.gate[1] + dir.y * 0.5)
        const end = new THREE.Vector3(pl.dock[0], 0.012, pl.dock[1])
        return { id: pl.teamId, len: start.distanceTo(end), mid: start.clone().lerp(end, 0.5), angle: Math.atan2(end.x - start.x, end.z - start.z) }
      }),
    [plots],
  )

  const arcs = useMemo<Arc[]>(() => {
    const out: Arc[] = []
    const add = (teamId: string, curve: THREE.CatmullRomCurve3, color: string, kind: Arc['kind']) => {
      const pts = curve.getPoints(64)
      const geometry = new THREE.BufferGeometry().setFromPoints(pts)
      const material = scrollingDashes({ color, dashSize: 0.28, gapSize: 0.26, transparent: true, opacity: kind === 'integration' ? 0.35 : 0.55, depthWrite: false })
      out.push({ teamId, curve, geometry, material, color: new THREE.Color(color), kind })
    }
    const core = new THREE.Vector3(0, 2.3, 0)
    plots.forEach((pl, i) => {
      const c = mutedAccent(pl.color)
      const from = new THREE.Vector3(pl.center[0], 0.6, pl.center[1])
      add(pl.teamId, arc(from, core, 2.2 + hash01(pl.teamId) * 1.5), c, 'brain')
      const nb = plots[(i + 1) % plots.length]
      if (nb !== pl && plots.length > 2) add(pl.teamId, arc(from, new THREE.Vector3(nb.center[0], 0.6, nb.center[1]), 3 + hash01(pl.teamId, 2) * 2), c, 'peer')
      // up and out of the island, toward the tools in the top bar
      const out2 = new THREE.Vector3(pl.center[0] * 1.6 - 14, 26, pl.center[1] * 1.6 - 14)
      add(pl.teamId, arc(from, out2, 4), c, 'integration')
    })
    return out
  }, [plots])

  const phases = useRef(arcs.map((_, i) => i * 0.37))

  useFrame((_, dt) => {
    const mesh = dots.current
    let n = 0
    arcs.forEach((a, ai) => {
      const act = runtime.activityOf(a.teamId)
      a.material.offset.value -= dt * (0.25 + act * 0.9)
      phases.current[ai] += dt * (0.05 + act * 0.18) * (a.kind === 'integration' ? 0.7 : 1)
      if (!mesh) return
      const visible = Math.round((1 + act * (DOTS_PER_ARC - 1)) * density)
      for (let i = 0; i < DOTS_PER_ARC; i++) {
        const k = (phases.current[ai] + i / DOTS_PER_ARC) % 1
        a.curve.getPointAt(a.kind === 'brain' && i % 2 ? 1 - k : k, p)
        dummy.position.copy(p)
        dummy.scale.setScalar(i < visible ? 0.07 : 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(n, dummy.matrix)
        mesh.setColorAt(n, a.color)
        n++
      }
    })
    if (mesh) {
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      {lanes.map((l) => (
        <mesh key={l.id} geometry={G.box} scale={[1.6, 0.02, l.len]} position={l.mid} rotation={[0, l.angle, 0]} receiveShadow>
          <meshStandardMaterial color={PALETTE.lane} roughness={0.95} />
        </mesh>
      ))}
      {arcs.map((a, i) => (
        <primitive key={i} object={lineFor(a)} />
      ))}
      <instancedMesh ref={dots} args={[G.sphereLo, undefined, Math.max(1, arcs.length * DOTS_PER_ARC)]} frustumCulled={false}>
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  )
}

const lines = new WeakMap<Arc, THREE.Line>()
function lineFor(a: Arc) {
  let l = lines.get(a)
  if (!l) {
    l = new THREE.Line(a.geometry, a.material)
    l.computeLineDistances()
    l.frustumCulled = false
    lines.set(a, l)
  }
  return l
}
