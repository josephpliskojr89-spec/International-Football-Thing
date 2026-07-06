// Glue between a Career and the pure match engine: builds MatchTeam views,
// picks an AI opponent's side, and maps design data (tactical identity, manager
// approach) onto the engine's tactical styles and formations.

import type { Career, Nation, PlayStyle, Player } from './types'
import { NATIONS_BY_ID } from '@/data/nations'
import { FORMATIONS_BY_ID } from '@/data/formations'
import { generateSquadForNation } from './playerGen'
import { autoFillLineup } from './career'
import type { MatchTeam } from './match'

// A nation's default tactical identity maps to a sensible formation for the AI.
const IDENTITY_FORMATION: Record<PlayStyle, string> = {
  Possession: '4-3-3',
  Counter: '5-3-2',
  Direct: '4-4-2',
  HighPress: '4-2-3-1',
  Balanced: '4-3-3',
}

// Uses the career's persistent tactics (style + focal point) to build the team.
// Injured starters are swapped for the best fit bench player in their position
// at kickoff — a mid-tournament injury really costs you your man.
export function buildManagerTeam(career: Career, isHome: boolean): MatchTeam {
  const nation = NATIONS_BY_ID[career.managerNationId]
  const playersById = Object.fromEntries(career.players.map((p) => [p.id, p]))
  const playerBySlot: Record<string, Player | null> = {}
  const usedIds = new Set<string>()
  for (const slot of FORMATIONS_BY_ID[career.formation].slots) {
    playerBySlot[slot.id] = playersById[career.lineup[slot.id] ?? ''] ?? null
    if (playerBySlot[slot.id]) usedIds.add(playerBySlot[slot.id]!.id)
  }
  const benchFit = career.bench
    .map((id) => playersById[id])
    .filter((p): p is Player => !!p && p.injuredWeeks === 0)
  for (const slot of FORMATIONS_BY_ID[career.formation].slots) {
    const starter = playerBySlot[slot.id]
    if (starter && starter.injuredWeeks > 0) {
      const sub = benchFit
        .filter((p) => !usedIds.has(p.id))
        .sort((a, b) => (b.position === slot.position ? b.overall + 12 : b.overall) - (a.position === slot.position ? a.overall + 12 : a.overall))[0]
      if (sub) {
        playerBySlot[slot.id] = sub
        usedIds.add(sub.id)
      }
    }
  }
  return {
    nationId: nation.id,
    name: nation.name,
    formationId: career.formation,
    playerBySlot,
    style: career.tactics.style,
    isHome,
    focalPointId: career.tactics.focalPointId,
  }
}

// Opponent squad is regenerated deterministically from (seed, season, dynamic
// rating), so we never persist every nation's squad — but the squad still ages,
// turns over and tracks the nation's current strength (see generational squads
// in playerGen). Pass `season` and the world's current `rating` wherever a
// Career is in scope; the defaults only exist for isolated engine tests.
export function buildOpponentTeam(
  opponent: Nation,
  careerSeed: number,
  isHome: boolean,
  season = 1,
  rating = opponent.nationRating,
): MatchTeam {
  const squad = generateSquadForNation(opponent, careerSeed, season, rating)
  const formationId = IDENTITY_FORMATION[opponent.tacticalIdentity]
  const lineup = autoFillLineup(squad, formationId, {
    formation: formationId,
    approach: 'Balanced',
    preference: 'Balanced',
  })
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]))
  const playerBySlot: Record<string, Player | null> = {}
  for (const slot of FORMATIONS_BY_ID[formationId].slots) {
    playerBySlot[slot.id] = byId[lineup[slot.id] ?? ''] ?? null
  }
  return {
    nationId: opponent.id,
    name: opponent.name,
    formationId,
    playerBySlot,
    style: opponent.tacticalIdentity,
    isHome,
  }
}
