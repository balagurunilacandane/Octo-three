import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { G } from './materials'
import { useRuntime } from './RuntimeContext'

const PER_PATH = 12
const dummy = new THREE.Object3D()
const tmp = new THREE.Color()

/**
 * Glowing paths connecting every department to the Brain, with a stream of
 * light particles whose density and speed follow the department's activity.
 */
export function DataPaths({ density = 1 }: { density?: number }) {
  const { runtime } = useRuntime()
  const plots = runtime.layout.plots
  const flow = useRef<THREE.InstancedMesh>(null)

  const paths = useMemo(
    () =>
      plots.map((p) => {
        const dir = new THREE.Vector2(-p.center[0], -p.center[1]).normalize()
        const start = new THREE.Vector3(p.gate[0] + dir.x * 0.5, 0.025, p.gate[1] + dir.y * 0.5)
        const end = new THREE.Vector3(p.dock[0] - dir.x * 0.05, 0.025, p.dock[1] - dir.y * 0.05)
        const len = start.distanceTo(end)
        const mid = start.clone().lerp(end, 0.5)
        const angle = Math.atan2(end.x - start.x, end.z - start.z)
        return { teamId: p.teamId, color: new THREE.Color(p.color), start, end, len, mid, angle }
      }),
    [plots],
  )

  const phases = useRef(paths.map(() => 0))

  useFrame((_, dt) => {
    const mesh = flow.current
    if (!mesh) return
    let n = 0
    paths.forEach((p, pi) => {
      const act = runtime.activityOf(p.teamId)
      phases.current[pi] = (phases.current[pi] ?? 0) + dt * (0.12 + act * 0.5)
      const visible = Math.round((3 + act * (PER_PATH - 3)) * density)
      for (let i = 0; i < PER_PATH; i++) {
        const inbound = i % 2 === 0
        let k = (phases.current[pi] + i / PER_PATH) % 1
        if (!inbound) k = 1 - k
        dummy.position.lerpVectors(p.start, p.end, k)
        dummy.position.y = 0.07
        const off = inbound ? -0.12 : 0.12
        dummy.position.x += Math.cos(p.angle) * off
        dummy.position.z -= Math.sin(p.angle) * off
        dummy.scale.setScalar(i < visible ? 0.06 + act * 0.03 : 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(n, dummy.matrix)
        tmp.copy(inbound ? p.color : tmp.set('#a5f3fc')).multiplyScalar(2)
        mesh.setColorAt(n, tmp)
        n++
      }
    })
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <group>
      {paths.map((p) => (
        <group key={p.teamId} position={p.mid} rotation={[0, p.angle, 0]}>
          <mesh geometry={G.box} scale={[0.72, 0.03, p.len]} position={[0, -0.01, 0]} receiveShadow>
            <meshStandardMaterial color="#ffb3dd" roughness={0.6} />
          </mesh>
          <mesh geometry={G.box} scale={[0.05, 0.035, p.len]} position={[-0.25, 0, 0]}>
            <meshBasicMaterial color={p.color} toneMapped={false} />
          </mesh>
          <mesh geometry={G.box} scale={[0.05, 0.035, p.len]} position={[0.25, 0, 0]}>
            <meshBasicMaterial color="#67e8f9" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={flow} args={[G.sphereLo, undefined, Math.max(1, paths.length * PER_PATH)]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
