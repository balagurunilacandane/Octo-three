export type Quality = 'low' | 'medium' | 'high'

export interface QualitySettings {
  tier: Quality
  dpr: [number, number]
  shadows: boolean
  shadowMapSize: number
  postprocessing: boolean
  particles: number
  maxAgentsPerTeam: number
}

export function detectQuality(): QualitySettings {
  // Explicit override: ?quality=low|medium|high
  const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('quality') : null
  if (forced === 'low' || forced === 'medium' || forced === 'high') return QUALITY[forced]
  const w = typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight) : 1024
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
  const tier: Quality = coarse && w < 600 ? 'low' : coarse || cores <= 4 ? 'medium' : 'high'
  return QUALITY[tier]
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { tier: 'low', dpr: [1, 1.25], shadows: false, shadowMapSize: 512, postprocessing: false, particles: 0.35, maxAgentsPerTeam: 3 },
  medium: { tier: 'medium', dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, postprocessing: true, particles: 0.6, maxAgentsPerTeam: 6 },
  high: { tier: 'high', dpr: [1, 2], shadows: true, shadowMapSize: 2048, postprocessing: true, particles: 1, maxAgentsPerTeam: 8 },
}
