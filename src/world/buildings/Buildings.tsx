import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import type { BuildingType } from '../../domain/types'
import { G, PALETTE, glass, neon, std } from '../materials'
import type { TeamVisuals } from '../RuntimeContext'
import { Ball, Box, Cyl, Door, Rounded, Screen } from './parts'
import { DYNAMIC } from '../StaticBatch'

// Procedural buildings. Same visual language (rounded forms, pastel bodies,
// dark trims, neon accents) — but every department has its own silhouette.
// Local frame: origin = ground centre, +z = front (faces the camera).

export interface BuildingProps {
  color: string
  visuals: TeamVisuals
  icon?: string
}

function useSpin(speed: number, axis: 'x' | 'y' | 'z' = 'y') {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed
  })
  return ref
}

function Base({ w, d, children }: { w: number; d: number; children?: ReactNode }) {
  return (
    <group>
      <Rounded size={[w, 0.18, d]} radius={0.08} position={[0, 0.09, 0]} color={PALETTE.dark} />
      {children}
    </group>
  )
}

// ─── Research: laboratory with a glass dome and orbiting atom ────────────────
function ResearchBuilding({ color, visuals }: BuildingProps) {
  const atom = useSpin(0.9)
  const accent = visuals.glow
  return (
    <group>
      <Base w={3.6} d={2.4} />
      <Rounded size={[3.2, 1.7, 2.0]} radius={0.3} position={[0, 1.0, 0]} color={PALETTE.white} />
      <Box s={[3.22, 0.12, 2.02]} position={[0, 1.55, 0]} material={accent} />
      <Ball r={[0.95, 0.95, 0.95]} position={[0, 1.85, -0.1]} material={glass} />
      <group userData={DYNAMIC} ref={atom} position={[0, 2.35, -0.1]}>
        <Ball r={0.16} material={neon(color, 3)} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={G.torus} scale={0.45} rotation={[Math.PI / 2 + i * 1.05, i * 0.6, 0]} material={neon(color, 2.5)} />
        ))}
      </group>
      <Door glow={accent} position={[0, 0.18, 1.01]} />
      <Screen w={0.9} h={0.55} material={visuals.screens[1]} position={[-1.0, 1.0, 1.02]} />
      <Screen w={0.9} h={0.55} material={visuals.screens[0]} position={[1.0, 1.0, 1.02]} />
      {/* chemistry tanks */}
      {[-1.9, 1.9].map((x, i) => (
        <group key={x} position={[x, 0.18, 0.2]}>
          <Cyl r={0.26} h={1.2} position={[0, 0.6, 0]} material={glass} />
          <Cyl r={0.2} h={0.7 + i * 0.25} position={[0, 0.35 + i * 0.12, 0]} material={neon(i ? '#a3e635' : color, 1.6)} />
          <Cyl r={0.28} h={0.1} position={[0, 1.22, 0]} material={std(PALETTE.dark)} />
        </group>
      ))}
      {/* antenna dish */}
      <group position={[1.2, 1.85, -0.6]} rotation={[-0.5, 0.6, 0]}>
        <Cyl r={0.04} h={0.5} position={[0, 0.25, 0]} material={std(PALETTE.metal)} />
        <mesh geometry={G.sphere} scale={[0.35, 0.1, 0.35]} position={[0, 0.52, 0]} material={std(PALETTE.offWhite)} />
      </group>
    </group>
  )
}

// ─── Strategy: hexagonal war-room tower with a target on top ──────────────────
function StrategyBuilding({ color, visuals }: BuildingProps) {
  const target = useSpin(0.4)
  return (
    <group>
      <Base w={3.0} d={2.6} />
      <mesh scale={[1.25, 2.4, 1.25]} position={[0, 1.38, -0.1]} material={std('#fef3c7')} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </mesh>
      <mesh position={[0, 2.62, -0.1]} scale={[1.32, 0.14, 1.32]} material={std(PALETTE.dark)}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </mesh>
      <mesh position={[0, 1.6, -0.1]} scale={[1.27, 0.1, 1.27]} material={visuals.glow}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </mesh>
      <group userData={DYNAMIC} ref={target} position={[0, 3.05, -0.1]} rotation={[0, 0, 0]}>
        <group rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
          {[0.7, 0.5, 0.3].map((r, i) => (
            <mesh key={r} geometry={G.cyl} scale={[r, 0.06 + i * 0.02, r]} rotation={[Math.PI / 2, 0, 0]} material={i % 2 ? std(PALETTE.white) : neon(color, 2.4)} />
          ))}
          <mesh geometry={G.cone} scale={[0.06, 0.8, 0.06]} position={[0, 0, 0.4]} rotation={[-Math.PI / 2, 0, 0]} material={std('#ef4444')} />
        </group>
      </group>
      <Door glow={visuals.glow} position={[0, 0.18, 1.02]} />
      {/* planning screen */}
      <group position={[-1.1, 0.18, 0.9]} rotation={[0, 0.5, 0]}>
        <Cyl r={0.04} h={0.9} position={[0, 0.45, 0]} material={std(PALETTE.metal)} />
        <Screen w={1.0} h={0.62} material={visuals.screens[0]} position={[0, 1.15, 0]} />
      </group>
      {/* flag */}
      <group position={[1.1, 2.7, -0.4]}>
        <Cyl r={0.025} h={0.9} position={[0, 0.45, 0]} material={std(PALETTE.metal)} />
        <Box s={[0.4, 0.24, 0.02]} position={[0.2, 0.78, 0]} material={neon(color, 1.8)} />
      </group>
    </group>
  )
}

// ─── Data: server racks, database stack, cooling fans ──────────────────────
function DataBuilding({ color, visuals }: BuildingProps) {
  const fan1 = useSpin(6)
  const fan2 = useSpin(-5)
  const leds = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2, toneMapped: false }), [color])
  useFrame(({ clock }) => {
    leds.emissiveIntensity = 1.2 + Math.abs(Math.sin(clock.elapsedTime * (3 + (visuals.glow.emissiveIntensity - 0.6) * 4))) * 2
  })
  return (
    <group>
      <Base w={3.8} d={2.2} />
      <Rounded size={[3.5, 1.8, 1.9]} radius={0.16} position={[0, 1.08, 0]} color="#cbd5e1" />
      {/* rack faces */}
      {[-1.2, -0.4, 0.4, 1.2].map((x) => (
        <group key={x} position={[x, 1.02, 0.96]}>
          <Box s={[0.66, 1.5, 0.05]} material={std('#1e293b', 0.4, 0.5)} />
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <Box key={r} s={[0.46, 0.05, 0.03]} position={[-0.05, -0.6 + r * 0.24, 0.035]} material={r % 2 ? leds : std('#334155')} />
          ))}
          <Box s={[0.06, 0.06, 0.03]} position={[0.24, 0.6, 0.035]} material={neon('#a3e635', 2.5)} />
        </group>
      ))}
      <Box s={[3.52, 0.1, 1.92]} position={[0, 2.0, 0]} material={visuals.glow} />
      {/* cooling units */}
      {[
        [-0.9, fan1],
        [0.9, fan2],
      ].map(([x, ref], i) => (
        <group key={i} position={[x as number, 2.05, -0.1]}>
          <Cyl r={0.5} h={0.35} position={[0, 0.17, 0]} material={std('#e2e8f0')} />
          <group userData={DYNAMIC} ref={ref as RefObject<THREE.Group>} position={[0, 0.36, 0]}>
            {[0, 1, 2, 3].map((b) => (
              <Box key={b} s={[0.8, 0.02, 0.14]} rotation={[0, (b * Math.PI) / 4, 0.25]} material={std(PALETTE.dark)} />
            ))}
          </group>
        </group>
      ))}
      {/* database stack */}
      <group position={[-2.05, 0.18, 0.3]}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0, 0.2 + i * 0.38, 0]}>
            <Cyl r={0.34} h={0.3} material={std('#1e3a8a', 0.35, 0.3)} />
            <Cyl r={0.35} h={0.04} position={[0, 0.13, 0]} material={neon(color, 2)} />
          </group>
        ))}
      </group>
      <Screen w={0.7} h={0.45} material={visuals.screens[2]} position={[2.05, 0.9, 0.2]} rotation={[0, -0.3, 0]} />
    </group>
  )
}

// ─── Design: creative studio with a tilted canvas and colour fan ─────────────
function DesignBuilding({ visuals }: BuildingProps) {
  const fan = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (fan.current) fan.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.35
  })
  const swatches = ['#f472b6', '#c084fc', '#60a5fa', '#34d399', '#facc15']
  return (
    <group>
      <Base w={3.6} d={2.4} />
      <Rounded size={[2.6, 1.5, 1.9]} radius={0.35} position={[-0.3, 0.93, -0.1]} color="#fae8ff" />
      <Rounded size={[1.2, 2.1, 1.6]} radius={0.3} position={[1.15, 1.23, -0.2]} color="#e9d5ff" />
      <Box s={[2.62, 0.1, 1.92]} position={[-0.3, 1.5, -0.1]} material={visuals.glow} />
      {/* tilted canvas on the roof */}
      <group position={[-0.5, 2.2, -0.2]} rotation={[-0.25, 0.1, 0.05]}>
        <Box s={[0.06, 1.0, 0.06]} position={[-0.55, -0.4, -0.1]} rotation={[0.2, 0, 0]} material={std(PALETTE.wood)} />
        <Box s={[0.06, 1.0, 0.06]} position={[0.55, -0.4, -0.1]} rotation={[0.2, 0, 0]} material={std(PALETTE.wood)} />
        <Screen w={1.5} h={0.95} material={visuals.screens[2]} />
      </group>
      {/* colour fan */}
      <group userData={DYNAMIC} ref={fan} position={[1.15, 2.4, 0.62]}>
        {swatches.map((c, i) => (
          <Box key={c} s={[0.16, 0.7, 0.03]} position={[0, 0.3, i * 0.01]} rotation={[0, 0, (i - 2) * 0.3]} material={neon(c, 1.4)} />
        ))}
      </group>
      <Door glow={visuals.glow} position={[-0.6, 0.18, 0.86]} />
      <Screen w={0.7} h={0.45} material={visuals.screens[0]} position={[0.5, 0.95, 0.86]} />
      {/* pencil */}
      <group position={[-1.95, 0.18, 0.4]} rotation={[0, 0, 0.25]}>
        <Cyl r={0.1} h={1.3} position={[0, 0.65, 0]} material={std('#facc15')} lo />
        <mesh geometry={G.cone} scale={[0.1, 0.25, 0.1]} position={[0, 1.42, 0]} material={std(PALETTE.wood)} />
      </group>
    </group>
  )
}

// ─── Operations: control centre with a giant rotating gear ──────────────────
function Gear({ r, teeth, material }: { r: number; teeth: number; material: THREE.Material }) {
  return (
    <group>
      <mesh geometry={G.cyl} scale={[r, 0.14, r]} rotation={[Math.PI / 2, 0, 0]} material={material} castShadow />
      <mesh geometry={G.cyl} scale={[r * 0.35, 0.18, r * 0.35]} rotation={[Math.PI / 2, 0, 0]} material={std(PALETTE.dark)} />
      {Array.from({ length: teeth }, (_, i) => {
        const a = (i / teeth) * Math.PI * 2
        return <Box key={i} s={[0.16, 0.2, 0.14]} position={[Math.cos(a) * r, Math.sin(a) * r, 0]} rotation={[0, 0, a]} material={material} />
      })}
    </group>
  )
}

function OperationsBuilding({ color, visuals }: BuildingProps) {
  const g1 = useSpin(0.7, 'z')
  const g2 = useSpin(-1.1, 'z')
  return (
    <group>
      <Base w={3.4} d={2.4} />
      <Rounded size={[3.1, 1.9, 2.0]} radius={0.22} position={[0, 1.13, -0.1]} color="#dcfce7" />
      <Box s={[3.12, 0.1, 2.02]} position={[0, 2.0, -0.1]} material={visuals.glow} />
      <group userData={DYNAMIC} ref={g1} position={[-0.75, 2.45, 0.1]}>
        <Gear r={0.62} teeth={10} material={std('#86efac', 0.4, 0.3)} />
      </group>
      <group userData={DYNAMIC} ref={g2} position={[0.28, 2.3, 0.14]}>
        <Gear r={0.36} teeth={7} material={neon(color, 1.3)} />
      </group>
      {/* monitoring wall */}
      {[-0.95, 0, 0.95].map((x, i) => (
        <Screen key={x} w={0.75} h={0.5} material={visuals.screens[i % 3]} position={[x, 1.3, 0.92]} />
      ))}
      <Door glow={visuals.glow} position={[0, 0.18, 0.91]} h={0.8} />
      {/* pipes */}
      <Cyl r={0.08} h={1.8} position={[1.7, 1.0, 0.3]} material={std(PALETTE.metal, 0.3, 0.6)} lo />
      <Cyl r={0.08} h={1.2} position={[1.7, 1.9, -0.3]} rotation={[Math.PI / 2, 0, 0]} material={std(PALETTE.metal, 0.3, 0.6)} lo />
      <Ball r={0.14} position={[1.7, 1.9, 0.3]} material={neon(color, 2)} />
    </group>
  )
}

// ─── Product: prototype lab with blueprint wall and floating prototype ──────
function ProductBuilding({ color, visuals }: BuildingProps) {
  const proto = useRef<THREE.Group>(null)
  const wire = useMemo(() => new THREE.MeshBasicMaterial({ color, wireframe: true, toneMapped: false }), [color])
  useFrame(({ clock }, dt) => {
    if (!proto.current) return
    proto.current.rotation.y += dt * 0.8
    proto.current.rotation.x += dt * 0.3
    proto.current.position.y = 2.75 + Math.sin(clock.elapsedTime * 1.4) * 0.1
  })
  return (
    <group>
      <Base w={3.4} d={2.4} />
      <Rounded size={[3.0, 1.6, 1.9]} radius={0.25} position={[0, 0.98, -0.1]} color="#ccfbf1" />
      <Rounded size={[1.6, 0.5, 1.4]} radius={0.2} position={[0.4, 2.0, -0.2]} color="#99f6e4" />
      <Box s={[3.02, 0.1, 1.92]} position={[0, 1.7, -0.1]} material={visuals.glow} />
      {/* holo pedestal + prototype */}
      <Cyl r={0.42} h={0.12} position={[-0.8, 1.84, -0.1]} material={neon(color, 1.8)} />
      <group userData={DYNAMIC} ref={proto} position={[-0.8, 2.75, -0.1]}>
        <mesh geometry={G.ico} scale={0.42} material={wire} />
        <Box s={[0.3, 0.3, 0.3]} material={std('#f0fdfa')} />
      </group>
      {/* blueprint wall */}
      <Screen w={1.3} h={0.7} material={visuals.screens[2]} position={[0.55, 1.0, 0.86]} />
      <Door glow={visuals.glow} position={[-0.85, 0.18, 0.86]} />
      {/* boxed prototypes */}
      {[
        [1.9, 0.3, 0.45],
        [1.75, 0.3, -0.3],
        [1.85, 0.72, 0.1],
      ].map(([x, y, z], i) => (
        <Rounded key={i} size={[0.38, 0.38, 0.38]} radius={0.05} position={[x, y, z]} color={i === 2 ? color : '#f0fdfa'} />
      ))}
    </group>
  )
}

// ─── Marketing: broadcast tower with megaphone and pulse rings ──────────────
function MarketingBuilding({ color, visuals }: BuildingProps) {
  const horn = useRef<THREE.Group>(null)
  const rings = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (horn.current) horn.current.rotation.y = Math.sin(t * 0.7) * 0.5
    if (rings.current)
      rings.current.children.forEach((c, i) => {
        const k = (t * 0.6 + i / 3) % 1
        c.scale.setScalar(0.3 + k * 1.3)
        ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8
      })
  })
  const ringMats = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false, depthWrite: false })), [color])
  return (
    <group>
      <Base w={3.4} d={2.4} />
      <Rounded size={[2.2, 1.7, 1.9]} radius={0.3} position={[-0.5, 1.03, -0.1]} color="#ffe4e6" />
      <Rounded size={[1.0, 2.6, 1.0]} radius={0.25} position={[1.1, 1.48, -0.4]} color="#fecdd3" />
      <Box s={[2.22, 0.1, 1.92]} position={[-0.5, 1.6, -0.1]} material={visuals.glow} />
      <group userData={DYNAMIC} ref={horn} position={[1.1, 3.0, -0.4]}>
        <mesh geometry={G.cone} scale={[0.45, 0.9, 0.45]} position={[0, 0, 0.4]} rotation={[-Math.PI / 2, 0, 0]} material={std('#fb923c')} castShadow />
        <mesh geometry={G.cyl} scale={[0.46, 0.04, 0.46]} position={[0, 0, 0.86]} rotation={[Math.PI / 2, 0, 0]} material={neon(color, 2.5)} />
        <group userData={DYNAMIC} ref={rings} position={[0, 0, 1.0]}>
          {ringMats.map((m, i) => (
            <mesh key={i} geometry={G.torus} material={m} />
          ))}
        </group>
      </group>
      {/* billboard */}
      <group position={[-0.6, 2.05, 0.1]}>
        <Box s={[0.05, 0.6, 0.05]} position={[-0.5, -0.1, 0]} material={std(PALETTE.metal)} />
        <Box s={[0.05, 0.6, 0.05]} position={[0.5, -0.1, 0]} material={std(PALETTE.metal)} />
        <Screen w={1.4} h={0.7} material={visuals.screens[0]} position={[0, 0.45, 0]} />
      </group>
      <Door glow={visuals.glow} position={[-0.9, 0.18, 0.86]} />
      <Screen w={0.7} h={0.45} material={visuals.screens[1]} position={[0.05, 0.95, 0.86]} />
    </group>
  )
}

// ─── Studio: content / video / audio production ─────────────────────────────
function StudioBuilding({ color, visuals }: BuildingProps) {
  const onAir = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 2, toneMapped: false }), [])
  const lens = useSpin(0.5, 'z')
  useFrame(({ clock }) => {
    onAir.emissiveIntensity = 1 + (Math.sin(clock.elapsedTime * 3) > 0 ? 2 : 0.3)
  })
  return (
    <group>
      <Base w={3.6} d={2.4} />
      <Rounded size={[3.2, 1.4, 1.9]} radius={0.2} position={[0, 0.88, -0.1]} color="#ffedd5" />
      <mesh position={[0, 1.58, -0.1]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1.55, 1]} castShadow material={std('#fed7aa')}>
        <cylinderGeometry args={[0.95, 0.95, 2.0, 24, 1, false, 0, Math.PI]} />
      </mesh>
      <Box s={[3.22, 0.1, 1.92]} position={[0, 1.55, -0.1]} material={visuals.glow} />
      {/* camera lens */}
      <group position={[0.9, 1.0, 0.9]}>
        <Cyl r={0.42} h={0.2} rotation={[Math.PI / 2, 0, 0]} material={std(PALETTE.dark, 0.3, 0.5)} />
        <group userData={DYNAMIC} ref={lens}>
          <Cyl r={0.3} h={0.24} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} material={std('#0f172a', 0.1, 0.8)} />
          <Box s={[0.08, 0.5, 0.02]} position={[0, 0, 0.16]} material={neon(color, 1.5)} />
        </group>
        <Cyl r={0.16} h={0.26} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]} material={neon(color, 2.6)} />
      </group>
      <Box s={[0.7, 0.22, 0.04]} position={[-0.7, 1.35, 0.86]} material={onAir} />
      <Door glow={visuals.glow} position={[-0.7, 0.18, 0.86]} h={0.9} />
      <Screen w={0.8} h={0.45} material={visuals.screens[2]} position={[-0.3, 2.3, 0.25]} rotation={[-0.3, 0, 0]} />
      {/* speaker */}
      <group position={[-1.95, 0.18, 0.2]}>
        <Rounded size={[0.5, 0.9, 0.45]} radius={0.08} position={[0, 0.45, 0]} color={PALETTE.dark} />
        <Cyl r={0.15} h={0.04} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.6, 0.23]} material={neon(color, 1.6)} />
        <Cyl r={0.09} h={0.04} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.25, 0.23]} material={neon(color, 1.6)} />
      </group>
    </group>
  )
}

// ─── Engineering: stacked code tower ────────────────────────────────────────
function EngineeringBuilding({ color, visuals }: BuildingProps) {
  const top = useSpin(0.6)
  return (
    <group>
      <Base w={3.0} d={2.4} />
      {[0, 1, 2].map((i) => (
        <group key={i} position={[(i % 2 ? 0.15 : -0.1), 0.18 + i * 0.95, -0.1]}>
          <Rounded size={[2.5 - i * 0.4, 0.85, 1.9 - i * 0.25]} radius={0.15} position={[0, 0.43, 0]} color={i === 1 ? '#dbeafe' : '#eff6ff'} />
          <Box s={[2.52 - i * 0.4, 0.07, 1.92 - i * 0.25]} position={[0, 0.88, 0]} material={visuals.glow} />
        </group>
      ))}
      <Screen w={1.2} h={0.45} material={visuals.screens[1]} position={[-0.1, 1.55, 0.86]} />
      <Door glow={visuals.glow} position={[-0.1, 0.18, 0.96]} h={0.75} />
      <group userData={DYNAMIC} ref={top} position={[0.15, 3.35, -0.1]}>
        {/* </> glyph */}
        <Box s={[0.08, 0.34, 0.08]} position={[-0.3, 0.1, 0]} rotation={[0, 0, 0.6]} material={neon(color, 2.6)} />
        <Box s={[0.08, 0.34, 0.08]} position={[-0.3, -0.12, 0]} rotation={[0, 0, -0.6]} material={neon(color, 2.6)} />
        <Box s={[0.08, 0.6, 0.08]} position={[0, 0, 0]} rotation={[0, 0, -0.35]} material={neon('#a5f3fc', 2.6)} />
        <Box s={[0.08, 0.34, 0.08]} position={[0.3, 0.1, 0]} rotation={[0, 0, -0.6]} material={neon(color, 2.6)} />
        <Box s={[0.08, 0.34, 0.08]} position={[0.3, -0.12, 0]} rotation={[0, 0, 0.6]} material={neon(color, 2.6)} />
      </group>
      <Cyl r={0.03} h={0.8} position={[-0.6, 3.3, -0.4]} material={std(PALETTE.metal)} />
      <Ball r={0.07} position={[-0.6, 3.72, -0.4]} material={neon('#f472b6', 3)} />
    </group>
  )
}

// ─── Generic: any custom team (colour + icon driven) ─────────────────────────
function GenericTeamBuilding({ color, visuals }: BuildingProps) {
  const holo = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    if (!holo.current) return
    holo.current.rotation.y += dt
    holo.current.position.y = 2.55 + Math.sin(clock.elapsedTime * 1.5) * 0.08
  })
  const body = useMemo(() => '#' + new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.78).getHexString(), [color])
  return (
    <group>
      <Base w={3.2} d={2.4} />
      <Rounded size={[2.8, 1.6, 1.9]} radius={0.35} position={[0, 0.98, -0.1]} color={body} />
      <Rounded size={[2.9, 0.2, 2.0]} radius={0.08} position={[0, 1.85, -0.1]} color={color} />
      <Box s={[2.82, 0.08, 1.92]} position={[0, 1.2, -0.1]} material={visuals.glow} />
      <Cyl r={0.4} h={0.1} position={[0, 2.0, -0.1]} material={std(PALETTE.dark)} />
      <group userData={DYNAMIC} ref={holo} position={[0, 2.55, -0.1]}>
        <mesh geometry={G.octa} scale={0.32} material={neon(color, 2.4)} />
        <mesh geometry={G.torus} scale={0.5} rotation={[Math.PI / 2, 0, 0]} material={neon(color, 2)} />
      </group>
      <Door glow={visuals.glow} position={[-0.6, 0.18, 0.86]} />
      <Screen w={0.8} h={0.5} material={visuals.screens[0]} position={[0.55, 0.95, 0.86]} />
    </group>
  )
}

/** Reusable building registry — custom teams fall back to the generic building. */
export const buildingTypes: Record<BuildingType, (p: BuildingProps) => ReactNode> = {
  research: ResearchBuilding,
  strategy: StrategyBuilding,
  data: DataBuilding,
  design: DesignBuilding,
  operations: OperationsBuilding,
  product: ProductBuilding,
  marketing: MarketingBuilding,
  studio: StudioBuilding,
  engineering: EngineeringBuilding,
  generic: GenericTeamBuilding,
}
