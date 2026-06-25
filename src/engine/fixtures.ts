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
} from '@/data/windows'
import { NATIONS, NATIONS_BY_ID } from '@/data/nations'
import { RNG, deriveSeed } from './rng'

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

// Deterministic opponent + venue for a given season + window. Prefers a same- or
// similar-strength side so friendlies feel sensible.
export function fixtureFor(career: Career, window: CalendarWindow, season: number): Fixture {
  const rng = new RNG(deriveSeed(career.seed, season, hashStr(window.id)))
  const me = NATIONS_BY_ID[career.managerNationId]
  const candidates = NATIONS.filter((n) => n.id !== me.id)
  // Weight toward opponents within ~12 rating points for a competitive-ish game.
  const close = candidates.filter((n) => Math.abs(n.nationRating - me.nationRating) <= 12)
  const pool = close.length >= 4 ? close : candidates
  return { opponentId: rng.pick(pool).id, competitive: false, home: rng.bool(0.5) }
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
  return isRegistrationClosed(playedThisWeek(career) ? career.week + 1 : career.week)
}

// The window the manager is currently preparing for, with its fixture and lock.
export function effectiveUpcoming(career: Career): {
  window: CalendarWindow
  season: number
  weeksAway: number
  nextYear: boolean
  fixture: Fixture
  locked: boolean
} {
  const fromWeek = playedThisWeek(career) ? career.week + 1 : career.week
  const up = upcomingWindow(fromWeek)
  const season = up.nextYear ? career.season + 1 : career.season
  const fixture = fixtureFor(career, up.window, season)
  const weeksAway = up.window.matchWeek - career.week + (up.nextYear ? 52 : 0)
  return { window: up.window, season, weeksAway: Math.max(0, weeksAway), nextYear: up.nextYear, fixture, locked: isSquadLocked(career) }
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
