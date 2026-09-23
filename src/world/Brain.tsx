import { Html, Sparkles } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useWorld } from '../state/worldStore'
import { KnowledgeGraph } from './KnowledgeGraph'
import { G, PALETTE, glass, neon, std } from './materials'
import { useRuntime } from './RuntimeContext'
import { DYNAMIC, StaticBatch } from './StaticBatch'

const CORE_Y = 2.5

/** THE BRAIN — central platform with a glass core holding the knowledge graph. */
export function Brain({ particles = 1 }: { particles?: number }) {
  const { runtime, labelLayer } = useRuntime()
  const { radius, height } = runtime.layout.brain
  const setHover = useWorld((s) => s.setHover)
  const select = useWorld((s) => s.select)
  const selected = useWorld((s) => s.selection?.kind === 'brain')
  const nodeCount = useWorld((s) => s.bundles[runtime.worldId]?.knowledge.length ?? 0)

  const ring1 = useRef<THREE.Group>(null)
  const ring2 = useRef<THREE.Group>(null)
  const ring3 = useRef<THREE.Group>(null)
  const orbit = useRef<THREE.Group>(null)
  const graph = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const coreGlow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#67e8f9', emissive: '#22d3ee', emissiveIntensity: 1.2, transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false }), [])
  const baseGlow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#22d3ee', emissiveIntensity: 2, toneMapped: false }), [])
  const pulseMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }), [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    // The Brain wakes up ~1s after the world appears, then keeps breathing.
    const wake = Math.min(1, Math.max(0, (t - 0.8) / 1.2))
    const boost = runtime.brainBoost
    const flash = runtime.brainFlash
    const speed = (1 + boost * 2.5) * wake
    if (ring1.current) ring1.current.rotation.y += dt * 0.5 * speed
    if (ring2.current) ring2.current.rotation.y -= dt * 0.8 * speed
    if (ring3.current) ring3.current.rotation.z += dt * 0.35 * speed
    if (orbit.current) orbit.current.rotation.y += dt * 0.9 * speed
    if (graph.current) graph.current.rotation.y += dt * 0.15 * speed
    const beat = 0.5 + 0.5 * Math.sin(t * (2.2 + boost * 4))
    coreGlow.emissiveIntensity = (0.8 + beat * 0.8 + flash * 2 + boost) * wake
    baseGlow.emissiveIntensity = (1.4 + beat * 1.2 + boost * 1.5) * wake + 0.3
    if (pulse.current) {
      const k = (t * (0.35 + boost * 0.8)) % 1
      pulse.current.scale.setScalar(2.2 + k * 3.5)
      pulseMat.opacity = (1 - k) * (0.25 + boost * 0.4 + flash * 0.4) * wake
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
      {/* multi-layer circular platform */}
      <mesh geometry={G.cyl} scale={[radius, 0.5, radius]} position={[0, height - 0.25, 0]} material={std('#f5b8dc', 0.6, 0.05)} receiveShadow />
      <mesh geometry={G.torus} scale={[radius - 0.08, radius - 0.08, 1.4]} rotation={[Math.PI / 2, 0, 0]} position={[0, height + 0.01, 0]} material={baseGlow} />
      <mesh geometry={G.cyl} scale={[2.7, 0.3, 2.7]} position={[0, height + 0.15, 0]} material={std(PALETTE.dark, 0.35, 0.4)} castShadow receiveShadow />
      <mesh geometry={G.cyl} scale={[2.72, 0.05, 2.72]} position={[0, height + 0.27, 0]} material={baseGlow} />
      <mesh geometry={G.cyl} scale={[2.0, 0.28, 2.0]} position={[0, height + 0.44, 0]} material={std('#312e81', 0.3, 0.5)} castShadow />
      {/* dark radial panels */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <mesh key={i} geometry={G.box} scale={[0.12, 0.04, 0.5]} position={[Math.sin(a) * 2.35, height + 0.31, Math.cos(a) * 2.35]} rotation={[0, a, 0]} material={neon(i % 2 ? '#c084fc' : '#22d3ee', 1.8)} />
      })}
      <mesh userData={DYNAMIC} ref={pulse} geometry={G.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, height + 0.02, 0]} material={pulseMat} />

      {/* pedestal */}
      <mesh scale={[0.55, 0.9, 0.55]} position={[0, height + 1.0, 0]} material={std('#1e1b4b', 0.3, 0.6)} castShadow>
        <cylinderGeometry args={[0.6, 1, 1, 24]} />
      </mesh>
      <mesh geometry={G.torusThick} scale={[0.62, 0.62, 0.8]} rotation={[Math.PI / 2, 0, 0]} position={[0, height + 1.42, 0]} material={baseGlow} />

      {/* glass core + neural network */}
      <group position={[0, CORE_Y, 0]}>
        <mesh geometry={G.sphere} scale={1.25} material={glass} />
        <mesh geometry={G.sphere} scale={1.1} material={coreGlow} />
        <group userData={DYNAMIC} ref={graph}>
          <KnowledgeGraph radius={1.0} />
        </group>
        <group userData={DYNAMIC} ref={ring1} rotation={[0.35, 0, 0]}>
          <mesh geometry={G.torus} scale={1.6} rotation={[Math.PI / 2, 0, 0]} material={neon('#22d3ee', 2.4)} />
          <mesh geometry={G.sphereLo} scale={0.07} position={[1.6, 0, 0]} material={neon('#a5f3fc', 3)} />
        </group>
        <group userData={DYNAMIC} ref={ring2} rotation={[-0.5, 0, 0.3]}>
          <mesh geometry={G.torus} scale={1.85} rotation={[Math.PI / 2, 0, 0]} material={neon('#c084fc', 2.2)} />
          <mesh geometry={G.sphereLo} scale={0.08} position={[-1.85, 0, 0]} material={neon('#f0abfc', 3)} />
        </group>
        <group userData={DYNAMIC} ref={ring3} rotation={[Math.PI / 2, 0.4, 0]}>
          <mesh geometry={G.torus} scale={2.1} material={neon('#818cf8', 1.6)} />
        </group>
        <group userData={DYNAMIC} ref={orbit}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2
            return <mesh key={i} geometry={G.sphereLo} scale={0.09} position={[Math.cos(a) * 1.4, Math.sin(a * 2) * 0.35, Math.sin(a) * 1.4]} material={neon(i % 2 ? '#22d3ee' : '#e879f9', 2.6)} />
          })}
        </group>
        <Sparkles count={Math.round(60 * particles)} scale={[4, 3, 4]} size={12} speed={0.5} color="#a5f3fc" opacity={0.8} />
      </group>
      </StaticBatch>
      <pointLight position={[0, CORE_Y, 0]} color="#67e8f9" intensity={14} distance={10} decay={1.5} />

      <Html position={[0, CORE_Y + 2.1, 0]} center zIndexRange={[30, 10]} portal={labelLayer as RefObject<HTMLElement>}>
        <div
          className={`dept-label brain-label${selected ? ' selected' : ''}`}
          style={{ ['--accent' as string]: '#22d3ee' }}
          onClick={(e) => {
            e.stopPropagation()
            select({ kind: 'brain', id: 'brain' })
          }}
        >
          <span className="dept-icon">🧠</span>
          <span className="dept-name">THE BRAIN</span>
          <span className="dept-count">{nodeCount}</span>
        </div>
      </Html>
    </group>
  )
}
