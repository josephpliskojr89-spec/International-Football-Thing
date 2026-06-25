// The development engine (NTM_Development_and_Eligibility_v1, Part 1). A batch
// pass that moves a player's REAL ability invisibly:
//   - Below his ceiling and young -> he GROWS toward potential, fastest in the
//     late teens, gated by playing time (a talented kid not playing stalls).
//   - Past his peak age -> he DECLINES; keepers and defenders age slower.
// The player never sees this — his knowledge only updates via scouting coverage.
//
// Ratings are kept as floats here so small weekly changes accumulate instead of
// being rounded away; display/known reads round on sync.

import type { Player, Ratings } from './types'
import { peakAge } from './ageCurve'
import { overallForRaw } from './playerGen'
import { RNG } from './rng'

const GROWTH_WEEKLY = 0.02 // fraction of the remaining gap closed per week at full pace
const DECLINE_WEEKLY = 0.0009 // base per-week decline once past peak

export function developPlayerWeek(p: Player, rng: RNG): Player {
  const peak = peakAge(p.position)
  const real = overallForRaw(p.position, p.ratings)
  if (real <= 0) return p // guard: scaling by 0 would blow ratings to Infinity
  let newOverall = real

  if (p.age <= peak) {
    const gap = p.potential - real
    if (gap > 0.3) {
      // Playing time dominates: a benched kid (low PT) barely moves.
      const pace = GROWTH_WEEKLY * growthAgeFactor(p.age) * (0.1 + 0.9 * p.playingTime)
      newOverall = real + gap * pace * rng.range(0.6, 1.2)
    }
  } else {
    const yearsPast = p.age - peak
    const slowing = p.position === 'GK' ? 0.5 : p.position === 'DF' ? 0.7 : 1
    newOverall = real - real * DECLINE_WEEKLY * (1 + yearsPast * 0.1) * slowing * rng.range(0.6, 1.2)
  }

  if (Math.abs(newOverall - real) < 0.001) return p
  const scale = newOverall / real
  const ratings = scaleRatings(p.ratings, scale)
  return { ...p, ratings, overall: Math.round(overallForRaw(p.position, ratings)) }
}

// How fast a player still grows by age — high in the teens, ~0 by peak.
function growthAgeFactor(age: number): number {
  if (age <= 18) return 1
  if (age <= 20) return 0.8
  if (age <= 22) return 0.55
  if (age <= 24) return 0.32
  if (age <= 26) return 0.16
  return 0.07
}

export function agePlayerOneYear(p: Player): Player {
  return { ...p, age: p.age + 1 }
}

// Scale ratings as floats (no rounding) so sub-point weekly growth survives.
function scaleRatings(r: Ratings, scale: number): Ratings {
  const s = (v: number) => clamp(v * scale, 12, 99)
  return {
    finishing: s(r.finishing),
    pace: s(r.pace),
    technique: s(r.technique),
    passing: s(r.passing),
    physical: s(r.physical),
    mental: s(r.mental),
    defending: s(r.defending),
    goalkeeping: s(r.goalkeeping),
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
