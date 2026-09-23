import type { BuildingType } from '../domain/types'

/**
 * Optional GLB overrides for the procedural assets.
 *
 * Drop compressed (Draco / Meshopt) .glb files in `public/assets/world/…` and
 * register them here, e.g.
 *
 *   buildings: { research: '/assets/world/buildings/research.glb' }
 *
 * Buildings are authored in the local frame used by the procedural versions:
 * origin at ground centre, +Z facing the camera, footprint as in
 * `world/buildings/footprints.ts` (the footprint also drives collision + nav).
 */
export interface AssetManifest {
  buildings: Partial<Record<BuildingType, string>>
  agent?: string
  props: Partial<Record<'desk' | 'monitor' | 'server' | 'plant' | 'lamp', string>>
}

export const ASSET_MANIFEST: AssetManifest = {
  buildings: {},
  props: {},
}
