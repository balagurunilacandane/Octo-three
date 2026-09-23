import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { G } from '../world/materials'
import { useRuntime } from '../world/RuntimeContext'

const POOL = 64
const TRAIL = 8
const dummy = new THREE.Object3D()
const col = new THREE.Color()
const p = new THREE.Vector3()

/**
 * Pooled data packets. Every active transfer in the runtime is drawn as a
 * glowing head plus a fading trail sampled along its CatmullRom curve —
 * one instanced draw call for all packets in the world.
 */
export function TaskParticles() {
  const { runtime } = useRuntime()
  const mesh = useRef<THREE.InstancedMesh>(null)
  const halo = useRef<THREE.InstancedMesh>(null)

  useFrame(({ clock }) => {
    const m = mesh.current
    const h = halo.current
    if (!m || !h) return
    const t = clock.elapsedTime
    let n = 0
    let hn = 0
    for (const tr of runtime.transfers.slice(0, POOL)) {
      const pulse = 1 + Math.sin(t * 14 + tr.t * 10) * 0.18
      for (let i = 0; i < TRAIL; i++) {
        const k = tr.t - i * 0.022
        if (k < 0) break
        tr.curve.getPointAt(Math.min(1, k), p)
        const fade = 1 - i / TRAIL
        dummy.position.copy(p)
        dummy.scale.setScalar((i === 0 ? 0.12 * pulse : 0.07 * fade) + 0.01)
        dummy.updateMatrix()
        m.setMatrixAt(n, dummy.matrix)
        col.copy(tr.color).multiplyScalar(i === 0 ? 1.3 : 0.5 + fade * 0.6)
        m.setColorAt(n, col)
        n++
      }
      tr.curve.getPointAt(Math.min(1, tr.t), p)
      dummy.position.copy(p)
      dummy.scale.setScalar(0.24 * pulse)
      dummy.updateMatrix()
      h.setMatrixAt(hn, dummy.matrix)
      h.setColorAt(hn, col.copy(tr.color).multiplyScalar(0.35))
      hn++
    }
    m.count = n
    h.count = hn
    m.instanceMatrix.needsUpdate = true
    h.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    if (h.instanceColor) h.instanceColor.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[G.sphereLo, undefined, POOL * TRAIL]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[G.sphereLo, undefined, POOL]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  )
}
