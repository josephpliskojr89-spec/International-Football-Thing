// Save migration. Careers persisted by older versions may lack fields added
// later (bench, season, the scouting/known-read fields, etc.). Loading such a
// save unmigrated crashes screens that assume those fields exist. This fills in
// safe defaults so Continue never breaks across versions.

import type { Career, Player } from './types'
import { SAVE_VERSION } from '@/data/constants'
import { overallFor } from './playerGen'
import { autoFillBench } from './career'

export function migrateCareer(raw: unknown): Career {
  const c = raw as Record<string, any>
  const players: Player[] = Array.isArray(c.players) ? c.players.map(migratePlayer) : []

  const formation: string = c.formation ?? '4-3-3'
  const lineup: Record<string, string | null> = c.lineup ?? {}
  let bench: string[] = Array.isArray(c.bench) ? c.bench : []
  const style = c.style ?? { formation, approach: 'Balanced', preference: 'Balanced' }

  // Rebuild a missing/empty bench from the pool so the Squad screen is populated.
  if (bench.length === 0 && players.length > 0) {
    bench = autoFillBench(players, lineup, style)
  }

  return {
    seed: c.seed ?? 1,
    createdAt: c.createdAt ?? 0,
    saveVersion: SAVE_VERSION,
    managerName: c.managerName ?? 'The Manager',
    managerNationId: c.managerNationId ?? 'ENG',
    style,
    year: c.year ?? 1,
    season: c.season ?? 1,
    week: c.week ?? 1,
    exhibitionCount: c.exhibitionCount ?? 0,
    players,
    coaches: Array.isArray(c.coaches) ? c.coaches : [],
    lineup,
    bench,
    formation,
    news: Array.isArray(c.news) ? c.news : [],
  }
}

function migratePlayer(raw: unknown): Player {
  const p = raw as Record<string, any>
  const ratings = p.ratings ?? {
    finishing: 50, pace: 50, technique: 50, passing: 50,
    physical: 50, mental: 50, defending: 50, goalkeeping: 20,
  }
  const overall = p.overall ?? overallFor(p.position ?? 'MF', ratings)
  return {
    id: p.id ?? `mig-${Math.round((p.overall ?? 0) * 1000)}-${p.name ?? '?'}`,
    name: p.name ?? 'Unknown',
    nationality: p.nationality ?? 'ENG',
    position: p.position ?? 'MF',
    age: p.age ?? 24,
    club: p.club ?? 'Club',
    clubLeague: p.clubLeague ?? 'Domestic League',
    ratings,
    overall,
    potential: p.potential ?? Math.max(overall, 60),
    form: p.form ?? 60,
    injuryRisk: p.injuryRisk ?? 15,
    professionalism: p.professionalism ?? 70,
    consistency: p.consistency ?? 70,
    playingTime: p.playingTime ?? 0.5,
    knownOverall: p.knownOverall ?? overall,
    knownPotential: p.knownPotential ?? 0,
    freshness: p.freshness ?? 50,
    inPersonOverall: p.inPersonOverall ?? null,
    inPersonWeeks: p.inPersonWeeks ?? 0,
    eligibleNations: Array.isArray(p.eligibleNations) ? p.eligibleNations : [p.nationality ?? 'ENG'],
    leans: p.leans ?? {},
    eligibilityState: p.eligibilityState ?? 'ELIGIBLE',
    tiedNation: p.tiedNation ?? null,
  }
}
