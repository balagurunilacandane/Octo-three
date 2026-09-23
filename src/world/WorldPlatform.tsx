import { RoundedBox, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, CylinderCollider } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ENV_GROUPS } from '../agents/AgentPhysics'
import type { WorldLayout } from './layout'
import { PALETTE } from './materials'
import { useWorld } from '../state/worldStore'

/** The floating island: magenta top, dark purple walls, neon edge, underside rock + particles. */
export function WorldPlatform({ layout, particles = 1 }: { layout: WorldLayout; particles?: number }) {
  const size = layout.half * 2
  const edgeMat = useRef<THREE.LineBasicMaterial>(null)
  const select = useWorld((s) => s.select)

  const edge = useMemo(() => {
    const h = layout.half - 0.05
    const r = 0.5
    const pts: THREE.Vector3[] = []
    const corners: [number, number, number][] = [
      [h - r, h - r, 0],
      [-h + r, h - r, Math.PI / 2],
      [-h + r, -h + r, Math.PI],
      [h - r, -h + r, (3 * Math.PI) / 2],
    ]
    for (const [cx, cz, a0] of corners)
      for (let i = 0; i <= 8; i++) {
        const a = a0 + (i / 8) * (Math.PI / 2)
        pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r))
      }
    pts.push(pts[0].clone())
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [layout.half])

  // Subtle grid on the platform surface.
  const grid = useMemo(() => {
    const pts: number[] = []
    const h = layout.half - 0.6
    for (let x = -h; x <= h + 0.01; x += 2) pts.push(x, 0, -h, x, 0, h)
    for (let z = -h; z <= h + 0.01; z += 2) pts.push(-h, 0, z, h, 0, z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [layout.half])

  useFrame(({ clock }) => {
    if (edgeMat.current) edgeMat.current.opacity = 0.35 + Math.sin(clock.elapsedTime * 0.6) * 0.1
  })

  return (
    <group>
      {/* top slab */}
      <RoundedBox
        args={[size, 0.6, size]}
        radius={0.28}
        smoothness={4}
        position={[0, -0.3, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta < 6) select(null) // ignore clicks that end a camera drag
        }}
      >
        <meshStandardMaterial color={PALETTE.platformTop} roughness={0.9} metalness={0.02} />
      </RoundedBox>
      <lineSegments geometry={grid} position={[0, 0.005, 0]}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.035} depthWrite={false} />
      </lineSegments>
      {/* side walls */}
      <RoundedBox args={[size - 0.3, 2.4, size - 0.3]} radius={0.35} smoothness={3} position={[0, -1.7, 0]}>
        <meshStandardMaterial color={PALETTE.platformSide} roughness={0.6} metalness={0.2} />
      </RoundedBox>
      <RoundedBox args={[size - 0.2, 0.12, size - 0.2]} radius={0.05} position={[0, -0.95, 0]}>
        <meshStandardMaterial color="#26262a" roughness={0.6} />
      </RoundedBox>
      {/* neon top edge */}
      <lineLoop geometry={edge} position={[0, 0.02, 0]}>
        <lineBasicMaterial ref={edgeMat} color="#8a8a92" transparent opacity={0.4} />
      </lineLoop>
      {/* underside rock */}
      <mesh position={[0, -2.9 - size * 0.18, 0]} rotation={[Math.PI, Math.PI / 4, 0]}>
        <coneGeometry args={[size * 0.62, size * 0.42, 4, 1]} />
        <meshStandardMaterial color={PALETTE.platformDeep} roughness={0.9} flatShading />
      </mesh>
      <Sparkles count={Math.round(70 * particles)} scale={[size * 1.1, 8, size * 1.1]} position={[0, -5, 0]} size={8} speed={0.25} color="#cfcfd6" opacity={0.25} />
      <Sparkles count={Math.round(40 * particles)} scale={[size * 1.2, 6, size * 1.2]} position={[0, 3, 0]} size={5} speed={0.15} color="#e5e5ea" opacity={0.2} />
    </group>
  )
}

/** Static colliders for everything agents must not walk through. */
export function WorldColliders({ layout }: { layout: WorldLayout }) {
  const h = layout.half
  return (
    <RigidBody type="fixed" colliders={false}>
      {layout.obstacles.map((o, i) =>
        o.r !== undefined ? (
          <CylinderCollider key={i} args={[o.height / 2, o.r]} position={[o.c[0], o.height / 2, o.c[1]]} collisionGroups={ENV_GROUPS} />
        ) : (
          <CuboidCollider key={i} args={[o.hx, o.height / 2, o.hz]} position={[o.c[0], o.height / 2, o.c[1]]} rotation={[0, o.rot, 0]} collisionGroups={ENV_GROUPS} />
        ),
      )}
      {/* platform boundary walls */}
      <CuboidCollider args={[h, 1, 0.2]} position={[0, 1, h - 0.4]} collisionGroups={ENV_GROUPS} />
      <CuboidCollider args={[h, 1, 0.2]} position={[0, 1, -h + 0.4]} collisionGroups={ENV_GROUPS} />
      <CuboidCollider args={[0.2, 1, h]} position={[h - 0.4, 1, 0]} collisionGroups={ENV_GROUPS} />
      <CuboidCollider args={[0.2, 1, h]} position={[-h + 0.4, 1, 0]} collisionGroups={ENV_GROUPS} />
    </RigidBody>
  )
}
