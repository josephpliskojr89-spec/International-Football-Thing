// Save migration. Careers persisted by older versions may lack fields added
// later (bench, season, the scouting/known-read fields, etc.). Loading such a
// save unmigrated crashes screens that assume those fields exist. This fills in
// safe defaults so Continue never breaks across versions.

import type { Career, Player } from './types'
import { SAVE_VERSION } from '@/data/constants'
import { overallFor } from './playerGen'
import { autoFillLineup, autoFillBench, styleForApproach } from './career'
import { createCampaign } from './campaign'
import { FORMATIONS_BY_ID, DEFAULT_FORMATION } from '@/data/formations'

export function migrateCareer(raw: unknown): Career {
  const c = raw as Record<string, any>
  const players: Player[] = Array.isArray(c.players) ? c.players.map(migratePlayer) : []

  const formation: string = FORMATIONS_BY_ID[c.formation] ? c.formation : DEFAULT_FORMATION
  const style = c.style ?? { formation, approach: 'Balanced', preference: 'Balanced' }

  // Repair a missing/empty/incomplete lineup so the match engine always has an
  // XI to field (an empty lineup would otherwise produce no on-field players).
  const slots = FORMATIONS_BY_ID[formation].slots
  const rawLineup: Record<string, string | null> = c.lineup ?? {}
  const validIds = new Set(players.map((p) => p.id))
  const filledSlots = slots.filter((s) => rawLineup[s.id] && validIds.has(rawLineup[s.id] as string))
  const lineup =
    players.length > 0 && filledSlots.length < slots.length
      ? autoFillLineup(players, formation, style)
      : rawLineup

  // Rebuild a missing/empty bench from the pool so the Squad screen is populated.
  let bench: string[] = Array.isArray(c.bench) ? c.bench.filter((id: string) => validIds.has(id)) : []
  if (bench.length === 0 && players.length > 0) {
    bench = autoFillBench(players, lineup, style)
  }

  // The registered 26 = XI + bench (deduped, valid ids only).
  const xiIds = Object.values(lineup).filter(Boolean) as string[]
  let registeredSquad: string[] = Array.isArray(c.registeredSquad)
    ? c.registeredSquad.filter((id: string) => validIds.has(id))
    : []
  if (registeredSquad.length === 0) {
    registeredSquad = [...new Set([...xiIds, ...bench])]
  }

  return {
    seed: c.seed ?? 1,
    createdAt: c.createdAt ?? 0,
    saveVersion: SAVE_VERSION,
    managerName: c.managerName ?? 'The Manager',
    managerNationId: c.managerNationId ?? 'ENG',
    style,
    tactics: {
      style: c.tactics?.style ?? styleForApproach(style.approach),
      focalPointId:
        c.tactics?.focalPointId && validIds.has(c.tactics.focalPointId) ? c.tactics.focalPointId : null,
    },
    year: c.year ?? 1,
    season: c.season ?? 1,
    week: c.week ?? 1,
    exhibitionCount: c.exhibitionCount ?? 0,
    players,
    coaches: Array.isArray(c.coaches) ? c.coaches : [],
    registeredSquad,
    lineup,
    bench,
    formation,
    playedFixtures: Array.isArray(c.playedFixtures) ? c.playedFixtures : [],
    campaign:
      c.campaign && Array.isArray(c.campaign.matchdays)
        ? c.campaign
        : createCampaign(c.managerNationId ?? 'ENG', c.seed ?? 1, 1),
    qualifiedForWorldCup: !!c.qualifiedForWorldCup,
    tournament: c.tournament ?? null,
    trophies: Array.isArray(c.trophies) ? c.trophies : [],
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
