import { createContext, useContext, type RefObject } from 'react'
import type { WorldRuntime } from '../sim/WorldRuntime'
import type { ScreenMaterial } from '../shaders/screenMaterial'

export interface TeamVisuals {
  /** Screen shader materials for this team (bars / text / wave). */
  screens: ScreenMaterial[]
  /** Emissive accent material whose intensity follows activity. */
  glow: import('three').MeshStandardMaterial
}

export interface RuntimeContextValue {
  runtime: WorldRuntime
  teamVisuals: Record<string, TeamVisuals>
  /** DOM layer (outside the canvas) that hosts <Html> labels — a stable portal target. */
  labelLayer: RefObject<HTMLDivElement | null>
}

export const RuntimeContext = createContext<RuntimeContextValue | null>(null)

export function useRuntime(): RuntimeContextValue {
  const v = useContext(RuntimeContext)
  if (!v) throw new Error('useRuntime must be used inside <RuntimeContext.Provider>')
  return v
}
