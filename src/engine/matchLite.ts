// Tier-3 resolution (NTM_Tournament_Structure_v1, Part 5). Non-playable nations
// carry only ratings — no squad is ever generated. This uses the same Poisson
// backbone as the full engine so its scorelines feel consistent with the rest
// of the world, at a fraction of the cost.

import { MATCH } from '@/data/constants'
import { RNG, poisson } from './rng'

export interface LiteResult {
  goalsA: number
  goalsB: number
}

export function simulateLite(
  nationRatingA: number,
  nationRatingB: number,
  homeIsA: boolean,
  seed: number,
): LiteResult {
  const rng = new RNG(seed >>> 0)

  const strengthA = nationRatingA * (homeIsA ? MATCH.homeBonus : 1) * rng.range(0.95, 1.08)
  const strengthB = nationRatingB * (!homeIsA ? MATCH.homeBonus : 1) * rng.range(0.95, 1.08)

  // Scale the strength delta into xG around the same ~1.3 balanced baseline.
  const xgA = Math.max(MATCH.xgFloor, MATCH.baseChances * (strengthA / strengthB))
  const xgB = Math.max(MATCH.xgFloor, MATCH.baseChances * (strengthB / strengthA))

  return { goalsA: poisson(rng, xgA), goalsB: poisson(rng, xgB) }
}

