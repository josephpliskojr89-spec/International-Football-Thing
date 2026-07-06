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
  qualifiersActiveInYear,
} from '@/data/windows'
import { ALL_NATIONS } from '@/data/nations'
import { managerFixture } from './campaign'
import { managerTie, roundName, totalRounds } from './tournament'
import { ratingOf } from './world'
import { RNG, deriveSeed, hashStr } from './rng'

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

// The manager's next window fixture: a qualifier in campaign years (2-3), a
// friendly otherwise. Friendlies are where you blood youngsters, earn in-person
// reads without stakes, and give an uncommitted dual national a taste.
export function currentFixture(career: Career): Fixture | null {
  if (qualifiersActiveInYear(career.year)) {
    const mf = managerFixture(career.campaign, career.managerNationId)
    if (mf) return { opponentId: mf.opponentId, competitive: true, home: mf.home }
    return null
  }
  const window = upcomingWindow(playedThisWeek(career) ? career.week + 1 : career.week)
  return friendlyFixture(career, window.window.id, window.nextYear ? career.season + 1 : career.season)
}

// Deterministic friendly opponent: usually a similarly-ranked side (a proper
// test), occasionally a glamour tie against a giant. Never a group-mate.
export function friendlyFixture(career: Career, windowId: string, season: number): Fixture {
  const rng = new RNG(deriveSeed(career.seed, season, hashStr(windowId), 0xf17e))
  const myRating = ratingOf(career.world, career.managerNationId)
  const candidates = ALL_NATIONS.filter((n) => n.isPlayable && n.id !== career.managerNationId)
  const near = [...candidates]
    .sort(
      (a, b) =>
        Math.abs(ratingOf(career.world, a.id) - myRating) -
        Math.abs(ratingOf(career.world, b.id) - myRating),
    )
    .slice(0, 10)
  const glamour = [...candidates].sort((a, b) => ratingOf(career.world, b.id) - ratingOf(career.world, a.id)).slice(0, 5)
  const pick = rng.bool(0.2) ? rng.pick(glamour) : rng.pick(near)
  return { opponentId: pick.id, competitive: false, home: rng.bool(0.5) }
}

// The single match the manager must play THIS week (qualifier, friendly, or a
// finals knockout tie), or null. A finals tie takes precedence in the summer.
export type CurrentMatch =
  | { type: 'QUALIFIER'; opponentId: string; home: boolean; label: string }
  | { type: 'FRIENDLY'; opponentId: string; home: boolean; label: string }
  | { type: 'TOURNAMENT'; opponentId: string; home: boolean; label: string; round: string; neutral: boolean }

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
          // World Cup ties are neutral unless the manager hosts.
          neutral: !(t.kind === 'WORLD_CUP' && career.wcHostId === career.managerNationId),
        }
      }
    }
    return null // finals running but no manager tie this week (eliminated/watching)
  }

  const window = windowAtWeek(career.week)
  if (window && !career.playedFixtures.includes(fixtureKey(career.season, window.id))) {
    if (qualifiersActiveInYear(career.year)) {
      const mf = managerFixture(career.campaign, career.managerNationId)
      if (mf) return { type: 'QUALIFIER', opponentId: mf.opponentId, home: mf.home, label: 'World Cup Qualifier' }
      return null
    }
    const f = friendlyFixture(career, window.id, career.season)
    return { type: 'FRIENDLY', opponentId: f.opponentId, home: f.home, label: 'International Friendly' }
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
  // The 26 is locked through a summer finals block (deadline -> last round week)
  // — but only while you're actually IN the tournament. Watching from home or
  // already eliminated? Your squad is your own business.
  if (tournamentForYear(career.year) && inTournamentBlock(career.week)) {
    const t = career.tournament
    if (!t) return true // deadline week, draw imminent — locked
    if (t.inField && !t.eliminated && !t.champion) return true
  }
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
