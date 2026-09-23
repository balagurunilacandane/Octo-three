import * as THREE from 'three'

// Shared geometries & materials. Creating these once and reusing them keeps
// draw-call state changes and GPU memory low when hundreds of props exist.

const stdCache = new Map<string, THREE.MeshStandardMaterial>()
const neonCache = new Map<string, THREE.MeshStandardMaterial>()

export function std(color: string, roughness = 0.55, metalness = 0.15): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`
  let m = stdCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    stdCache.set(key, m)
  }
  return m
}

/** Emissive "neon" material. Intensity > 1 feeds the bloom pass. */
export function neon(color: string, intensity = 2.2): THREE.MeshStandardMaterial {
  const key = `${color}|${intensity}`
  let m = neonCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0, toneMapped: false })
    neonCache.set(key, m)
  }
  return m
}

/** A per-owner emissive material whose intensity can be animated (e.g. activity level). */
export function animatedNeon(color: string, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, toneMapped: false })
}

export const glass = new THREE.MeshPhysicalMaterial({
  color: '#a5f3fc',
  roughness: 0.08,
  metalness: 0,
  transmission: 0.6,
  thickness: 0.4,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
})

export const PALETTE = {
  background: '#121212',
  platformTop: '#1d1d1f',
  platformTopAlt: '#232325',
  platformSide: '#141415',
  platformDeep: '#0d0d0e',
  lane: '#151516',
  plot: '#2a2a2d',
  plotSide: '#18181a',
  path: '#2e2e31',
  dark: '#1b1b1d',
  darker: '#111112',
  white: '#e7e5e1',
  offWhite: '#c9c7c2',
  wood: '#8a8278',
  desk: '#d9d6d0',
  deskLeg: '#3a3a3d',
  metal: '#6b6b70',
  plant: '#2f5a45',
  plantDark: '#244636',
  pot: '#3c3c40',
  head: '#161618',
  body: '#2b2b2e',
}

/** Quiet, desaturated version of a team colour for large surfaces (plots). */
export function mutedSurface(color: string): string {
  const c = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  return '#' + c.setHSL(hsl.h, Math.min(hsl.s, 0.9) * 0.26, 0.145).getHexString()
}

/** Soft accent version of a team colour for dots, lines and small highlights. */
export function mutedAccent(color: string): string {
  const c = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  return '#' + c.setHSL(hsl.h, Math.min(hsl.s, 0.9) * 0.55, 0.66).getHexString()
}

// geometries
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 18, 12),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 16),
  torus: new THREE.TorusGeometry(1, 0.04, 8, 48),
  torusThick: new THREE.TorusGeometry(1, 0.12, 10, 40),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  plane: new THREE.PlaneGeometry(1, 1),
  octa: new THREE.OctahedronGeometry(1, 0),
  ico: new THREE.IcosahedronGeometry(1, 1),
  ring: new THREE.RingGeometry(0.8, 1, 40),
}

/** Shared clock for vertex-animated materials (updated by the world loop). */
export const windUniform = { value: 0 }
const plantCache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * Foliage material with a tiny vertex-shader sway, so plants can be merged
 * into static batches and still move slightly.
 */
export function plant(color: string): THREE.MeshStandardMaterial {
  let m = plantCache.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = windUniform
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float h = wp.y - 0.18; // height above the plot (plants are batched in world space)
          float sway = sin(uWind * 1.4 + wp.x * 0.7 + wp.z * 0.5) * 0.035 * smoothstep(0.35, 1.0, h);
          transformed.x += sway;
          transformed.z += sway * 0.6;`,
        )
    }
    m.customProgramCacheKey = () => 'plant-wind'
    plantCache.set(color, m)
  }
  return m
}
