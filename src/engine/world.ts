// The living world: dynamic nation ratings moved by results (Elo-style), the
// world ranking derived from them, and the background football the rest of the
// planet plays while the manager's story unfolds. This is the game's memory —
// win a World Cup and your nation RISES; a giant that keeps flopping slides
// down the seedings until the world stops fearing it.
//
// Ratings live on the 1..100 scale of the static data ratings and start there;
// from then on every competitive result everywhere nudges them. A soft seasonal
// pull toward each nation's footballing base (its culture/infrastructure) keeps
// identities recognizable across decades while still letting eras happen.

import type { Nation, PlayedResult, WorldState } from './types'
import { ALL_NATIONS, ALL_NATIONS_BY_ID } from '@/data/nations'
import { RNG, deriveSeed } from './rng'
import { simulateLite } from './matchLite'

// ---- tuning ----
const ELO_DIVISOR = 24 // rating diff for ~3:1 win expectation is ~12 points
const HOME_EDGE = 2 // home side's effective rating bonus in expectation
const K_QUALIFIER = 0.9
const K_FINALS = 1.5 // knockout finals move ratings hardest
const K_BACKGROUND = 0.7 // the world's own (unseen) qualifiers
const MARGIN_STEP = 0.25 // each goal of margin beyond 1 adds 25%, capped
const MARGIN_CAP = 1.75
const SHOOTOUT_SCORE = 0.6 // a shootout win counts as a 60:40 result, not a full win
const RATING_FLOOR = 30
const RATING_CEIL = 99
const SEASON_REVERSION = 0.06 // 6% pull toward the static base each season

export type ResultImportance = 'qualifier' | 'finals' | 'background'

const K_BY_IMPORTANCE: Record<ResultImportance, number> = {
  qualifier: K_QUALIFIER,
  finals: K_FINALS,
  background: K_BACKGROUND,
}

export function initWorld(): WorldState {
  const ratings: Record<string, number> = {}
  for (const n of ALL_NATIONS) ratings[n.id] = n.nationRating
  return { ratings, seasonStartRanks: rankMap(ratings) }
}

// Current dynamic rating, falling back to the static base for anything unknown
// (safe across save migrations and future nation additions).
export function ratingOf(world: WorldState | undefined, nationId: string): number {
  const dynamic = world?.ratings[nationId]
  if (dynamic !== undefined) return dynamic
  return ALL_NATIONS_BY_ID[nationId]?.nationRating ?? 60
}

interface EloResult extends PlayedResult {
  neutral?: boolean // finals ties are on neutral ground — no home edge
  shootout?: boolean // decided on penalties — scored as a narrow result
  shootoutWinnerId?: string
}

// Apply one result. Zero-sum: what the winner gains the loser loses, so the
// world's total quality is conserved — nations rise by taking scalps.
export function applyResult(world: WorldState, r: EloResult, importance: ResultImportance): WorldState {
  const ra = ratingOf(world, r.homeId)
  const rb = ratingOf(world, r.awayId)
  const edge = r.neutral ? 0 : HOME_EDGE
  const expected = 1 / (1 + Math.pow(10, (rb - (ra + edge)) / ELO_DIVISOR))

  let score: number
  let margin = 1
  if (r.shootout && r.shootoutWinnerId) {
    score = r.shootoutWinnerId === r.homeId ? SHOOTOUT_SCORE : 1 - SHOOTOUT_SCORE
  } else if (r.hg > r.ag) {
    score = 1
    margin = marginMult(r.hg - r.ag)
  } else if (r.hg < r.ag) {
    score = 0
    margin = marginMult(r.ag - r.hg)
  } else {
    score = 0.5
  }

  const delta = K_BY_IMPORTANCE[importance] * margin * (score - expected)
  return {
    ...world,
    ratings: {
      ...world.ratings,
      [r.homeId]: clampRating(ra + delta),
      [r.awayId]: clampRating(rb - delta),
    },
  }
}

export function applyResults(world: WorldState, results: EloResult[], importance: ResultImportance): WorldState {
  let w = world
  for (const r of results) w = applyResult(w, r, importance)
  return w
}

function marginMult(gd: number): number {
  return Math.min(MARGIN_CAP, 1 + MARGIN_STEP * (Math.min(gd, 4) - 1))
}

function clampRating(v: number): number {
  return Math.max(RATING_FLOOR, Math.min(RATING_CEIL, v))
}

// ---- the world ranking ----

export interface RankedNation {
  rank: number
  nation: Nation
  rating: number
  movement: number // + climbed, - fell since season start (0 = flat/new)
}

export function worldRanking(world: WorldState): RankedNation[] {
  const sorted = sortedIds(world.ratings)
  return sorted.map((id, i) => ({
    rank: i + 1,
    nation: ALL_NATIONS_BY_ID[id],
    rating: world.ratings[id],
    movement: world.seasonStartRanks[id] ? world.seasonStartRanks[id] - (i + 1) : 0,
  }))
}

// A nation's current world rank (1-based), or 0 if unknown.
export function worldRankOf(world: WorldState, nationId: string): number {
  const idx = sortedIds(world.ratings).indexOf(nationId)
  return idx < 0 ? 0 : idx + 1
}

function sortedIds(ratings: Record<string, number>): string[] {
  return Object.keys(ratings)
    .filter((id) => ALL_NATIONS_BY_ID[id])
    .sort((a, b) => ratings[b] - ratings[a] || a.localeCompare(b))
}

function rankMap(ratings: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  sortedIds(ratings).forEach((id, i) => {
    out[id] = i + 1
  })
  return out
}

// Season rollover: soft reversion toward the static base (a nation's footballing
// culture reasserts itself over time), then snapshot ranks for movement arrows.
export function seasonTick(world: WorldState): WorldState {
  const ratings: Record<string, number> = {}
  for (const [id, r] of Object.entries(world.ratings)) {
    const base = ALL_NATIONS_BY_ID[id]?.nationRating ?? r
    ratings[id] = clampRating(r + (base - r) * SEASON_REVERSION)
  }
  return { ratings, seasonStartRanks: rankMap(ratings) }
}

// ---- background football ----
// On every window match week the REST of the world plays too: nations outside
// the manager's group are paired within their confederation and resolved with
// the lite engine. No one sees these matches directly — they surface as ranking
// movement, which is exactly how following international football feels.
export function playBackgroundWindow(
  world: WorldState,
  seed: number,
  season: number,
  week: number,
  busyIds: ReadonlySet<string>,
): WorldState {
  const rng = new RNG(deriveSeed(seed, season, week, 0xb9))
  let w = world

  const byConf = new Map<string, string[]>()
  for (const n of ALL_NATIONS) {
    if (busyIds.has(n.id)) continue
    const arr = byConf.get(n.confederation) ?? []
    arr.push(n.id)
    byConf.set(n.confederation, arr)
  }

  for (const ids of byConf.values()) {
    const pool = shuffle(ids, rng)
    for (let i = 0; i + 1 < pool.length; i += 2) {
      const homeId = pool[i]
      const awayId = pool[i + 1]
      const s = deriveSeed(seed, season, week, i, 0xbb)
      const lite = simulateLite(ratingOf(w, homeId), ratingOf(w, awayId), true, s)
      w = applyResult(w, { homeId, awayId, hg: lite.goalsA, ag: lite.goalsB }, 'background')
    }
  }
  return w
}

// In a Continental Championship year, every OTHER confederation holds its own
// finals too — simmed as a lite knockout among its top four. Their champions
// make news and their ratings feel it, so continents rise and fall together.
export function playForeignContinentals(
  world: WorldState,
  seed: number,
  season: number,
  managerConfederation: string,
): { world: WorldState; champions: { confederation: string; championId: string }[] } {
  let w = world
  const champions: { confederation: string; championId: string }[] = []

  const confs = [...new Set(ALL_NATIONS.map((n) => n.confederation))].filter(
    (c) => c !== managerConfederation,
  )
  for (const conf of confs) {
    const field = ALL_NATIONS.filter((n) => n.confederation === conf)
      .sort((a, b) => ratingOf(w, b.id) - ratingOf(w, a.id))
      .slice(0, 4)
      .map((n) => n.id)
    if (field.length < 4) continue

    // Semis (1v4, 2v3) then the final; draws settled by a strength-tilted flip.
    const s1 = liteTie(w, field[0], field[3], deriveSeed(seed, season, 1, 0xcc))
    const s2 = liteTie(w, field[1], field[2], deriveSeed(seed, season, 2, 0xcc))
    w = applyResult(w, s1.result, 'finals')
    w = applyResult(w, s2.result, 'finals')
    const fin = liteTie(w, s1.winnerId, s2.winnerId, deriveSeed(seed, season, 3, 0xcc))
    w = applyResult(w, fin.result, 'finals')
    champions.push({ confederation: conf, championId: fin.winnerId })
  }
  return { world: w, champions }
}

function liteTie(
  world: WorldState,
  aId: string,
  bId: string,
  seed: number,
): { winnerId: string; result: EloResult } {
  const ra = ratingOf(world, aId)
  const rb = ratingOf(world, bId)
  const lite = simulateLite(ra, rb, null, seed)
  let winnerId: string
  let shootout = false
  if (lite.goalsA > lite.goalsB) winnerId = aId
  else if (lite.goalsB > lite.goalsA) winnerId = bId
  else {
    shootout = true
    const rng = new RNG(deriveSeed(seed, 5))
    winnerId = rng.next() < 0.5 + (ra - rb) * 0.004 ? aId : bId
  }
  return {
    winnerId,
    result: {
      homeId: aId,
      awayId: bId,
      hg: lite.goalsA,
      ag: lite.goalsB,
      neutral: true,
      shootout,
      shootoutWinnerId: shootout ? winnerId : undefined,
    },
  }
}

function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
