// Finals tournaments (NTM_Tournament_Structure_v1): the Continental Championship
// (straight knockout) and the World Cup — now the REAL shape: a seeded group
// draw (4 groups of 4, draws allowed, final-matchday mathematics) feeding a
// quarter-final knockout (A1vB2 etc.). The manager's matches are Tier 1
// (played); the rest are simmed (Tier 2 full engine for playable nations,
// Tier 3 Poisson for filler). Knockout draws are settled on penalties.

import type { GroupStanding, Nation, PlayedResult, Tie, Tournament, TournamentGroup, TournamentKind, WorldState } from './types'
import { ALL_NATIONS, ALL_NATIONS_BY_ID, CONFEDERATION_NAMES } from '@/data/nations'
import { displayYear } from '@/data/windows'
import { RNG, deriveSeed, hashStr } from './rng'
import { simulateMatch } from './match'
import { simulateLite } from './matchLite'
import { buildOpponentTeam } from './matchSetup'
import { ratingOf } from './world'

export const CONTINENTAL_SIZE = 8
export const WORLD_CUP_SIZE = 16

// Match weeks for each step of a tournament. The World Cup runs three group
// matchdays then QF/SF/Final across the summer; the Continental (and any
// legacy knockout-only World Cup from an old save) uses the classic ladder.
const WC_GROUP_STEP_WEEKS = [25, 26, 27, 29, 30, 32]
const KO_ONLY_STEP_WEEKS = [26, 28, 30, 32]

export function stepWeeks(t: Tournament): number[] {
  return t.groups ? WC_GROUP_STEP_WEEKS : KO_ONLY_STEP_WEEKS
}

// Round-robin of four in three matchdays (indices into group.teams).
const GROUP_MD_PAIRINGS: [number, number][][] = [
  [[0, 3], [1, 2]],
  [[0, 2], [3, 1]],
  [[0, 1], [2, 3]],
]

// How many steps are group matchdays for this tournament.
export function groupStepCount(t: Tournament): number {
  return t.groups ? GROUP_MD_PAIRINGS.length : 0
}

export function inGroupStage(t: Tournament): boolean {
  return !!t.groups && t.groupMatchday < GROUP_MD_PAIRINGS.length
}

export interface TieResult {
  aGoals: number
  bGoals: number
  winnerId: string
  pens: boolean
  pensA?: number
  pensB?: number
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
  season: number,
  includeManager: boolean,
  world?: WorldState,
  hostId?: string | null,
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
    name = `World Cup ${displayYear(season)}`
  }

  // Seed by live strength; force the manager in (continental always; WC if
  // qualified) and the World Cup host in (hosts never qualify).
  const strength = (n: Nation) => ratingOf(world, n.id)
  const ranked = [...pool].sort((a, b) => strength(b) - strength(a))
  let field = ranked.slice(0, size)
  const inField = kind === 'CONTINENTAL' || includeManager
  if (kind === 'WORLD_CUP' && hostId && !field.some((n) => n.id === hostId)) {
    const host = ALL_NATIONS_BY_ID[hostId]
    if (host) {
      // Bump the weakest non-manager seed for the host.
      for (let i = field.length - 1; i >= 0; i--) {
        if (field[i].id !== managerId) {
          field[i] = host
          break
        }
      }
    }
  }
  if (inField && !field.some((n) => n.id === managerId)) {
    // Bump the weakest non-host seed for the manager.
    for (let i = field.length - 1; i >= 0; i--) {
      if (field[i].id !== hostId) {
        field[i] = me
        break
      }
    }
  }
  if (!inField) {
    // Manager watches: ensure they're NOT in the field.
    field = field.filter((n) => n.id !== managerId).slice(0, size)
  }
  field.sort((a, b) => strength(b) - strength(a))

  const fieldIds = field.map((n) => n.id)

  if (kind === 'WORLD_CUP') {
    // Seeded group draw: pot 1 (seeds 1-4) tops groups A-D; later pots snake
    // so no group hoards strength. Groups play a full round-robin.
    const groups: TournamentGroup[] = [0, 1, 2, 3].map((g) => {
      const teams = [fieldIds[g], fieldIds[7 - g], fieldIds[8 + g], fieldIds[15 - g]]
      return { teams, standings: teams.map(emptyStanding) }
    })
    return {
      kind,
      name,
      managerId,
      hostId: hostId ?? null,
      inField: inField && fieldIds.includes(managerId),
      field: fieldIds,
      groups,
      groupMatchday: 0,
      rounds: [],
      roundIndex: 0,
      champion: null,
      eliminated: false,
    }
  }

  const round0 = seedBracket(fieldIds)
  return {
    kind,
    name,
    managerId,
    hostId: null,
    inField: inField && fieldIds.includes(managerId),
    field: fieldIds,
    groups: null,
    groupMatchday: 3,
    rounds: [round0],
    roundIndex: 0,
    champion: null,
    eliminated: false,
  }
}

function emptyStanding(nationId: string): GroupStanding {
  return { nationId, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
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

// The manager's tie in the current KNOCKOUT round (null in the group stage /
// eliminated / watching / done).
export function managerTie(t: Tournament): { tie: Tie; index: number; opponentId: string; home: boolean } | null {
  if (t.champion || t.eliminated || !t.inField || inGroupStage(t)) return null
  const round = t.rounds[t.roundIndex - groupStepCount(t)]
  if (!round) return null
  const index = round.findIndex((tie) => tie.aId === t.managerId || tie.bId === t.managerId)
  if (index < 0) return null
  const tie = round[index]
  const home = tie.aId === t.managerId // seeding gives the higher seed the "a" slot
  return { tie, index, opponentId: home ? tie.bId : tie.aId, home }
}

// The manager's fixture for the CURRENT step, group or knockout. Group games
// can end level; knockout ties cannot.
export function managerStep(
  t: Tournament,
): { opponentId: string; home: boolean; phase: 'GROUP' | 'KO'; label: string } | null {
  if (t.champion || t.eliminated || !t.inField) return null
  if (inGroupStage(t)) {
    const gi = t.groups!.findIndex((g) => g.teams.includes(t.managerId))
    if (gi < 0) return null
    const group = t.groups![gi]
    const md = GROUP_MD_PAIRINGS[t.groupMatchday]
    for (const [a, b] of md) {
      const aId = group.teams[a]
      const bId = group.teams[b]
      if (aId === t.managerId || bId === t.managerId) {
        const home = aId === t.managerId
        return {
          opponentId: home ? bId : aId,
          home,
          phase: 'GROUP',
          label: `Group ${'ABCD'[gi]} · Matchday ${t.groupMatchday + 1}`,
        }
      }
    }
    return null
  }
  const mt = managerTie(t)
  if (!mt) return null
  const kos = totalRounds(t.groups ? 8 : t.field.length)
  return {
    opponentId: mt.opponentId,
    home: mt.home,
    phase: 'KO',
    label: roundName(t.kind, t.roundIndex - groupStepCount(t), kos),
  }
}

// Resolve the current round: apply the manager's played result (if any), sim the
// rest, advance winners to the next round (or crown a champion).
export function resolveTournamentRound(
  t: Tournament,
  managerResult: TieResult | null,
  seed: number,
  season = 1,
  world?: WorldState,
): { t: Tournament; results: StepResult[] } {
  if (inGroupStage(t)) return resolveGroupMatchday(t, managerResult, seed, season, world)
  return resolveKnockoutRound(t, managerResult, seed, season, world)
}

// A resolved match of this step, for Elo and the news desk.
export interface StepResult extends PlayedResult {
  neutral: boolean
  shootout?: boolean
  shootoutWinnerId?: string
}

function resolveGroupMatchday(
  t: Tournament,
  managerResult: TieResult | null,
  seed: number,
  season: number,
  world?: WorldState,
): { t: Tournament; results: StepResult[] } {
  const md = GROUP_MD_PAIRINGS[t.groupMatchday]
  const results: StepResult[] = []
  const groups = t.groups!.map((group, gi) => {
    const standings = group.standings.map((st) => ({ ...st }))
    for (const [ai, bi] of md) {
      const aId = group.teams[ai]
      const bId = group.teams[bi]
      const isManager = t.inField && (aId === t.managerId || bId === t.managerId)
      let hg: number
      let ag: number
      if (isManager && managerResult) {
        hg = managerResult.aGoals
        ag = managerResult.bGoals
      } else {
        const r = simGroupMatch(t, aId, bId, seed, gi, season, world)
        hg = r.hg
        ag = r.ag
      }
      applyGroupResult(standings, { homeId: aId, awayId: bId, hg, ag })
      results.push({ homeId: aId, awayId: bId, hg, ag, neutral: t.hostId !== aId && t.hostId !== bId })
    }
    sortGroup(standings)
    return { ...group, standings }
  })

  const groupMatchday = t.groupMatchday + 1
  let rounds = t.rounds
  let eliminated = t.eliminated
  if (groupMatchday >= GROUP_MD_PAIRINGS.length) {
    // Groups done: A1vB2, B1vA2, C1vD2, D1vC2 into the quarter-finals.
    const first = groups.map((g) => g.standings[0].nationId)
    const second = groups.map((g) => g.standings[1].nationId)
    rounds = [[
      newTie(first[0], second[1]),
      newTie(first[1], second[0]),
      newTie(first[2], second[3]),
      newTie(first[3], second[2]),
    ]]
    if (t.inField) {
      const gi = groups.findIndex((g) => g.teams.includes(t.managerId))
      const pos = groups[gi].standings.findIndex((st) => st.nationId === t.managerId)
      if (pos > 1) eliminated = true
    }
  }

  return {
    t: { ...t, groups, groupMatchday, rounds, roundIndex: t.roundIndex + 1, eliminated },
    results,
  }
}

// Group matches may END LEVEL — that's the point of a group.
function simGroupMatch(
  t: Tournament,
  aId: string,
  bId: string,
  seed: number,
  gi: number,
  season: number,
  world?: WorldState,
): { hg: number; ag: number } {
  const a = ALL_NATIONS_BY_ID[aId]
  const b = ALL_NATIONS_BY_ID[bId]
  const s = deriveSeed(seed, t.groupMatchday, gi, hashStr(aId + bId))
  const aHosts = t.hostId === aId
  const bHosts = t.hostId === bId
  if (a.isPlayable && b.isPlayable) {
    const home = buildOpponentTeam(a, seed, aHosts, season, ratingOf(world, aId))
    const away = buildOpponentTeam(b, seed, bHosts, season, ratingOf(world, bId))
    const r = simulateMatch(home, away, s)
    return { hg: r.homeGoals, ag: r.awayGoals }
  }
  const lite = simulateLite(ratingOf(world, aId), ratingOf(world, bId), aHosts ? true : bHosts ? false : null, s)
  return { hg: lite.goalsA, ag: lite.goalsB }
}

function applyGroupResult(standings: GroupStanding[], r: PlayedResult): void {
  const home = standings.find((st) => st.nationId === r.homeId)!
  const away = standings.find((st) => st.nationId === r.awayId)!
  home.p++; away.p++
  home.gf += r.hg; home.ga += r.ag
  away.gf += r.ag; away.ga += r.hg
  if (r.hg > r.ag) { home.w++; home.pts += 3; away.l++ }
  else if (r.hg < r.ag) { away.w++; away.pts += 3; home.l++ }
  else { home.d++; away.d++; home.pts++; away.pts++ }
}

function sortGroup(standings: GroupStanding[]): void {
  standings.sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.nationId.localeCompare(b.nationId),
  )
}

function resolveKnockoutRound(
  t: Tournament,
  managerResult: TieResult | null,
  seed: number,
  season: number,
  world?: WorldState,
): { t: Tournament; results: StepResult[] } {
  const ko = t.roundIndex - groupStepCount(t)
  const round = t.rounds[ko].map((tie) => ({ ...tie }))
  const mt = managerTie(t)
  const results: StepResult[] = []

  round.forEach((tie, i) => {
    let res: TieResult
    if (mt && i === mt.index && managerResult) {
      res = managerResult
    } else {
      res = simTie(tie, t, seed, ko, i, season, world)
    }
    tie.aGoals = res.aGoals
    tie.bGoals = res.bGoals
    tie.winnerId = res.winnerId
    tie.pens = res.pens
    tie.pensA = res.pensA
    tie.pensB = res.pensB
    results.push({
      homeId: tie.aId,
      awayId: tie.bId,
      hg: res.aGoals,
      ag: res.bGoals,
      neutral: t.hostId !== tie.aId && t.hostId !== tie.bId,
      shootout: res.pens,
      shootoutWinnerId: res.pens ? res.winnerId : undefined,
    })
  })

  const winners = round.map((tie) => tie.winnerId!).filter(Boolean)
  const rounds = [...t.rounds]
  rounds[ko] = round

  let champion: string | null = null
  let eliminated = t.eliminated
  if (mt) {
    const myTie = round[mt.index]
    if (myTie.winnerId !== t.managerId) eliminated = true
  }

  if (winners.length === 1) {
    champion = winners[0]
  } else {
    const next: Tie[] = []
    for (let i = 0; i < winners.length; i += 2) next.push(newTie(winners[i], winners[i + 1]))
    rounds.push(next)
  }

  return { t: { ...t, rounds, roundIndex: t.roundIndex + 1, champion, eliminated }, results }
}

// Simulate a non-manager tie to a decisive result. Finals ties are on neutral
// ground — unless one side is the World Cup HOST, who plays at home with the
// crowd behind them.
function simTie(tie: Tie, t: Tournament, seed: number, roundIndex: number, i: number, season: number, world?: WorldState): TieResult {
  const a = ALL_NATIONS_BY_ID[tie.aId]
  const b = ALL_NATIONS_BY_ID[tie.bId]
  const ra = ratingOf(world, tie.aId)
  const rb = ratingOf(world, tie.bId)
  const s = deriveSeed(seed, roundIndex, hashStr(tie.aId + tie.bId), i)
  const aHosts = t.hostId === tie.aId
  const bHosts = t.hostId === tie.bId
  let ag: number
  let bg: number
  if (a.isPlayable && b.isPlayable) {
    const home = buildOpponentTeam(a, seed, aHosts, season, ra)
    const away = buildOpponentTeam(b, seed, bHosts, season, rb)
    const r = simulateMatch(home, away, s)
    ag = r.homeGoals
    bg = r.awayGoals
  } else {
    const lite = simulateLite(ra, rb, aHosts ? true : bHosts ? false : null, s)
    ag = lite.goalsA
    bg = lite.goalsB
  }
  return decide(tie.aId, tie.bId, ag, bg, ra, rb, deriveSeed(s, 99))
}

// Ensure a winner: a draw goes to penalties, weighted slightly by strength,
// with a believable shootout score for the record books.
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
  // Score: winner converts 3-5 (sudden death runs long occasionally).
  const winPens = rng.bool(0.12) ? rng.int(5, 7) : rng.int(3, 5)
  const losePens = Math.max(0, winPens - rng.int(1, 2))
  const pensA = winnerId === aId ? winPens : losePens
  const pensB = winnerId === bId ? winPens : losePens
  return { aGoals: ag, bGoals: bg, winnerId, pens: true, pensA, pensB }
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

// Award this cycle's World Cup to a host. Any credible playable footballing
// nation can win the bid (mid-rank hosts are half the fun), never back-to-back.
// Deterministic per (seed, cycle) so the almanac is reproducible. Sometimes
// it's YOUR country — and then the whole cycle is about not blowing it at home.
export function pickWorldCupHost(
  _managerId: string,
  seed: number,
  cycle: number,
  prevHostId?: string | null,
): string {
  const rng = new RNG(deriveSeed(seed, cycle, 0x405e))
  const candidates = ALL_NATIONS.filter((n) => n.isPlayable && n.id !== prevHostId)
  // Weight by football culture: strong bids more likely, minnows possible-ish.
  const weights = candidates.map((n) => Math.max(4, n.footballCulture - 55))
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng.next() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i].id
  }
  return candidates[candidates.length - 1].id
}
