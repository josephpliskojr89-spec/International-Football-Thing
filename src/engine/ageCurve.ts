import type { Position } from './types'

// The age curve, shared by generation and development so they never disagree.
// maturityFactor = the fraction of a player's hidden potential that his AGE
// alone makes available. A 16-year-old is far below his ceiling; a peak-age
// player sits at it; an older player has slipped below it. Keepers and
// defenders peak later and decline slower (per the development bible).

export function peakAge(position: Position): number {
  return position === 'GK' ? 31 : position === 'DF' ? 29 : 27
}

export function maturityFactor(age: number, position: Position): number {
  const peak = peakAge(position)
  if (age <= peak) {
    // 0.55 at 16 -> 1.0 at peak
    const t = (age - 16) / (peak - 16)
    return clamp(0.55 + Math.max(0, t) * 0.45, 0.55, 1)
  }
  const declinePerYear = position === 'GK' ? 0.006 : position === 'DF' ? 0.009 : 0.014
  return clamp(1 - (age - peak) * declinePerYear, 0.55, 1)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
