// Deterministic, seedable PRNG (mulberry32). Seeding per-career and per-match
// makes the whole simulation reproducible — required by the Match Engine bible
// for debugging, and it makes save/reload bulletproof.

export class RNG {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  // float in [0, 1)
  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // float in [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  // int in [min, max] inclusive
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  // Right-skewed draw in [0,1): bias toward low values, long thin tail of high.
  // Used by youth potential generation.
  skewed(power = 2.2): number {
    return Math.pow(this.next(), power)
  }

  bool(pTrue: number): boolean {
    return this.next() < pTrue
  }
}

// Mix a base seed with arbitrary integers to derive sub-seeds deterministically.
export function deriveSeed(base: number, ...parts: number[]): number {
  let h = base >>> 0
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x01000193) >>> 0
  }
  return h >>> 0
}
