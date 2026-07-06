// The manager's career: what the board demands, how the world rates you, when
// you get sacked — and who comes calling. Reputation is the through-line of a
// multi-decade save: fail upward out of a giant, or build a minnow into a
// force until the giant calls YOU.

import type { Career, WorldState } from './types'
import { ALL_NATIONS, ALL_NATIONS_BY_ID } from '@/data/nations'
import { ratingOf, worldRankOf } from './world'
import { RNG, deriveSeed } from './rng'

export const SACK_THRESHOLD = 28

export function reputationLabel(rep: number): string {
  if (rep >= 80) return 'Legendary'
  if (rep >= 60) return 'Admired'
  if (rep >= 40) return 'Respected'
  if (rep >= 20) return 'Under pressure'
  return 'On the brink'
}

// What the board demands of the cycle, from the nation's standing when it opens.
export function cycleObjective(world: WorldState, nationId: string): { text: string; tier: number } {
  const rank = worldRankOf(world, nationId)
  if (rank > 0 && rank <= 4) return { tier: 3, text: 'Reach the World Cup semi-finals. Anything less is failure.' }
  if (rank > 0 && rank <= 8) return { tier: 2, text: 'Reach the World Cup quarter-finals.' }
  if (rank > 0 && rank <= 16) return { tier: 1, text: 'Qualify for the World Cup.' }
  return { tier: 0, text: 'Be competitive in qualifying — finish in the top four of the group.' }
}

// Did the cycle meet the board's demand?
export function objectiveMet(career: Career): boolean {
  const tier = career.objective?.tier ?? 1
  const wc = career.lastWcOutcome
  if (tier === 3) return wc === 'WON' || wc === 'FINAL' || wc === 'SEMI'
  if (tier === 2) return wc === 'WON' || wc === 'FINAL' || wc === 'SEMI' || wc === 'QUARTER'
  if (tier === 1) return wc !== null && wc !== 'MISSED'
  return (wc !== null && wc !== 'MISSED') || (career.lastCampaignPosition !== null && career.lastCampaignPosition <= 4)
}

export function clampRep(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

// Job offers for a sacked manager: nations that would still have you — weaker
// sides, hungrier boards. Always at least two doors open; football forgives.
export function sackOffers(career: Career, seed: number): string[] {
  const myRating = ratingOf(career.world, career.managerNationId)
  const rng = new RNG(deriveSeed(seed, career.season, 0x5ac))
  const pool = ALL_NATIONS.filter(
    (n) => n.isPlayable && n.id !== career.managerNationId && ratingOf(career.world, n.id) < myRating - 2,
  ).sort((a, b) => ratingOf(career.world, b.id) - ratingOf(career.world, a.id))
  const fallback = ALL_NATIONS.filter((n) => n.isPlayable && n.id !== career.managerNationId)
    .sort((a, b) => ratingOf(career.world, a.id) - ratingOf(career.world, b.id))
    .slice(0, 3)
  const candidates = pool.length >= 2 ? pool : fallback
  const picks = new Set<string>()
  let guard = 0
  while (picks.size < Math.min(3, candidates.length) && guard++ < 40) {
    picks.add(candidates[rng.int(0, candidates.length - 1)].id)
  }
  return [...picks]
}

// A poaching approach for a successful manager: a stronger nation whose board
// is dreaming. Rare, rep-gated, irresistible drama.
export function poachOffer(career: Career, seed: number): string | null {
  if (career.reputation < 65) return null
  const rng = new RNG(deriveSeed(seed, career.season, 0x90ac))
  if (!rng.bool(0.45)) return null
  const myRating = ratingOf(career.world, career.managerNationId)
  const suitors = ALL_NATIONS.filter(
    (n) => n.isPlayable && n.id !== career.managerNationId && ratingOf(career.world, n.id) > myRating + 2,
  )
  if (suitors.length === 0) return null
  return suitors[rng.int(0, suitors.length - 1)].id
}

export function nationName(id: string): string {
  return ALL_NATIONS_BY_ID[id]?.name ?? id
}
