import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { memo, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useWorld } from '../state/worldStore'
import { DepartmentLabel } from '../components/DepartmentLabel'
import { Building } from './Building'
import type { PlotLayout } from './layout'
import { G, PALETTE, neon, plant, std } from './materials'
import { useRuntime } from './RuntimeContext'
import { DYNAMIC, StaticBatch } from './StaticBatch'

const PLANT_COLORS = ['#34d399', '#4ade80', '#2dd4bf']

function Desk({ screen, accent }: { screen: THREE.Material; accent: THREE.Material }) {
  return (
    <group>
      {/* desk */}
      <mesh geometry={G.box} scale={[1.05, 0.06, 0.62]} position={[0, 0.72, 0]} material={std(PALETTE.desk)} castShadow receiveShadow />
      <mesh geometry={G.box} scale={[0.05, 0.7, 0.55]} position={[-0.47, 0.36, 0]} material={std('#c4b5fd')} castShadow />
      <mesh geometry={G.box} scale={[0.05, 0.7, 0.55]} position={[0.47, 0.36, 0]} material={std('#c4b5fd')} castShadow />
      <mesh geometry={G.box} scale={[1.06, 0.03, 0.03]} position={[0, 0.74, 0.3]} material={accent} />
      {/* monitor */}
      <mesh geometry={G.box} scale={[0.06, 0.2, 0.06]} position={[0, 0.85, -0.16]} material={std(PALETTE.dark)} />
      <mesh geometry={G.box} scale={[0.62, 0.4, 0.04]} position={[0, 1.1, -0.18]} material={std(PALETTE.dark, 0.4, 0.3)} castShadow />
      <mesh geometry={G.plane} scale={[0.56, 0.34, 1]} position={[0, 1.1, -0.157]} material={screen} />
      {/* keyboard + mug */}
      <mesh geometry={G.box} scale={[0.36, 0.02, 0.12]} position={[0, 0.76, 0.08]} material={std('#e2e8f0')} />
      <mesh geometry={G.cylLo} scale={[0.04, 0.08, 0.04]} position={[0.38, 0.79, 0.05]} material={std('#fb7185')} />
      {/* chair */}
      <group position={[0, 0, 0.62]}>
        <mesh geometry={G.cylLo} scale={[0.04, 0.4, 0.04]} position={[0, 0.2, 0]} material={std(PALETTE.metal)} />
        <mesh geometry={G.cyl} scale={[0.22, 0.06, 0.22]} position={[0, 0.42, 0]} material={std(PALETTE.dark)} castShadow />
        <mesh geometry={G.box} scale={[0.36, 0.34, 0.05]} position={[0, 0.66, 0.2]} material={std(PALETTE.dark)} castShadow />
      </group>
    </group>
  )
}

function Plant({ variant }: { variant: number }) {
  const leaf = plant(PLANT_COLORS[variant % PLANT_COLORS.length])
  return (
    <group>
      <mesh geometry={G.cyl} scale={[0.22, 0.3, 0.22]} position={[0, 0.15, 0]} material={std(PALETTE.pot)} castShadow />
      {variant % 2 === 0 ? (
        <>
          <mesh geometry={G.sphereLo} scale={[0.32, 0.38, 0.32]} position={[0, 0.55, 0]} material={leaf} castShadow />
          <mesh geometry={G.sphereLo} scale={[0.22, 0.26, 0.22]} position={[0.1, 0.85, 0.05]} material={leaf} castShadow />
        </>
      ) : (
        [0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            geometry={G.cone}
            scale={[0.08, 0.6, 0.08]}
            position={[Math.cos(i * 1.26) * 0.08, 0.55, Math.sin(i * 1.26) * 0.08]}
            rotation={[Math.sin(i * 1.26) * 0.4, 0, -Math.cos(i * 1.26) * 0.4]}
            material={leaf}
            castShadow
          />
        ))
      )}
    </group>
  )
}

function Station({ screen, accent }: { screen: THREE.Material; accent: THREE.Material }) {
  const holo = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (holo.current) {
      holo.current.rotation.y = clock.elapsedTime
      holo.current.position.y = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.05
    }
  })
  return (
    <group>
      <RoundedBox args={[0.7, 0.9, 0.45]} radius={0.08} position={[0, 0.45, 0]} material={std('#ede9fe')} castShadow />
      <mesh geometry={G.box} scale={[0.72, 0.05, 0.47]} position={[0, 0.9, 0]} material={accent} />
      <mesh position={[0, 1.08, 0.12]} rotation={[-0.5, 0, 0]} material={screen}>
        <planeGeometry args={[0.6, 0.36]} />
      </mesh>
      <mesh userData={DYNAMIC} ref={holo} geometry={G.octa} scale={0.12} position={[0, 1.5, 0]} material={accent} />
    </group>
  )
}

/** Floating diamonds above a department — count & brightness follow activity. */
function ActivityBeacons({ teamId, color, y }: { teamId: string; color: string; y: number }) {
  const { runtime } = useRuntime()
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }), [color])
  useFrame(({ clock }) => {
    const act = runtime.activityOf(teamId)
    const t = clock.elapsedTime
    group.current?.children.forEach((c, i) => {
      c.visible = i < Math.round(act * 4)
      c.position.y = y + Math.sin(t * 2 + i) * 0.08
      c.rotation.y = t * (1 + act * 2) + i
    })
    if (ring.current) {
      const k = (t * (0.3 + act * 0.9)) % 1
      ring.current.scale.setScalar(2.2 + k * 2.3)
      mat.opacity = (1 - k) * (0.15 + act * 0.5)
    }
  })
  return (
    <>
      <group ref={group}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={G.octa} scale={[0.09, 0.14, 0.09]} position={[(i - 1.5) * 0.35, y, 0]} material={neon(color, 3)} />
        ))}
      </group>
      <mesh ref={ring} geometry={G.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={mat} />
    </>
  )
}

function DepartmentImpl({ plot, lights = true }: { plot: PlotLayout; lights?: boolean }) {
  const { runtime, teamVisuals, labelLayer } = useRuntime()
  const visuals = teamVisuals[plot.teamId]
  const setHover = useWorld((s) => s.setHover)
  const selectDepartment = useWorld((s) => s.selectDepartment)

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover({ kind: 'team', id: plot.teamId })
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setHover(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return // the pointer was dragging the camera
    selectDepartment(plot.teamId)
  }

  const [cx, cz] = plot.center
  const tint = useMemo(() => '#' + new THREE.Color(PALETTE.plot).lerp(new THREE.Color(plot.color), 0.12).getHexString(), [plot.color])
  const edge = useMemo(() => {
    const h = plot.size / 2 - 0.12
    const pts = [
      [-h, -h], [h, -h], [h, h], [-h, h], [-h, -h],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [plot.size])

  return (
    <group onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <StaticBatch>
        {/* raised plot */}
        <group position={[cx, 0, cz]}>
          <RoundedBox args={[plot.size, 0.5, plot.size]} radius={0.2} smoothness={3} position={[0, plot.height - 0.25, 0]} receiveShadow material={std(tint, 0.7, 0.05)} />
          <mesh geometry={G.box} scale={[plot.size + 0.06, 0.1, plot.size + 0.06]} position={[0, plot.height - 0.42, 0]} material={std(PALETTE.plotSide)} />
          <lineLoop geometry={edge} position={[0, plot.height + 0.01, 0]}>
            <lineBasicMaterial color={plot.color} toneMapped={false} />
          </lineLoop>
        </group>

        {/* building */}
        <group position={[plot.buildingPos[0], plot.height, plot.buildingPos[1]]} rotation={[0, plot.rot, 0]}>
          <Building type={plot.building} color={plot.color} visuals={visuals} />
        </group>

        {/* work area */}
        {plot.desks.map((d, i) => (
          <group key={i} position={[d.desk[0], plot.height, d.desk[1]]} rotation={[0, plot.rot, 0]}>
            <Desk screen={visuals.screens[i % 3]} accent={visuals.glow} />
          </group>
        ))}
        <group position={[plot.station.pos[0], plot.height, plot.station.pos[1]]} rotation={[0, plot.rot, 0]}>
          <Station screen={visuals.screens[(plot.index + 1) % 3]} accent={visuals.glow} />
        </group>
        {/* plants sway via a vertex shader, so they can be batched too */}
        {plot.plants.map((p, i) => (
          <group key={i} position={[p[0], plot.height, p[1]]}>
            <Plant variant={i + plot.index} />
          </group>
        ))}
      </StaticBatch>
      <group position={[plot.buildingPos[0], plot.height, plot.buildingPos[1]]} rotation={[0, plot.rot, 0]}>
        <ActivityBeacons teamId={plot.teamId} color={plot.color} y={3.7} />
      </group>
      {lights && <pointLight position={[plot.center[0] + 1.5, 2.2, plot.center[1] + 1.5]} color={plot.color} intensity={6} distance={9} decay={1.6} />}
      <Html position={plot.labelPos} center zIndexRange={[30, 10]} portal={labelLayer as RefObject<HTMLElement>} style={{ pointerEvents: 'auto' }}>
        <DepartmentLabel runtime={runtime} teamId={plot.teamId} name={plot.name} icon={plot.icon} color={plot.color} />
      </Html>
    </group>
  )
}

export const Department = memo(DepartmentImpl)
