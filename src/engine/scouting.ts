// Scouting confidence (NTM_Staff_and_Scouting_v1, reworked). Knowledge is a
// BAND, never a precise number — except for players you've seen in person.
//
//   confidence (stored in `freshness`, 0..100) sets how tight the displayed
//   range is:
//     - Uncovered: confidence decays, the band widens, eventually "??".
//     - Standing coverage: confidence climbs toward COVERAGE_CAP -> a tight
//       band (±2), but NEVER exact. Your estimate tracks his real ability.
//     - Targeted look: a focused one-off, tighter still (±1) but not exact.
//     - Seen in person (call-up): exact. The only way to truly know a player.
//
// The estimate (knownOverall/knownPotential) tracks the real, hidden values
// while you're watching; once you stop, it freezes and goes stale as the player
// develops out of view.

import type { Career, Coach, Player } from './types'

const DECAY_PER_WEEK = 4
const FLOOR_CONF = 22 // never below this: footage exists for everyone, so the
//                       worst case is a WIDE range, never "??"
const COVERAGE_CAP = 78 // standing coverage tops out here (~±2 band), never exact
const COVERAGE_GAIN = 12 // confidence gained per covered week, up to the cap
const TARGETED_CONF = 90 // a focused look: ~±1, still not exact
const EXACT_CONF = 100 // seeing him in person (call-up) — the only exact read

export function coveredLeagues(coaches: Coach[]): Set<string> {
  return new Set(coaches.map((c) => c.leagueAssignment).filter((l): l is string => !!l))
}

// One week of coverage resolution over the whole pool.
export function applyCoverageWeek(players: Player[], coaches: Career['coaches']): Player[] {
  const covered = coveredLeagues(coaches)
  return players.map((p) => {
    if (covered.has(p.clubLeague)) {
      // Climb toward the coverage cap; a previously-exact read (e.g. from a
      // call-up) settles gently back down toward the cap as time passes.
      const conf =
        p.freshness < COVERAGE_CAP
          ? Math.min(COVERAGE_CAP, p.freshness + COVERAGE_GAIN)
          : Math.max(COVERAGE_CAP, p.freshness - 1)
      return syncEstimate(p, conf)
    }
    if (p.freshness <= FLOOR_CONF) return p
    // Uncovered: estimate freezes, confidence (band) decays toward the floor.
    return { ...p, freshness: Math.max(FLOOR_CONF, p.freshness - DECAY_PER_WEEK) }
  })
}

// A targeted one-off look from a news lead — tight, but not exact.
export function targetedLook(p: Player): Player {
  return syncEstimate(p, TARGETED_CONF)
}

// Seeing a player in person (named in a squad / played for you) — exact read,
// and records it so the exact figure persists (then ages to ~exact, then a
// range) over the following year.
export function seeInPerson(p: Player): Player {
  return { ...syncEstimate(p, EXACT_CONF), inPersonOverall: p.overall, inPersonWeeks: 0 }
}

// Pull the visible estimate up to the real (hidden) values and set confidence.
function syncEstimate(p: Player, confidence: number): Player {
  return {
    ...p,
    knownOverall: p.overall,
    knownPotential: p.potential,
    freshness: confidence,
  }
}
