// Window fixtures + the 26-man squad helpers. For this milestone each window
// holds a single match against a deterministically-chosen opponent (a friendly).
// Real qualifying groups / tournament fixtures replace this opponent pick in the
// tournament milestone — the window/deadline machinery stays the same.

import type { Career, Player } from './types'
import {
  type CalendarWindow,
  upcomingWindow,
  windowAtWeek,
  isRegistrationClosed,
  fixtureKey,
  tournamentForYear,
  tournamentRoundAtWeek,
  inTournamentBlock,
} from '@/data/windows'
import { managerFixture } from './campaign'
import { managerTie, roundName, totalRounds } from './tournament'

export const SQUAD_SIZE = 26
export const MIN_GK = 3
export const MIN_DF = 7
export const MIN_MF = 7
export const MIN_FW = 3

export interface Fixture {
  opponentId: string
  competitive: boolean
  home: boolean
}

// The manager's next competitive fixture, sourced from the qualifying campaign's
// current matchday. Null only if the campaign somehow has no fixture (guarded
// by always-regenerating a campaign on completion).
export function currentFixture(career: Career): Fixture | null {
  const mf = managerFixture(career.campaign, career.managerNationId)
  if (!mf) return null
  return { opponentId: mf.opponentId, competitive: true, home: mf.home }
}

// The single match the manager must play THIS week (qualifier or a finals
// knockout tie), or null. A finals tie takes precedence during the summer block.
export type CurrentMatch =
  | { type: 'QUALIFIER'; opponentId: string; home: boolean; label: string }
  | { type: 'TOURNAMENT'; opponentId: string; home: boolean; label: string; round: string }

export function currentMatch(career: Career): CurrentMatch | null {
  const t = career.tournament
  if (t && !t.champion) {
    if (tournamentRoundAtWeek(career.week) === t.roundIndex) {
      const mt = managerTie(t)
      if (mt) {
        return {
          type: 'TOURNAMENT',
          opponentId: mt.opponentId,
          home: mt.home,
          label: t.name,
          round: roundName(t.kind, t.roundIndex, totalRounds(t.field.length)),
        }
      }
    }
    return null // finals running but no manager tie this week (eliminated/watching)
  }

  const window = windowAtWeek(career.week)
  if (window && !career.playedFixtures.includes(fixtureKey(career.season, window.id))) {
    const mf = managerFixture(career.campaign, career.managerNationId)
    if (mf) return { type: 'QUALIFIER', opponentId: mf.opponentId, home: mf.home, label: 'World Cup Qualifier' }
  }
  return null
}

// Whether the registered squad satisfies the minimum positional requirements.
export function squadValidity(players: Player[], squad: string[]): {
  valid: boolean
  counts: Record<Player['position'], number>
  reasons: string[]
} {
  const byId = new Map(players.map((p) => [p.id, p]))
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 } as Record<Player['position'], number>
  for (const id of squad) {
    const p = byId.get(id)
    if (p) counts[p.position]++
  }
  const reasons: string[] = []
  if (squad.length > SQUAD_SIZE) reasons.push(`Too many players (${squad.length}/${SQUAD_SIZE})`)
  if (counts.GK < MIN_GK) reasons.push(`Need ${MIN_GK} goalkeepers (have ${counts.GK})`)
  if (counts.DF < MIN_DF) reasons.push(`Need ${MIN_DF} defenders (have ${counts.DF})`)
  if (counts.MF < MIN_MF) reasons.push(`Need ${MIN_MF} midfielders (have ${counts.MF})`)
  if (counts.FW < MIN_FW) reasons.push(`Need ${MIN_FW} forwards (have ${counts.FW})`)
  return { valid: reasons.length === 0, counts, reasons }
}

// True once this week's window match (if any) has already been played — so the
// "upcoming window" and the registration lock both roll to the next window
// immediately rather than lingering on the just-finished one.
function playedThisWeek(career: Career): boolean {
  const w = windowAtWeek(career.week)
  return !!w && career.playedFixtures.includes(fixtureKey(career.season, w.id))
}

// Is the registered 26 locked right now? Locked from a window's deadline week
// through its match week — unless that match is already played, in which case
// the next window governs.
export function isSquadLocked(career: Career): boolean {
  // The 26 is locked through a summer finals block (deadline -> last round week).
  if (tournamentForYear(career.year) && inTournamentBlock(career.week)) return true
  return isRegistrationClosed(playedThisWeek(career) ? career.week + 1 : career.week)
}

// The window the manager is currently preparing for, with its (campaign) fixture
// and lock state.
export function effectiveUpcoming(career: Career): {
  window: CalendarWindow
  season: number
  weeksAway: number
  nextYear: boolean
  fixture: Fixture | null
  locked: boolean
} {
  const fromWeek = playedThisWeek(career) ? career.week + 1 : career.week
  const up = upcomingWindow(fromWeek)
  const season = up.nextYear ? career.season + 1 : career.season
  const fixture = currentFixture(career)
  const weeksAway = up.window.matchWeek - career.week + (up.nextYear ? 52 : 0)
  return { window: up.window, season, weeksAway: Math.max(0, weeksAway), nextYear: up.nextYear, fixture, locked: isSquadLocked(career) }
}
