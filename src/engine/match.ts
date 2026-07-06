// The six-step match engine (NTM_Match_Engine_v1). Pure arithmetic, one pass,
// no minute-by-minute sim. Inputs are two team views (XI placed by formation) +
// style + home/away + a seed; output is a score plus a back-filled events list.
// No side effects — the caller applies morale/development/ranking changes.

import type { Player, PlayStyle, Position } from './types'
import { MATCH, FOCAL } from '@/data/constants'
import { FORMATIONS_BY_ID } from '@/data/formations'
import { RNG, poisson } from './rng'
import { overallFor, overallForRaw } from './playerGen'

export interface MatchTeam {
  nationId: string
  name: string
  formationId: string
  // playerBySlot: slotId -> Player (or null if a slot is somehow empty)
  playerBySlot: Record<string, Player | null>
  style: PlayStyle
  isHome: boolean
  focalPointId?: string | null // a player to "play through"
}

export interface MatchEventLog {
  minute: number
  type: 'GOAL' | 'INJURY' | 'YELLOW' | 'RED'
  side: 'home' | 'away'
  playerId: string
  playerName: string
}

export interface PlayerMatchRating {
  playerId: string
  name: string
  position: Position
  rating: number // 4.0 .. 10.0
  goals: number
}

export interface ShootoutKick {
  side: 'home' | 'away'
  taker: string
  scored: boolean
}

export interface MatchResult {
  homeName: string
  awayName: string
  homeGoals: number
  awayGoals: number
  homeGoalsHT: number // the half-time score — comebacks are simulated, not narrated
  awayGoalsHT: number
  extraTime?: boolean // knockout only: 30 more minutes were needed
  shootout?: { kicks: ShootoutKick[]; homePens: number; awayPens: number; winner: 'home' | 'away' }
  xgHome: number
  xgAway: number
  possessionHome: number // 0..100
  events: MatchEventLog[]
  scorersHome: { name: string; minute: number }[]
  scorersAway: { name: string; minute: number }[]
  motm: { name: string; side: 'home' | 'away'; rating: number } | null
  ratingsHome: PlayerMatchRating[]
  ratingsAway: PlayerMatchRating[]
  zones: {
    home: ZoneStrengths
    away: ZoneStrengths
    midfieldEdgeHome: number
  }
}

interface ZoneStrengths {
  attack: number
  midfield: number
  defense: number
}

// The style wheel (Step 2b): football's rock-paper-scissors, small but real.
// HighPress smothers Possession's build-up; Possession starves Direct sides of
// the ball; Direct's long game bypasses nobody better than a Counter block that
// needs YOU to overcommit; Counter feasts on the space behind a HighPress.
// Balanced sits outside the wheel. Winner ~+5% attack/+3% midfield, loser -4%/-3%.
const STYLE_WHEEL: Partial<Record<PlayStyle, PlayStyle>> = {
  HighPress: 'Possession',
  Possession: 'Direct',
  Direct: 'Counter',
  Counter: 'HighPress',
}

export function styleMatchup(mine: PlayStyle, theirs: PlayStyle): { edge: 1 | 0 | -1; note: string } {
  if (STYLE_WHEEL[mine] === theirs) {
    return { edge: 1, note: `${mine} historically gets the better of ${theirs}` }
  }
  if (STYLE_WHEEL[theirs] === mine) {
    return { edge: -1, note: `${theirs} is the classic answer to ${mine} — be ready to adapt` }
  }
  return { edge: 0, note: 'No stylistic edge either way — this one is about the players' }
}

// Per-style, per-zone nudges (Step 2 StyleModifier). Deliberately small.
const STYLE_MODS: Record<PlayStyle, ZoneStrengths> = {
  Balanced: { attack: 1.0, midfield: 1.0, defense: 1.0 },
  Possession: { attack: 1.0, midfield: 1.05, defense: 1.0 },
  Counter: { attack: 1.03, midfield: 0.97, defense: 1.03 },
  Direct: { attack: 1.05, midfield: 0.97, defense: 1.0 },
  HighPress: { attack: 1.02, midfield: 1.04, defense: 0.97 },
}

export function simulateMatch(home: MatchTeam, away: MatchTeam, seed: number): MatchResult {
  const rng = new RNG(seed >>> 0)

  // Step 2b — the style wheel tilts both sides before anything else.
  const wheel = styleMatchup(home.style, away.style)
  const zHome = applyWheel(finalZones(home), wheel.edge)
  const zAway = applyWheel(finalZones(away), -wheel.edge as 1 | 0 | -1)

  // Step 2c — discipline & injuries are rolled FIRST, with minutes, and they
  // hurt TODAY: a red card weakens the ten men for every remaining minute; a
  // player limping off costs his side a little for the rest of the match.
  const injuries = rollInjuries(home, away, rng)
  const cards = rollCards(home, away, rng)
  impair(zHome, injuries, cards, 'home')
  impair(zAway, injuries, cards, 'away')

  // Step 3 — midfield matchup -> edge for each side (fulcrum).
  const edgeHome = midfieldEdge(zHome.midfield / zAway.midfield)
  const edgeAway = midfieldEdge(zAway.midfield / zHome.midfield)

  // Steps 4+5, TWICE — the match is two halves, and the scoreboard at the
  // break changes the second: trailing sides chase, leading sides protect.
  const xgH1home = clampFloor(0.5 * MATCH.baseChances * (zHome.attack / zAway.defense) * edgeHome)
  const xgH1away = clampFloor(0.5 * MATCH.baseChances * (zAway.attack / zHome.defense) * edgeAway)
  const homeGoalsHT = poisson(rng, xgH1home)
  const awayGoalsHT = poisson(rng, xgH1away)

  const state = scoreState(homeGoalsHT, awayGoalsHT)
  const xgH2home = clampFloor(0.5 * MATCH.baseChances * ((zHome.attack * state.homeAtt) / (zAway.defense * state.awayDef)) * edgeHome)
  const xgH2away = clampFloor(0.5 * MATCH.baseChances * ((zAway.attack * state.awayAtt) / (zHome.defense * state.homeDef)) * edgeAway)
  const homeGoalsH2 = poisson(rng, xgH2home)
  const awayGoalsH2 = poisson(rng, xgH2away)

  const homeGoals = homeGoalsHT + homeGoalsH2
  const awayGoals = awayGoalsHT + awayGoalsH2
  const xgHome = xgH1home + xgH2home
  const xgAway = xgH1away + xgH2away

  // Step 6 — back-fill the goals onto real feet, half by half.
  const scorersHome = [
    ...assignScorers(home, homeGoalsHT, rng, 1, 45),
    ...assignScorers(home, homeGoalsH2, rng, 46, 90),
  ].sort((a, b) => a.minute - b.minute)
  const scorersAway = [
    ...assignScorers(away, awayGoalsHT, rng, 1, 45),
    ...assignScorers(away, awayGoalsH2, rng, 46, 90),
  ].sort((a, b) => a.minute - b.minute)

  const events: MatchEventLog[] = [
    ...scorersHome.map((s) => ({
      minute: s.minute,
      type: 'GOAL' as const,
      side: 'home' as const,
      playerId: s.playerId,
      playerName: s.name,
    })),
    ...scorersAway.map((s) => ({
      minute: s.minute,
      type: 'GOAL' as const,
      side: 'away' as const,
      playerId: s.playerId,
      playerName: s.name,
    })),
    ...injuries,
    ...cards,
  ].sort((a, b) => a.minute - b.minute)

  const ratingsHome = playerRatings(home, homeGoals, awayGoals, scorersHome, edgeHome >= 1, rng)
  const ratingsAway = playerRatings(away, awayGoals, homeGoals, scorersAway, edgeAway >= 1, rng)
  const motm = pickMotm(ratingsHome, ratingsAway)

  const possessionHome = Math.round((zHome.midfield / (zHome.midfield + zAway.midfield)) * 100)

  return {
    homeName: home.name,
    awayName: away.name,
    homeGoals,
    awayGoals,
    homeGoalsHT,
    awayGoalsHT,
    xgHome: round1(xgHome),
    xgAway: round1(xgAway),
    possessionHome,
    events,
    scorersHome: scorersHome.map((s) => ({ name: s.name, minute: s.minute })),
    scorersAway: scorersAway.map((s) => ({ name: s.name, minute: s.minute })),
    motm,
    ratingsHome,
    ratingsAway,
    zones: { home: zHome, away: zAway, midfieldEdgeHome: round2(edgeHome) },
  }
}

// The style-wheel tilt, applied to a whole side's zones.
function applyWheel(z: ZoneStrengths, edge: 1 | 0 | -1): ZoneStrengths {
  if (edge === 0) return z
  const att = edge === 1 ? 1.05 : 0.96
  const mid = edge === 1 ? 1.03 : 0.97
  return { attack: z.attack * att, midfield: z.midfield * mid, defense: z.defense }
}

// In-match harm, weighted by how much of the match was left when it happened.
// A red card leaves ten men: the attack suffers most, the shape holds better.
function impair(z: ZoneStrengths, injuries: MatchEventLog[], cards: MatchEventLog[], side: 'home' | 'away'): void {
  for (const e of [...injuries, ...cards]) {
    if (e.side !== side) continue
    const remaining = Math.max(0, (90 - e.minute) / 90)
    if (e.type === 'RED') {
      z.attack *= 1 - 0.3 * remaining
      z.midfield *= 1 - 0.2 * remaining
      z.defense *= 1 - 0.12 * remaining
    } else if (e.type === 'INJURY') {
      z.attack *= 1 - 0.06 * remaining
      z.midfield *= 1 - 0.06 * remaining
      z.defense *= 1 - 0.06 * remaining
    }
  }
}

// The second half belongs to the scoreboard: trailing sides throw men forward
// (and leave gaps), leading sides drop off and protect what they have.
function scoreState(hGoals: number, aGoals: number): { homeAtt: number; homeDef: number; awayAtt: number; awayDef: number } {
  if (hGoals === aGoals) return { homeAtt: 1.02, homeDef: 1, awayAtt: 1.02, awayDef: 1 }
  const deficit = Math.min(2, Math.abs(hGoals - aGoals))
  const chaseAtt = 1 + 0.1 * deficit
  if (hGoals < aGoals) return { homeAtt: chaseAtt, homeDef: 0.95, awayAtt: 0.93, awayDef: 1.06 }
  return { homeAtt: 0.93, homeDef: 1.06, awayAtt: chaseAtt, awayDef: 0.95 }
}

// ---- Step 1 + 2: zone strengths with modifiers ----
function finalZones(team: MatchTeam): ZoneStrengths {
  const { attack, midfield, defense } = bucket(team)
  const styleMod = STYLE_MODS[team.style]
  const homeMul = team.isHome ? MATCH.homeBonus : 1

  const att =
    zoneBase('attack', attack) * formMul(attack) * styleMod.attack * homeMul * focalAttackMultiplier(team)
  const mid = zoneBase('midfield', midfield) * formMul(midfield) * styleMod.midfield * homeMul
  const def = zoneBase('defense', defense) * formMul(defense) * styleMod.defense * homeMul

  return { attack: att, midfield: mid, defense: def }
}

// "Play through" a focal point: a quality outlet lifts the attack, but his form
// swings it (over-investing in a misfiring star can backfire).
function focalAttackMultiplier(team: MatchTeam): number {
  if (!team.focalPointId) return 1
  const fp = Object.values(team.playerBySlot).find((p) => p?.id === team.focalPointId)
  if (!fp) return 1
  const quality = Math.max(0, overallForRaw(fp.position, fp.ratings) - FOCAL.attackBoostBaseline)
  const formFactor = 1 + FOCAL.formSwing * ((fp.form - 65) / 65) // ~0.5..1.5
  const boost = Math.min(FOCAL.attackBoostMax, FOCAL.attackBoostPer * quality * Math.max(0.3, formFactor))
  return 1 + boost
}

interface Buckets {
  attack: Player[]
  midfield: Player[]
  defense: Player[]
}

// The formation decides who lands in which zone — the tactical effect is
// emergent, not a bonus table. GK + defenders -> Defense, mids -> Midfield,
// forwards -> Attack.
function bucket(team: MatchTeam): Buckets {
  const slots = FORMATIONS_BY_ID[team.formationId].slots
  const b: Buckets = { attack: [], midfield: [], defense: [] }
  for (const slot of slots) {
    const p = team.playerBySlot[slot.id]
    if (!p) continue
    if (slot.position === 'FW') b.attack.push(p)
    else if (slot.position === 'MF') b.midfield.push(p)
    else b.defense.push(p) // GK + DF
  }
  return b
}

function zoneBase(zone: keyof Buckets, players: Player[]): number {
  if (players.length === 0) return 45 // weak placeholder if a zone is empty
  if (zone === 'attack') {
    return mean(players.map((p) => 0.45 * p.ratings.finishing + 0.3 * p.ratings.pace + 0.25 * p.ratings.technique))
  }
  if (zone === 'midfield') {
    return mean(
      players.map(
        (p) => 0.35 * p.ratings.passing + 0.25 * p.ratings.technique + 0.2 * p.ratings.physical + 0.2 * p.ratings.mental,
      ),
    )
  }
  // defense: outfield defenders carry defending+physical; GK carries goalkeeping.
  const gk = players.find((p) => p.position === 'GK')
  const outfield = players.filter((p) => p.position !== 'GK')
  const line = outfield.length
    ? mean(outfield.map((p) => 0.6 * p.ratings.defending + 0.4 * p.ratings.physical))
    : 45
  const keeper = gk ? gk.ratings.goalkeeping : 50
  return 0.7 * line + 0.3 * keeper
}

// Average form of the zone -> multiplier in [0.92, 1.10] (top-weighted range).
function formMul(players: Player[]): number {
  if (players.length === 0) return 1
  const avg = mean(players.map((p) => p.form)) / 100
  return MATCH.formRange.min + avg * (MATCH.formRange.max - MATCH.formRange.min)
}

// ---- Step 3: midfield edge ----
function midfieldEdge(ratio: number): number {
  const raw = 1 + (ratio - 1) * 0.5
  return Math.max(MATCH.midfieldEdge.min, Math.min(MATCH.midfieldEdge.max, raw))
}

function clampFloor(xg: number): number {
  return Math.max(MATCH.xgFloor, xg)
}


// ---- Step 6: narrative back-fill ----
interface Scorer {
  playerId: string
  name: string
  minute: number
}

function assignScorers(team: MatchTeam, goals: number, rng: RNG, minMinute = 1, maxMinute = 90): Scorer[] {
  if (goals === 0) return []
  const onField = Object.values(team.playerBySlot).filter((p): p is Player => !!p)
  if (onField.length === 0) return [] // no XI selected — no named scorers
  // Weight by finishing + form; forwards dominate, but anyone can score. The
  // focal point is a much likelier outlet (you're playing through him).
  const weighted = onField.map((p) => ({
    p,
    w:
      Math.pow(p.ratings.finishing, 1.8) *
      (0.5 + p.form / 100) *
      positionScoringBias(p.position) *
      (p.id === team.focalPointId ? FOCAL.scorerWeight : 1),
  }))
  const total = weighted.reduce((s, x) => s + x.w, 0)

  const scorers: Scorer[] = []
  for (let i = 0; i < goals; i++) {
    let r = rng.next() * total
    let chosen = weighted[0].p
    for (const x of weighted) {
      r -= x.w
      if (r <= 0) {
        chosen = x.p
        break
      }
    }
    scorers.push({ playerId: chosen.id, name: chosen.name, minute: rng.int(minMinute, maxMinute) })
  }
  return scorers.sort((a, b) => a.minute - b.minute)
}

function positionScoringBias(pos: Position): number {
  switch (pos) {
    case 'FW':
      return 1
    case 'MF':
      return 0.5
    case 'DF':
      return 0.12
    case 'GK':
      return 0.01
  }
}

// Discipline: bookings fall mostly on defenders and midfielders (the tackling
// trades); the rare red card changes a tournament. Rolled as narrative — the
// scoreline stands — but suspensions carry REAL consequences downstream.
function rollCards(home: MatchTeam, away: MatchTeam, rng: RNG): MatchEventLog[] {
  const out: MatchEventLog[] = []
  for (const [team, side] of [
    [home, 'home'],
    [away, 'away'],
  ] as const) {
    let reds = 0
    for (const p of Object.values(team.playerBySlot)) {
      if (!p) continue
      const yellowP = p.position === 'DF' ? 0.13 : p.position === 'MF' ? 0.11 : p.position === 'FW' ? 0.07 : 0.03
      if (rng.next() < yellowP) {
        out.push({ minute: rng.int(15, 90), type: 'YELLOW', side, playerId: p.id, playerName: p.name })
        // A booked defender walking the line: small chance it becomes two.
        if (reds === 0 && rng.next() < 0.05) {
          reds++
          out.push({ minute: rng.int(55, 92), type: 'RED', side, playerId: p.id, playerName: p.name })
        }
      }
    }
  }
  return out
}

function rollInjuries(home: MatchTeam, away: MatchTeam, rng: RNG): MatchEventLog[] {
  const out: MatchEventLog[] = []
  for (const [team, side] of [
    [home, 'home'],
    [away, 'away'],
  ] as const) {
    for (const p of Object.values(team.playerBySlot)) {
      if (!p) continue
      // injuryRisk is 5..40; scale to a small per-match chance.
      if (rng.next() < (p.injuryRisk / 100) * 0.04) {
        out.push({ minute: rng.int(10, 88), type: 'INJURY', side, playerId: p.id, playerName: p.name })
      }
    }
  }
  return out
}

function playerRatings(
  team: MatchTeam,
  goalsFor: number,
  goalsAgainst: number,
  scorers: Scorer[],
  wonMidfield: boolean,
  rng: RNG,
): PlayerMatchRating[] {
  const goalCount = new Map<string, number>()
  for (const s of scorers) goalCount.set(s.playerId, (goalCount.get(s.playerId) ?? 0) + 1)
  const cleanSheet = goalsAgainst === 0
  const won = goalsFor > goalsAgainst

  const out: PlayerMatchRating[] = []
  for (const p of Object.values(team.playerBySlot)) {
    if (!p) continue
    let r = 6.3 + (overallFor(p.position, p.ratings) - 60) / 40 // ability nudge
    const g = goalCount.get(p.id) ?? 0
    r += g * 1.1
    if (cleanSheet && (p.position === 'DF' || p.position === 'GK')) r += 0.8
    if (wonMidfield && p.position === 'MF') r += 0.3
    if (won) r += 0.2
    r += rng.range(-0.4, 0.4)
    out.push({
      playerId: p.id,
      name: p.name,
      position: p.position,
      rating: Math.max(4, Math.min(10, round1(r))),
      goals: g,
    })
  }
  return out.sort((a, b) => b.rating - a.rating)
}

function pickMotm(home: PlayerMatchRating[], away: PlayerMatchRating[]): MatchResult['motm'] {
  const best = [...home.map((r) => ({ r, side: 'home' as const })), ...away.map((r) => ({ r, side: 'away' as const }))].sort(
    (a, b) => b.r.rating - a.r.rating,
  )[0]
  if (!best) return null
  return { name: best.r.name, side: best.side, rating: best.r.rating }
}

// ---- small math helpers ----
function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
function round1(x: number): number {
  return Math.round(x * 10) / 10
}
function round2(x: number): number {
  return Math.round(x * 100) / 100
}


// ---- Knockout settlement: extra time, then the shootout ----
// Thirty more minutes at ~2/3 intensity on tired legs, score-state aware; if
// still level, penalties are taken KICK BY KICK — real takers, real keeper,
// sudden death if needed. The sequence returns for the UI to relive.
export function settleKnockout(
  home: MatchTeam,
  away: MatchTeam,
  base: MatchResult,
  seed: number,
): MatchResult {
  if (base.homeGoals !== base.awayGoals) return base
  const rng = new RNG(deriveSeedLocal(seed, 0xe7))

  const zHome = finalZones(home)
  const zAway = finalZones(away)
  const edgeHome = midfieldEdge(zHome.midfield / zAway.midfield)
  const edgeAway = midfieldEdge(zAway.midfield / zHome.midfield)
  // A third of a match, minus tired legs.
  const xgEtHome = Math.max(0.12, 0.33 * 0.92 * MATCH.baseChances * (zHome.attack / zAway.defense) * edgeHome)
  const xgEtAway = Math.max(0.12, 0.33 * 0.92 * MATCH.baseChances * (zAway.attack / zHome.defense) * edgeAway)
  const etHome = poisson(rng, xgEtHome)
  const etAway = poisson(rng, xgEtAway)

  const etScorersHome = assignScorers(home, etHome, rng, 91, 120)
  const etScorersAway = assignScorers(away, etAway, rng, 91, 120)
  const etEvents: MatchEventLog[] = [
    ...etScorersHome.map((sc) => ({ minute: sc.minute, type: 'GOAL' as const, side: 'home' as const, playerId: sc.playerId, playerName: sc.name })),
    ...etScorersAway.map((sc) => ({ minute: sc.minute, type: 'GOAL' as const, side: 'away' as const, playerId: sc.playerId, playerName: sc.name })),
  ]

  let result: MatchResult = {
    ...base,
    extraTime: true,
    homeGoals: base.homeGoals + etHome,
    awayGoals: base.awayGoals + etAway,
    scorersHome: [...base.scorersHome, ...etScorersHome.map((sc) => ({ name: sc.name, minute: sc.minute }))],
    scorersAway: [...base.scorersAway, ...etScorersAway.map((sc) => ({ name: sc.name, minute: sc.minute }))],
    events: [...base.events, ...etEvents].sort((a, b) => a.minute - b.minute),
  }
  if (result.homeGoals !== result.awayGoals) return result

  // The shootout. Takers ranked by nerve and finish; keepers earn their saves.
  const takers = (t: MatchTeam) =>
    Object.values(t.playerBySlot)
      .filter((p): p is Player => !!p && p.position !== 'GK')
      .sort((a, b) => b.ratings.finishing + b.ratings.mental - (a.ratings.finishing + a.ratings.mental))
  const gk = (t: MatchTeam) => Object.values(t.playerBySlot).find((p): p is Player => !!p && p.position === 'GK')

  const hTakers = takers(home)
  const aTakers = takers(away)
  const hGk = gk(away)?.ratings.goalkeeping ?? 60 // the keeper HOME shoots against
  const aGk = gk(home)?.ratings.goalkeeping ?? 60
  const kicks: ShootoutKick[] = []
  let hPens = 0
  let aPens = 0

  const take = (taker: Player, oppGk: number): boolean => {
    const skill = (taker.ratings.finishing + taker.ratings.mental) / 2
    const p = Math.max(0.55, Math.min(0.93, 0.76 + (skill - 70) * 0.004 - (oppGk - 70) * 0.0035 + (taker.form - 60) * 0.001))
    return rng.next() < p
  }

  // Five rounds, stopping early when mathematically decided; then sudden death.
  for (let round = 0; round < 5; round++) {
    const ht = hTakers[round % hTakers.length]
    const hScored = take(ht, hGk)
    if (hScored) hPens++
    kicks.push({ side: 'home', taker: ht.name, scored: hScored })
    if (aPens - hPens > 5 - round - 1 || hPens - aPens > 5 - round) break
    const at = aTakers[round % aTakers.length]
    const aScored = take(at, aGk)
    if (aScored) aPens++
    kicks.push({ side: 'away', taker: at.name, scored: aScored })
    if (hPens - aPens > 5 - round - 1 || aPens - hPens > 5 - round - 1) break
  }
  // Sudden death: pair by pair until someone blinks.
  let sd = 5
  while (hPens === aPens) {
    const ht = hTakers[sd % hTakers.length]
    const hScored = take(ht, hGk)
    if (hScored) hPens++
    kicks.push({ side: 'home', taker: ht.name, scored: hScored })
    const at = aTakers[sd % aTakers.length]
    const aScored = take(at, aGk)
    if (aScored) aPens++
    kicks.push({ side: 'away', taker: at.name, scored: aScored })
    sd++
    if (sd > 30) break // impossible in practice; determinism guard
  }
  const winner: 'home' | 'away' = hPens > aPens ? 'home' : 'away'
  return { ...result, shootout: { kicks, homePens: hPens, awayPens: aPens, winner } }
}

function deriveSeedLocal(base: number, part: number): number {
  return (Math.imul((base >>> 0) ^ part, 0x01000193) >>> 0)
}
