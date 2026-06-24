// Scouting coverage (NTM_Staff_and_Scouting_v1). A player's read is only as
// current as your coverage of him. Players in a league a coach is assigned to
// stay sharp — their knownOverall/knownPotential sync to the (hidden) real
// values and freshness resets. Everyone else drifts fuzzy over time. This is the
// bridge that turns invisible development into knowledge.

import type { Career, Coach, Player } from './types'

const DECAY_PER_WEEK = 3
const REFRESH_GAIN = 40 // sharpen quickly while covered

export function coveredLeagues(coaches: Coach[]): Set<string> {
  return new Set(coaches.map((c) => c.leagueAssignment).filter((l): l is string => !!l))
}

// One week of coverage resolution over the whole pool.
export function applyCoverageWeek(players: Player[], coaches: Career['coaches']): Player[] {
  const covered = coveredLeagues(coaches)
  return players.map((p) => {
    if (covered.has(p.clubLeague)) return refreshRead(p, Math.min(100, p.freshness + REFRESH_GAIN))
    if (p.freshness <= 0) return p
    return { ...p, freshness: Math.max(0, p.freshness - DECAY_PER_WEEK) }
  })
}

// A targeted one-off look (from a news lead) — syncs the read regardless of
// league assignment.
export function targetedLook(p: Player): Player {
  return refreshRead(p, 100)
}

// Sync the visible read to the real, hidden values and set freshness.
function refreshRead(p: Player, freshness: number): Player {
  return {
    ...p,
    knownOverall: p.overall,
    knownPotential: p.potential,
    freshness,
  }
}
