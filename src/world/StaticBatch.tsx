import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Mark an object (and its subtree) as animated so StaticBatch leaves it alone. */
export const DYNAMIC = { dynamic: true } as const

/**
 * Merges every static mesh under it into one mesh per material after mount.
 * Procedural buildings are authored as many small primitives; batching them
 * turns hundreds of draw calls per department into a few dozen while shared,
 * animated materials (screens, activity glow) keep animating. Subtrees whose
 * userData has `dynamic: true` are left untouched so they can keep moving.
 */
export function StaticBatch({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const root = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const group = root.current
    if (!group || !enabled) return
    group.updateWorldMatrix(true, true)
    const inv = group.matrixWorld.clone().invert()
    const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>()
    const hidden: THREE.Mesh[] = []

    const visit = (o: THREE.Object3D) => {
      if (o.userData.dynamic) return
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !(mesh as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material) && mesh.visible) {
        const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
        for (const name of Object.keys(src.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') src.deleteAttribute(name)
        if (!src.attributes.uv) src.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2))
        if (!src.attributes.normal) src.computeVertexNormals()
        src.applyMatrix4(inv.clone().multiply(mesh.matrixWorld))
        src.morphAttributes = {}
        const b = buckets.get(mesh.material) ?? { geos: [], cast: false, receive: false }
        b.geos.push(src)
        b.cast ||= mesh.castShadow
        b.receive ||= mesh.receiveShadow
        buckets.set(mesh.material, b)
        hidden.push(mesh)
      }
      for (const c of o.children) visit(c)
    }
    for (const c of group.children) visit(c)

    const merged: THREE.Mesh[] = []
    for (const [material, b] of buckets) {
      const geo = mergeGeometries(b.geos, false)
      b.geos.forEach((g) => g.dispose())
      if (!geo) continue
      const m = new THREE.Mesh(geo, material)
      m.castShadow = b.cast
      m.receiveShadow = b.receive
      m.userData.batched = true
      merged.push(m)
      group.add(m)
    }
    for (const m of hidden) m.visible = false

    return () => {
      for (const m of merged) {
        group.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.visible = true
    }
  }, [enabled])

  return <group ref={root}>{children}</group>
}
