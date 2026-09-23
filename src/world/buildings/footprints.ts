import type { BuildingType } from '../../domain/types'

/** Collision / navigation footprint for each building type (local width, depth, height). */
export const BUILDING_FOOTPRINTS: Record<BuildingType, { w: number; d: number; h: number }> = {
  research: { w: 4.1, d: 2.4, h: 3.2 },
  strategy: { w: 3.0, d: 2.6, h: 3.6 },
  data: { w: 4.6, d: 2.2, h: 2.8 },
  design: { w: 4.1, d: 2.4, h: 3.0 },
  operations: { w: 3.7, d: 2.4, h: 3.0 },
  product: { w: 4.1, d: 2.4, h: 3.0 },
  marketing: { w: 3.4, d: 2.4, h: 3.4 },
  studio: { w: 4.3, d: 2.4, h: 2.9 },
  engineering: { w: 3.0, d: 2.4, h: 3.8 },
  generic: { w: 3.2, d: 2.4, h: 2.8 },
}
