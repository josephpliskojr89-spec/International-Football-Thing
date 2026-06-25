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
  type: 'GOAL' | 'INJURY'
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

export interface MatchResult {
  homeName: string
  awayName: string
  homeGoals: number
  awayGoals: number
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

  const zHome = finalZones(home)
  const zAway = finalZones(away)

  // Step 3 — midfield matchup -> edge for each side (fulcrum).
  const edgeHome = midfieldEdge(zHome.midfield / zAway.midfield)
  const edgeAway = midfieldEdge(zAway.midfield / zHome.midfield)

  // Step 4 — xG from attack-vs-defense delta, scaled by midfield edge.
  const xgHome = clampFloor(MATCH.baseChances * (zHome.attack / zAway.defense) * edgeHome)
  const xgAway = clampFloor(MATCH.baseChances * (zAway.attack / zHome.defense) * edgeAway)

  // Step 5 — independent Poisson per side.
  const homeGoals = poisson(rng, xgHome)
  const awayGoals = poisson(rng, xgAway)

  // Step 6 — back-fill narrative (does not affect the result).
  const scorersHome = assignScorers(home, homeGoals, rng)
  const scorersAway = assignScorers(away, awayGoals, rng)
  const injuries = rollInjuries(home, away, rng)

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

function assignScorers(team: MatchTeam, goals: number, rng: RNG): Scorer[] {
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
    scorers.push({ playerId: chosen.id, name: chosen.name, minute: rng.int(1, 90) })
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
