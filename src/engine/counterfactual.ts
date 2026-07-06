// The Road Not Taken: a complete simulation of the timeline where you never
// took the job. Same seed, same starting world, same deterministic engines —
// but no manager anywhere. The world plays its windows, crowns its continental
// champions, holds its World Cups, and drifts through its eras entirely on its
// own. Compare it to your almanac and you can see, season by season, exactly
// which pieces of history exist because YOU do.
//
// Only a fully deterministic simulation can offer this. It is the game's
// answer to the question every long save quietly asks: did I matter?

import type { Career } from './types'
import {
  initWorld,
  playBackgroundWindow,
  playForeignContinentals,
  ghostWorldCup,
  seasonTick,
} from './world'
import { WINDOWS } from '@/data/windows'

export interface GhostSeason {
  season: number
  wcChampion?: string // year-4 seasons only
  continentalChampions?: { confederation: string; championId: string }[] // year-1 seasons
}

// Deterministic per (seed, throughSeason): recomputing is free and identical.
export function ghostTimeline(seed: number, throughSeason: number): GhostSeason[] {
  let w = initWorld()
  const out: GhostSeason[] = []
  const NOBODY = new Set<string>()

  for (let season = 1; season <= throughSeason; season++) {
    const year = ((season - 1) % 4) + 1
    const entry: GhostSeason = { season }

    for (const win of WINDOWS) {
      w = playBackgroundWindow(w, seed, season, win.matchWeek, NOBODY)
    }
    if (year === 1) {
      // No manager means no "home" confederation: every continent plays.
      const f = playForeignContinentals(w, seed, season, '__NOBODY__')
      w = f.world
      entry.continentalChampions = f.champions
    }
    if (year === 4) {
      const wc = ghostWorldCup(w, seed, season)
      w = wc.world
      entry.wcChampion = wc.championId
    }
    w = seasonTick(w, seed, season).world
    out.push(entry)
  }
  return out
}

// The divergence report: which World Cups have different names on them because
// you exist. (Continentals diverge too, but the World Cup is the heartbeat.)
export interface Divergence {
  season: number
  yours: string | null // champion in YOUR timeline (from the almanac)
  ghost: string | null // champion in the world without you
  isYou: boolean // you won it in your timeline
}

export function worldCupDivergence(career: Career): Divergence[] {
  const ghosts = ghostTimeline(career.seed, career.season)
  const out: Divergence[] = []
  for (const g of ghosts) {
    if (!g.wcChampion) continue
    const real = career.history.find((h) => h.type === 'WORLD_CUP' && h.season === g.season)
    out.push({
      season: g.season,
      yours: real?.nationId ?? null,
      ghost: g.wcChampion,
      isYou: !!real?.managerMoment,
    })
  }
  return out
}
