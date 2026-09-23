let counter = 0
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1e6
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${counter.toString(36)}`
}

/** Deterministic hash → [0,1). Used for stable pseudo-random placement. */
export function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}
