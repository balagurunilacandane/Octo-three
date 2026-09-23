import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import type { BuildingType } from '../domain/types'
import { ASSET_MANIFEST } from '../assets/manifest'
import { buildingTypes, type BuildingProps } from './buildings/Buildings'

function GltfBuilding({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(true), [scene])
  return <primitive object={clone} />
}

/**
 * Renders a department building. If a GLB is registered for the type in the
 * asset manifest it is used; otherwise the procedural building is rendered.
 * Custom team types fall back to the generic building.
 */
export function Building({ type, ...props }: BuildingProps & { type: BuildingType }) {
  const glb = ASSET_MANIFEST.buildings[type]
  const Procedural = buildingTypes[type] ?? buildingTypes.generic
  if (glb) {
    return (
      <Suspense fallback={<Procedural {...props} />}>
        <GltfBuilding url={glb} />
      </Suspense>
    )
  }
  return <Procedural {...props} />
}
