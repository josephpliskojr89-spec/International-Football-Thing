// Glue between a Career and the pure match engine: builds MatchTeam views,
// picks an AI opponent's side, and maps design data (tactical identity, manager
// approach) onto the engine's tactical styles and formations.

import type { Career, Nation, PlayStyle, Player } from './types'
import { NATIONS_BY_ID } from '@/data/nations'
import { FORMATIONS_BY_ID } from '@/data/formations'
import { generateSquadForNation } from './playerGen'
import { autoFillLineup } from './career'
import { deriveSeed } from './rng'
import type { MatchTeam } from './match'

// A nation's default tactical identity maps to a sensible formation for the AI.
const IDENTITY_FORMATION: Record<PlayStyle, string> = {
  Possession: '4-3-3',
  Counter: '5-3-2',
  Direct: '4-4-2',
  HighPress: '4-2-3-1',
  Balanced: '4-3-3',
}

// Manager approach -> a default match style (the player can override pre-match).
export function defaultStyleForApproach(approach: Career['style']['approach']): PlayStyle {
  switch (approach) {
    case 'Attacking':
      return 'HighPress'
    case 'Defensive':
      return 'Counter'
    case 'Balanced':
    default:
      return 'Balanced'
  }
}

export function buildManagerTeam(career: Career, style: PlayStyle, isHome: boolean): MatchTeam {
  const nation = NATIONS_BY_ID[career.managerNationId]
  const playersById = Object.fromEntries(career.players.map((p) => [p.id, p]))
  const playerBySlot: Record<string, Player | null> = {}
  for (const slot of FORMATIONS_BY_ID[career.formation].slots) {
    playerBySlot[slot.id] = playersById[career.lineup[slot.id] ?? ''] ?? null
  }
  return {
    nationId: nation.id,
    name: nation.name,
    formationId: career.formation,
    playerBySlot,
    style,
    isHome,
  }
}

// Opponent squad is regenerated deterministically (same seed scheme as the
// manager's), so we never need to persist every nation's squad.
export function buildOpponentTeam(opponent: Nation, careerSeed: number, isHome: boolean): MatchTeam {
  const squad = generateSquadForNation(opponent, careerSeed)
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

// Derive a stable, unique seed for one match so replays during a session are
// reproducible but each fixture differs.
export function matchSeed(careerSeed: number, year: number, week: number, opponentId: string): number {
  let h = 0
  for (let i = 0; i < opponentId.length; i++) h = (h * 31 + opponentId.charCodeAt(i)) | 0
  return deriveSeed(careerSeed, year, week, h)
}
