import { RoundedBox } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import type * as THREE from 'three'
import { G, std } from '../materials'

type MeshProps = Omit<ThreeElements['mesh'], 'args' | 'ref'> & { material: THREE.Material }
type V3 = [number, number, number]

/** Small primitives over shared geometries. `s` is the scale (size). */
export function Box({ s, ...p }: MeshProps & { s: V3 }) {
  return <mesh geometry={G.box} scale={s} castShadow receiveShadow {...p} />
}
export function Cyl({ r, h, lo, ...p }: MeshProps & { r: number; h: number; lo?: boolean }) {
  return <mesh geometry={lo ? G.cylLo : G.cyl} scale={[r, h, r]} castShadow receiveShadow {...p} />
}
export function Ball({ r, lo, ...p }: MeshProps & { r: number | V3; lo?: boolean }) {
  return <mesh geometry={lo ? G.sphereLo : G.sphere} scale={typeof r === 'number' ? [r, r, r] : r} castShadow {...p} />
}
export function Rounded({ size, radius = 0.18, color, material, ...p }: Omit<ThreeElements['mesh'], 'args' | 'ref'> & { size: V3; radius?: number; color?: string; material?: THREE.Material }) {
  return <RoundedBox args={size} radius={radius} smoothness={3} castShadow receiveShadow material={material ?? std(color ?? '#ffffff')} {...p} />
}

/** A flat screen with a thin dark bezel. */
export function Screen({ w, h, material, ...p }: Omit<ThreeElements['group'], 'args' | 'ref'> & { w: number; h: number; material: THREE.Material }) {
  return (
    <group {...p}>
      <mesh geometry={G.box} scale={[w + 0.08, h + 0.08, 0.06]} material={std('#1e1b4b', 0.4, 0.3)} castShadow />
      <mesh geometry={G.plane} scale={[w, h, 1]} position={[0, 0, 0.032]} material={material} />
    </group>
  )
}

/** Door with neon frame. */
export function Door({ glow, w = 0.7, h = 1.05, ...p }: Omit<ThreeElements['group'], 'args' | 'ref'> & { glow: THREE.Material; w?: number; h?: number }) {
  return (
    <group {...p}>
      <mesh geometry={G.box} scale={[w, h, 0.05]} position={[0, h / 2, 0]} material={std('#1e1b4b', 0.3, 0.4)} />
      <mesh geometry={G.box} scale={[w + 0.1, 0.05, 0.07]} position={[0, h + 0.02, 0]} material={glow} />
      <mesh geometry={G.box} scale={[0.05, h, 0.07]} position={[-w / 2 - 0.03, h / 2, 0]} material={glow} />
      <mesh geometry={G.box} scale={[0.05, h, 0.07]} position={[w / 2 + 0.03, h / 2, 0]} material={glow} />
    </group>
  )
}
