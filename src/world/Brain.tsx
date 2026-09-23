import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useWorld } from '../state/worldStore'
import { KnowledgeGraph } from './KnowledgeGraph'
import { G, std } from './materials'
import { useRuntime } from './RuntimeContext'
import { DYNAMIC, StaticBatch } from './StaticBatch'

const CORE_Y = 2.3
const DUST = 260

/** THE BRAIN — a quiet central plate with a floating, living knowledge network. */
export function Brain({ particles = 1 }: { particles?: number }) {
  const { runtime, labelLayer } = useRuntime()
  const { radius, height } = runtime.layout.brain
  const setHover = useWorld((s) => s.setHover)
  const select = useWorld((s) => s.select)
  const selected = useWorld((s) => s.selection?.kind === 'brain')
  const notes = useWorld((s) => s.bundles[runtime.worldId]?.knowledge.length ?? 0)

  const graph = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const dust = useRef<THREE.Points>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const pulseMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#9fd8cf', transparent: true, depthWrite: false, side: THREE.DoubleSide }), [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#9aa3ad', transparent: true, opacity: 0.25, depthWrite: false }), [])

  // A soft cloud of points around the graph — the "network" silhouette.
  const dustGeo = useMemo(() => {
    const n = Math.round(DUST * Math.max(0.4, particles))
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const a = new THREE.Color('#e8eef0')
    const b = new THREE.Color('#7fcfc2')
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const r = 0.6 + Math.pow(Math.random(), 0.6) * 1.2
      const s = Math.sqrt(1 - u * u)
      pos.set([Math.cos(th) * s * r * 1.25, u * r * 0.55, Math.sin(th) * s * r * 1.25], i * 3)
      const c = a.clone().lerp(b, Math.random())
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [particles])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const wake = Math.min(1, Math.max(0, (t - 0.8) / 1.2)) // wakes ~1s after the world appears
    const boost = runtime.brainBoost
    const speed = (1 + boost * 2) * wake
    if (graph.current) graph.current.rotation.y += dt * 0.12 * speed
    if (dust.current) {
      dust.current.rotation.y -= dt * 0.05 * speed
      ;(dust.current.material as THREE.PointsMaterial).opacity = (0.55 + Math.sin(t * 1.3) * 0.1 + runtime.brainFlash * 0.3) * wake
    }
    if (ring.current) ring.current.rotation.y += dt * 0.2 * speed
    ringMat.opacity = 0.18 + boost * 0.2
    if (pulse.current) {
      const k = (t * (0.25 + boost * 0.6)) % 1
      pulse.current.scale.setScalar(1.6 + k * 2.2)
      pulseMat.opacity = (1 - k) * (0.08 + boost * 0.25 + runtime.brainFlash * 0.2) * wake
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover({ kind: 'brain', id: 'brain' })
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setHover(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    select({ kind: 'brain', id: 'brain' })
  }

  return (
    <group onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <StaticBatch>
        <mesh geometry={G.cyl} scale={[radius, 0.5, radius]} position={[0, height - 0.25, 0]} material={std('#232326', 0.85, 0.05)} receiveShadow />
        <mesh geometry={G.cyl} scale={[radius * 0.62, 0.12, radius * 0.62]} position={[0, height + 0.06, 0]} material={std('#1a1a1c', 0.6, 0.2)} receiveShadow castShadow />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2
          return <mesh key={i} geometry={G.box} scale={[0.05, 0.02, 0.32]} position={[Math.sin(a) * (radius - 0.45), height + 0.01, Math.cos(a) * (radius - 0.45)]} rotation={[0, a, 0]} material={std('#3a3a3f')} />
        })}
        <mesh geometry={G.cyl} scale={[0.35, 0.8, 0.35]} position={[0, height + 0.5, 0]} material={std('#1e1e21', 0.4, 0.5)} castShadow />
        <mesh userData={DYNAMIC} ref={pulse} geometry={G.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, height + 0.02, 0]} material={pulseMat} />
      </StaticBatch>

      <group position={[0, CORE_Y, 0]}>
        <group ref={graph}>
          <KnowledgeGraph radius={1.35} />
        </group>
        <points ref={dust} geometry={dustGeo}>
          <pointsMaterial size={2.2} sizeAttenuation={false} vertexColors transparent opacity={0.6} depthWrite={false} />
        </points>
        <group ref={ring} rotation={[0.18, 0, 0]}>
          <mesh geometry={G.torus} scale={[2.0, 2.0, 0.6]} rotation={[Math.PI / 2, 0, 0]} material={ringMat} />
        </group>
      </group>
      <pointLight position={[0, CORE_Y, 0]} color="#bfe8e1" intensity={3} distance={8} decay={1.8} />

      <Html position={[0, height + 0.3, radius - 0.2]} center zIndexRange={[40, 21]} portal={labelLayer as RefObject<HTMLElement>}>
        <div
          className={`brain-pill${selected ? ' selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            select({ kind: 'brain', id: 'brain' })
          }}
        >
          <span className="dc-dot" />
          <span className="bp-name">The Brain</span>
          <b className="serif">{notes}</b>
          <span className="bp-unit">notes</span>
        </div>
      </Html>
    </group>
  )
}
