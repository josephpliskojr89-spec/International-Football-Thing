// Finals tournaments (NTM_Tournament_Structure_v1): the Continental Championship
// and the World Cup — seeded single-elimination knockouts. The manager's ties
// are Tier 1 (played); the rest are simmed (Tier 2 full engine for playable
// nations, Tier 3 Poisson for filler). A draw is settled on penalties so every
// round produces a winner.

import type { Nation, Tie, Tournament, TournamentKind, WorldState } from './types'
import { ALL_NATIONS, ALL_NATIONS_BY_ID, CONFEDERATION_NAMES } from '@/data/nations'
import { RNG, deriveSeed, hashStr } from './rng'
import { simulateMatch } from './match'
import { simulateLite } from './matchLite'
import { buildOpponentTeam } from './matchSetup'
import { ratingOf } from './world'

export const CONTINENTAL_SIZE = 8
export const WORLD_CUP_SIZE = 16

export interface TieResult {
  aGoals: number
  bGoals: number
  winnerId: string
  pens: boolean
}

// Build a tournament around the manager. Continental = top of the manager's
// confederation; World Cup = the strongest sides worldwide. The manager is
// force-included when `includeManager` (e.g. they qualified). Fields and
// seedings read the LIVE world ratings — a nation that's risen this cycle
// earns its seat at the table, and no two World Cups need look alike.
export function createTournament(
  kind: TournamentKind,
  managerId: string,
  _seed: number,
  _season: number,
  includeManager: boolean,
  world?: WorldState,
): Tournament {
  const me = ALL_NATIONS_BY_ID[managerId]
  let pool: Nation[]
  let size: number
  let name: string

  if (kind === 'CONTINENTAL') {
    pool = ALL_NATIONS.filter((n) => n.confederation === me.confederation)
    size = pool.length >= CONTINENTAL_SIZE ? CONTINENTAL_SIZE : 4
    name = `${CONFEDERATION_NAMES[me.confederation]} Championship`
  } else {
    pool = [...ALL_NATIONS]
    size = WORLD_CUP_SIZE
    name = 'World Cup'
  }

  // Seed by live strength; force the manager in (continental always; WC if qualified).
  const strength = (n: Nation) => ratingOf(world, n.id)
  const ranked = [...pool].sort((a, b) => strength(b) - strength(a))
  let field = ranked.slice(0, size)
  const inField = kind === 'CONTINENTAL' || includeManager
  if (inField && !field.some((n) => n.id === managerId)) {
    field[field.length - 1] = me // bump the weakest seed for the manager
  }
  if (!inField) {
    // Manager watches: ensure they're NOT in the field.
    field = field.filter((n) => n.id !== managerId).slice(0, size)
  }
  field.sort((a, b) => strength(b) - strength(a))

  const fieldIds = field.map((n) => n.id)
  const round0 = seedBracket(fieldIds)

  return {
    kind,
    name,
    managerId,
    inField: inField && fieldIds.includes(managerId),
    field: fieldIds,
    rounds: [round0],
    roundIndex: 0,
    champion: null,
    eliminated: false,
  }
}

// Standard seeding: 1 v N, 2 v N-1, ... so the top seeds meet weakest first.
function seedBracket(seeds: string[]): Tie[] {
  const ties: Tie[] = []
  for (let i = 0; i < seeds.length / 2; i++) {
    ties.push(newTie(seeds[i], seeds[seeds.length - 1 - i]))
  }
  return ties
}

function newTie(aId: string, bId: string): Tie {
  return { aId, bId, aGoals: null, bGoals: null, winnerId: null, pens: false }
}

// The manager's tie in the current round (null if eliminated / watching / done).
export function managerTie(t: Tournament): { tie: Tie; index: number; opponentId: string; home: boolean } | null {
  if (t.champion || t.eliminated || !t.inField) return null
  const round = t.rounds[t.roundIndex]
  if (!round) return null
  const index = round.findIndex((tie) => tie.aId === t.managerId || tie.bId === t.managerId)
  if (index < 0) return null
  const tie = round[index]
  const home = tie.aId === t.managerId // seeding gives the higher seed the "a" slot
  return { tie, index, opponentId: home ? tie.bId : tie.aId, home }
}

// Resolve the current round: apply the manager's played result (if any), sim the
// rest, advance winners to the next round (or crown a champion).
export function resolveTournamentRound(
  t: Tournament,
  managerResult: TieResult | null,
  seed: number,
  season = 1,
  world?: WorldState,
): Tournament {
  const round = t.rounds[t.roundIndex].map((tie) => ({ ...tie }))
  const mt = managerTie(t)

  round.forEach((tie, i) => {
    let res: TieResult
    if (mt && i === mt.index && managerResult) {
      res = managerResult
    } else {
      res = simTie(tie, seed, t.roundIndex, i, season, world)
    }
    tie.aGoals = res.aGoals
    tie.bGoals = res.bGoals
    tie.winnerId = res.winnerId
    tie.pens = res.pens
  })

  const winners = round.map((tie) => tie.winnerId!).filter(Boolean)
  const rounds = [...t.rounds]
  rounds[t.roundIndex] = round

  let champion: string | null = null
  let eliminated = t.eliminated
  if (mt) {
    const myTie = round[mt.index]
    if (myTie.winnerId !== t.managerId) eliminated = true
  }

  if (winners.length === 1) {
    champion = winners[0]
  } else {
    // pair winners in order for the next round
    const next: Tie[] = []
    for (let i = 0; i < winners.length; i += 2) next.push(newTie(winners[i], winners[i + 1]))
    rounds.push(next)
  }

  return { ...t, rounds, roundIndex: t.roundIndex + 1, champion, eliminated }
}

// Simulate a non-manager tie to a decisive result.
function simTie(tie: Tie, seed: number, roundIndex: number, i: number, season: number, world?: WorldState): TieResult {
  const a = ALL_NATIONS_BY_ID[tie.aId]
  const b = ALL_NATIONS_BY_ID[tie.bId]
  const ra = ratingOf(world, tie.aId)
  const rb = ratingOf(world, tie.bId)
  const s = deriveSeed(seed, roundIndex, hashStr(tie.aId + tie.bId), i)
  let ag: number
  let bg: number
  if (a.isPlayable && b.isPlayable) {
    const home = buildOpponentTeam(a, seed, true, season, ra)
    const away = buildOpponentTeam(b, seed, false, season, rb)
    const r = simulateMatch(home, away, s)
    ag = r.homeGoals
    bg = r.awayGoals
  } else {
    const lite = simulateLite(ra, rb, true, s)
    ag = lite.goalsA
    bg = lite.goalsB
  }
  return decide(tie.aId, tie.bId, ag, bg, ra, rb, deriveSeed(s, 99))
}

// Ensure a winner: a draw goes to penalties, weighted slightly by strength.
export function decide(
  aId: string,
  bId: string,
  ag: number,
  bg: number,
  aRating: number,
  bRating: number,
  seed: number,
): TieResult {
  if (ag > bg) return { aGoals: ag, bGoals: bg, winnerId: aId, pens: false }
  if (bg > ag) return { aGoals: ag, bGoals: bg, winnerId: bId, pens: false }
  // shootout — near coin flip, faint edge to the stronger side
  const rng = new RNG(seed >>> 0)
  const pA = 0.5 + (aRating - bRating) * 0.004
  const winnerId = rng.next() < pA ? aId : bId
  return { aGoals: ag, bGoals: bg, winnerId, pens: true }
}

export function roundName(_kind: TournamentKind, roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-final'
  if (fromEnd === 2) return 'Quarter-final'
  if (fromEnd === 3) return 'Round of 16'
  return `Round ${roundIndex + 1}`
}

// How many rounds the bracket will have given the field size.
export function totalRounds(fieldSize: number): number {
  return Math.max(1, Math.round(Math.log2(fieldSize)))
}
