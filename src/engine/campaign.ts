// World Cup qualifying campaign: a group of nations playing a double round-robin
// (home & away), with a live table. The manager plays their fixture each
// matchday (Tier 1, elsewhere); the OTHER fixtures of that matchday are simmed
// here — Tier 2 (full engine) for playable nations, Tier 3 (lightweight Poisson)
// for filler — so the table stays alive. Top N qualify.

import type { Campaign, GroupFixture, GroupStanding, Nation, PlayedResult } from './types'
import { ALL_NATIONS_BY_ID, nationsInConfederation } from '@/data/nations'
import { RNG, deriveSeed, hashStr } from './rng'
import { simulateMatch } from './match'
import { simulateLite } from './matchLite'
import { buildOpponentTeam } from './matchSetup'

export const GROUP_SIZE = 6
export const QUALIFY_COUNT = 2

// Build a qualifying group around the manager's nation: the manager plus the
// strongest others from their confederation, then schedule a double round-robin.
export function createCampaign(managerNationId: string, seed: number, cycle: number): Campaign {
  const rng = new RNG(deriveSeed(seed, cycle, 0xca))
  const me = ALL_NATIONS_BY_ID[managerNationId]
  const pool = nationsInConfederation(me.confederation).filter((n) => n.id !== me.id)

  // Pick a believable mix: bias toward stronger sides but keep some variety.
  const ranked = [...pool].sort((a, b) => b.nationRating - a.nationRating)
  const strong = ranked.slice(0, Math.min(ranked.length, GROUP_SIZE * 2))
  const chosen: Nation[] = []
  const shuffled = shuffle(strong, rng)
  for (const n of shuffled) {
    if (chosen.length >= GROUP_SIZE - 1) break
    chosen.push(n)
  }
  // If the confederation is tiny, pad from anywhere (keeps groups full).
  if (chosen.length < GROUP_SIZE - 1) {
    for (const n of shuffle(pool, rng)) {
      if (chosen.length >= GROUP_SIZE - 1) break
      if (!chosen.includes(n)) chosen.push(n)
    }
  }

  const groupNationIds = shuffle([me, ...chosen], rng).map((n) => n.id)
  const matchdays = doubleRoundRobin(groupNationIds, rng)

  return {
    cycle,
    groupNationIds,
    matchdays,
    matchdayIndex: 0,
    standings: groupNationIds.map(emptyStanding),
    recentResults: [],
    qualifyCount: QUALIFY_COUNT,
    complete: false,
    qualifiedIds: [],
  }
}

// The manager's fixture for the current matchday (or null if the campaign is done).
export function managerFixture(
  campaign: Campaign,
  managerNationId: string,
): { opponentId: string; home: boolean } | null {
  if (campaign.complete || campaign.matchdayIndex >= campaign.matchdays.length) return null
  const md = campaign.matchdays[campaign.matchdayIndex]
  const fx = md.find((f) => f.homeId === managerNationId || f.awayId === managerNationId)
  if (!fx) return null
  const home = fx.homeId === managerNationId
  return { opponentId: home ? fx.awayId : fx.homeId, home }
}

// Resolve the current matchday: apply the manager's already-played result, sim
// the other fixtures, update the table, advance. Sets complete + qualifiers when
// the schedule is exhausted.
export function resolveMatchday(
  campaign: Campaign,
  managerResult: PlayedResult,
  managerNationId: string,
  seed: number,
): Campaign {
  const md = campaign.matchdays[campaign.matchdayIndex]
  const standings = campaign.standings.map((s) => ({ ...s }))
  const results: PlayedResult[] = []

  for (const fx of md) {
    const isManager = fx.homeId === managerNationId || fx.awayId === managerNationId
    let res: PlayedResult
    if (isManager) {
      res = managerResult
    } else {
      res = simFixture(fx, seed, campaign.cycle, campaign.matchdayIndex)
    }
    applyResult(standings, res)
    results.push(res)
  }

  sortStandings(standings)
  const nextIndex = campaign.matchdayIndex + 1
  const complete = nextIndex >= campaign.matchdays.length
  const qualifiedIds = complete ? standings.slice(0, campaign.qualifyCount).map((s) => s.nationId) : []

  return {
    ...campaign,
    standings,
    recentResults: results,
    matchdayIndex: nextIndex,
    complete,
    qualifiedIds,
  }
}

// ---- simulation of a non-manager fixture (Tier 2 / Tier 3) ----
function simFixture(fx: GroupFixture, seed: number, cycle: number, mdIndex: number): PlayedResult {
  const home = ALL_NATIONS_BY_ID[fx.homeId]
  const away = ALL_NATIONS_BY_ID[fx.awayId]
  const s = deriveSeed(seed, cycle, mdIndex, hashStr(fx.homeId + fx.awayId))

  if (home.isPlayable && away.isPlayable) {
    // Tier 2: full engine with AI-picked sides.
    const homeTeam = buildOpponentTeam(home, seed, true)
    const awayTeam = buildOpponentTeam(away, seed, false)
    const r = simulateMatch(homeTeam, awayTeam, s)
    return { homeId: fx.homeId, awayId: fx.awayId, hg: r.homeGoals, ag: r.awayGoals }
  }
  // Tier 3: lightweight Poisson from nation ratings.
  const lite = simulateLite(home.nationRating, away.nationRating, true, s)
  return { homeId: fx.homeId, awayId: fx.awayId, hg: lite.goalsA, ag: lite.goalsB }
}

// ---- standings ----
function emptyStanding(nationId: string): GroupStanding {
  return { nationId, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
}

function applyResult(standings: GroupStanding[], r: PlayedResult): void {
  const home = standings.find((s) => s.nationId === r.homeId)!
  const away = standings.find((s) => s.nationId === r.awayId)!
  home.p++
  away.p++
  home.gf += r.hg
  home.ga += r.ag
  away.gf += r.ag
  away.ga += r.hg
  if (r.hg > r.ag) {
    home.w++
    home.pts += 3
    away.l++
  } else if (r.hg < r.ag) {
    away.w++
    away.pts += 3
    home.l++
  } else {
    home.d++
    away.d++
    home.pts++
    away.pts++
  }
}

function sortStandings(standings: GroupStanding[]): void {
  standings.sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.nationId.localeCompare(b.nationId), // deterministic final tiebreaker
  )
}

// ---- round-robin scheduling (circle method, doubled for home & away) ----
function doubleRoundRobin(ids: string[], rng: RNG): GroupFixture[][] {
  const teams = [...ids]
  if (teams.length % 2 !== 0) teams.push('__BYE__')
  const n = teams.length
  const rounds: GroupFixture[][] = []

  let arr = [...teams]
  for (let r = 0; r < n - 1; r++) {
    const fixtures: GroupFixture[] = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== '__BYE__' && b !== '__BYE__') {
        // alternate home/away by round for fairness
        fixtures.push(r % 2 === 0 ? { homeId: a, awayId: b } : { homeId: b, awayId: a })
      }
    }
    rounds.push(fixtures)
    // rotate (keep first fixed)
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }

  // Second half: reverse venues.
  const second = rounds.map((rd) => rd.map((f) => ({ homeId: f.awayId, awayId: f.homeId })))
  return shuffleRounds([...rounds, ...second], rng)
}

// Lightly shuffle matchday ORDER (not fixtures) so campaigns don't feel canned.
function shuffleRounds(rounds: GroupFixture[][], rng: RNG): GroupFixture[][] {
  const first = rounds.slice(0, rounds.length / 2)
  const second = rounds.slice(rounds.length / 2)
  return [...shuffle(first, rng), ...shuffle(second, rng)]
}

function shuffle<T>(arr: T[], rng: RNG): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

