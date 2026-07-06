// Individual honours. The World Player of the Year is drawn from EVERY nation's
// current (generational) squad plus the manager's own pool — so the winner is a
// real, persistent person you can go and watch, and a great player can build a
// dynasty of awards across his peak years. Winning a title that season helps,
// exactly like the real vote.

import type { Career } from './types'
import { ALL_NATIONS, NATIONS_BY_ID } from '@/data/nations'
import { generateSquadForNation } from './playerGen'
import { ratingOf } from './world'
import { RNG, deriveSeed, hashStr } from './rng'

export interface PlayerOfYear {
  name: string
  nationId: string
  isYours: boolean
  overall: number
}

// Deterministic per (career, season): re-computing gives the same winner.
export function worldPlayerOfTheYear(career: Career, season: number): PlayerOfYear {
  // Which nations lifted silverware this season? (the "vote" leans their way)
  const winners = new Set(
    career.history
      .filter((h) => h.season === season && (h.type === 'WORLD_CUP' || h.type === 'CONTINENTAL' || h.type === 'FOREIGN_CONTINENTAL'))
      .map((h) => h.nationId)
      .filter(Boolean) as string[],
  )
  if (career.trophies.some((t) => t.season === season)) winners.add(career.managerNationId)

  let best: PlayerOfYear | null = null
  let bestScore = -Infinity
  const consider = (name: string, nationId: string, overall: number, isYours: boolean, jitter: number) => {
    const score = overall + (winners.has(nationId) ? 3.5 : 0) + jitter
    if (score > bestScore) {
      bestScore = score
      best = { name, nationId, isYours, overall: Math.round(overall) }
    }
  }

  for (const n of ALL_NATIONS) {
    if (!n.isPlayable || n.id === career.managerNationId) continue
    const squad = generateSquadForNation(n, career.seed, season, ratingOf(career.world, n.id))
    for (const p of squad) {
      const jitter = new RNG(deriveSeed(career.seed, season, hashStr(p.id))).range(0, 2)
      consider(p.name, n.id, p.overall, false, jitter)
    }
  }
  for (const p of career.players) {
    const jitter = new RNG(deriveSeed(career.seed, season, hashStr(p.id))).range(0, 2)
    // Your players are judged on their real ability + form (a hot year counts).
    consider(p.name, career.managerNationId, p.overall + (p.form - 60) * 0.05, true, jitter)
  }

  return (
    best ?? {
      name: 'Unknown',
      nationId: career.managerNationId,
      isYours: false,
      overall: 0,
    }
  )
}

// Player of the Tournament, named when a finals tournament concludes. If YOUR
// nation won it, the honour goes to your best (form-weighted) starter; if not,
// the champion's best generational player takes it.
export function playerOfTheTournament(
  career: Career,
  championId: string,
): { name: string; nationId: string; isYours: boolean } {
  if (championId === career.managerNationId) {
    const xiIds = new Set(Object.values(career.lineup).filter(Boolean) as string[])
    const xi = career.players.filter((p) => xiIds.has(p.id))
    const star = [...xi].sort((a, b) => b.overall + b.form * 0.1 - (a.overall + a.form * 0.1))[0]
    if (star) return { name: star.name, nationId: championId, isYours: true }
  }
  const nation = NATIONS_BY_ID[championId]
  if (nation) {
    const squad = generateSquadForNation(nation, career.seed, career.season, ratingOf(career.world, championId))
    const star = [...squad].sort((a, b) => b.overall - a.overall)[0]
    if (star) return { name: star.name, nationId: championId, isYours: false }
  }
  return { name: 'their captain', nationId: championId, isYours: false }
}
