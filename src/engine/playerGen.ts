// Player generation. The talent lottery lives here: potential is a draw from a
// heavily right-skewed distribution (most ordinary, a long thin tail of
// brilliance), shifted up by the nation's Youth Rating and floored by Football
// Culture. Current ability is derived from potential via the age curve, so a
// 16-year-old wonderkid reads raw NOW but carries a hidden ceiling. Nothing is
// hand-placed — wonderkids fall out of the tail naturally.

import type { Nation, Player, Position, Ratings } from './types'
import { RNG, deriveSeed, hashStr } from './rng'
import { generateName } from './nameGen'
import { ALL_NATIONS, ALL_NATIONS_BY_ID } from '@/data/nations'
import { HERITAGE, HERITAGE_FLAVOR_CHANCE } from '@/data/heritage'
import { maturityFactor } from './ageCurve'

const LEAGUES = [
  'English First Division',
  'Spanish First Division',
  'German First Division',
  'Italian First Division',
  'French First Division',
  'Dutch First Division',
  'Portuguese First Division',
  'American First Division',
  'Belgian First Division',
  'Turkish First Division',
  'Saudi First Division',
  'Brazilian First Division',
  'Domestic League',
]

const CLUB_PREFIXES = ['United', 'City', 'Athletic', 'Sporting', 'Real', 'Inter', 'Olympic', 'Rovers']
const CLUB_PLACES = ['North', 'Port', 'Lake', 'Hill', 'River', 'East', 'West', 'Central', 'Gold', 'Bay']

const TOP_LEAGUES = LEAGUES.slice(0, 5) // English/Spanish/German/Italian/French
const MID_LEAGUES = LEAGUES.slice(5, 10) // Dutch/Portuguese/American/Belgian/Turkish
const LOW_LEAGUES = LEAGUES.slice(10) // Saudi/Brazilian/Domestic

// Better players gravitate to stronger leagues; squad/fringe players cluster in
// mid and domestic leagues. This clustering is what makes coverage a real
// allocation puzzle — cover the big leagues to track your stars.
function pickLeague(overall: number, rng: RNG): string {
  const r = rng.next()
  if (overall >= 82) return r < 0.7 ? rng.pick(TOP_LEAGUES) : r < 0.93 ? rng.pick(MID_LEAGUES) : rng.pick(LOW_LEAGUES)
  if (overall >= 72) return r < 0.38 ? rng.pick(TOP_LEAGUES) : r < 0.82 ? rng.pick(MID_LEAGUES) : rng.pick(LOW_LEAGUES)
  return r < 0.12 ? rng.pick(TOP_LEAGUES) : r < 0.45 ? rng.pick(MID_LEAGUES) : rng.pick(LOW_LEAGUES)
}

export interface GenPlayerOpts {
  nation: Nation
  position: Position
  age: number
  dualNational?: boolean
  goldenSeed?: boolean // part of a golden generation -> potential floor lifted
  // Senior mode: an established international generated AT this overall. His
  // hidden potential is derived from it via the age curve so generation and the
  // development engine stay consistent. Omit for youth (lottery) generation.
  seniorTargetOverall?: number
  rng: RNG
  index: number
}

// ---- Stage 2 of generation: the potential lottery ----
// Returns a hidden potential in ~40..99, heavily right-skewed.
export function drawPotential(rng: RNG, youthRating: number, footballCulture: number, golden = false): number {
  // skewed() biases toward 0 with a long tail toward 1.
  const skew = golden ? Math.max(rng.skewed(2.6), rng.skewed(2.6)) : rng.skewed(2.7)
  let potential = 44 + skew * 52 // most land 44..62, rare ones reach into the 90s
  potential += (youthRating - 75) * 0.32 // youth powerhouses shift the whole curve up
  const cultureFloor = 38 + (footballCulture - 70) * 0.32 // strong culture trims the bottom
  potential = Math.max(potential, cultureFloor)
  if (golden) potential = Math.max(potential, 82)
  return clamp(Math.round(potential), 40, 99)
}

export function generatePlayer(opts: GenPlayerOpts): Player {
  const { nation, position, age, rng, index } = opts
  const dualNational = !!opts.dualNational

  const secondNation = dualNational ? pickSecondNation(nation, rng) : null
  // A dual-national often learned his football in the "second" country.
  const namePoolNation = dualNational && rng.bool(0.6) ? secondNation! : nation
  const name = generateName(namePoolNation.namePool, rng)

  const maturity = maturityFactor(age, position)
  let potential: number
  let currentOverall: number
  if (opts.seniorTargetOverall !== undefined) {
    // Established international: anchor him at the target; potential is his
    // current ability plus age-appropriate headroom (younger -> more to come).
    currentOverall = clamp(Math.round(opts.seniorTargetOverall), 30, 96)
    potential = clamp(Math.round(currentOverall + headroomByAge(age, rng)), currentOverall, 99)
    if (opts.goldenSeed) potential = Math.max(potential, 82)
  } else {
    // Youth lottery: potential is the draw, current ability follows the curve.
    potential = drawPotential(rng, nation.youthRating, nation.footballCulture, opts.goldenSeed)
    currentOverall = clamp(Math.round(potential * maturity + rng.range(-2, 2)), 28, 96)
  }

  const ratings = ratingsForOverall(position, currentOverall, rng)
  const overall = overallFor(position, ratings)

  // Hidden playing-time factor — the dominant growth lever. Most internationals
  // play regularly; a low roll is the "wasted talent" case the advisory events
  // hang off later. Centered fairly high so genuine talents generally develop.
  const playingTime = clamp(
    0.5 + (currentOverall - 60) / 80 + (age >= 23 ? 0.1 : -0.05) + rng.range(-0.18, 0.18),
    0.1,
    1,
  )

  // The SCOUTED READ. Established seniors carry a fairly accurate public read;
  // young prospects are murky (you don't know what you've got until you watch).
  // Initial confidence: a baseline range on everyone (footage exists for all
  // top-flight players — there is no "??"), tighter on established names than on
  // murky teenagers. Nobody starts exact; you earn that by calling players up.
  const young = age <= 20
  const readNoise = young ? rng.range(-7, 7) : rng.range(-3, 3)
  const knownOverall = clamp(Math.round(overall + readNoise), 25, 99)
  const knownPotential = young ? 0 : clamp(Math.round(potential + rng.range(-5, 5)), 40, 99)
  const freshness = young ? rng.int(28, 44) : rng.int(46, 66)

  const eligibleNations = dualNational ? [nation.id, secondNation!.id] : [nation.id]
  const leans: Record<string, number> = {}
  for (const id of eligibleNations) leans[id] = rng.range(20, 80)
  if (dualNational) leans[namePoolNation.id] += rng.range(5, 20)

  return {
    id: `${nation.id}-${index}-${rng.int(1000, 9999)}`,
    name,
    nationality: namePoolNation.id,
    position,
    age,
    club: `${rng.pick(CLUB_PLACES)} ${rng.pick(CLUB_PREFIXES)}`,
    clubLeague: pickLeague(overall, rng),
    ratings,
    overall,
    potential,
    form: rng.int(40, 80),
    injuryRisk: rng.int(5, 40),
    professionalism: rng.int(40, 95),
    consistency: rng.int(40, 95),
    playingTime,
    knownOverall,
    knownPotential,
    freshness,
    inPersonOverall: null,
    inPersonWeeks: 0,
    eligibleNations,
    leans,
    eligibilityState: 'ELIGIBLE',
    tiedNation: null,
  }
}

// The full eligible pool size for a nation, by pool depth. A national manager
// chooses ~26 for each window out of a much larger pool — bigger for the major
// football nations — so selection is a real decision.
export function poolSize(nation: Nation): number {
  const depth = (nation.nationRating + nation.youthRating) / 2
  if (depth >= 84) return 72
  if (depth >= 80) return 62
  if (depth >= 75) return 52
  if (depth >= 70) return 44
  return 34
}

// Generate `size` players as a per-position quality hierarchy: the best in each
// line sits near the nation's strength, with depth tailing off below, so the
// auto-XI is balanced and selection depth is real. Plus a few uncommitted
// dual-national prospects.
export function generatePool(nation: Nation, seed: number, size: number): Player[] {
  const rng = new RNG(deriveSeed(seed, hashStr(nation.id)))
  const counts = positionCounts(size)
  const players: Player[] = []
  let index = 0

  for (const [pos, n] of Object.entries(counts) as [Position, number][]) {
    const top = nation.nationRating + (pos === 'GK' ? -1 : 3)
    for (let r = 0; r < n; r++) {
      const rank = n <= 1 ? 0 : r / (n - 1) // 0 = best in the line, 1 = deepest
      const target = clamp(Math.round(top - Math.pow(rank, 1.1) * 30 + rng.range(-4, 4)), 40, 95)
      // Deeper squad slots skew younger (prospects) or older (journeymen).
      const age = rank > 0.6 && rng.bool(0.45) ? rng.int(18, 21) : rng.int(21, 34)
      players.push(generatePlayer({ nation, position: pos, age, seniorTargetOverall: target, rng, index: index++ }))
    }
  }

  const dualCount = rng.int(2, 4)
  for (let i = 0; i < dualCount; i++) {
    const pos = rng.pick(['DF', 'MF', 'MF', 'FW'] as Position[])
    players.push(generatePlayer({ nation, position: pos, age: rng.int(17, 21), dualNational: true, rng, index: 500 + i }))
  }

  return players
}

function positionCounts(size: number): Record<Position, number> {
  const gk = Math.max(3, Math.round(size * 0.1))
  const df = Math.round(size * 0.34)
  const mf = Math.round(size * 0.34)
  const fw = Math.max(2, size - gk - df - mf)
  return { GK: gk, DF: df, MF: mf, FW: fw }
}

// The manager's nation gets a full pool; AI opponents only need enough for an XI
// plus a few subs (regenerated on demand, so kept small for cost).
export function generateManagerPool(nation: Nation, seed: number): Player[] {
  return generatePool(nation, seed, poolSize(nation))
}

// ---- Generational world squads ----
// Every other nation's squad is a set of persistent VIRTUAL careers, not a
// frozen snapshot: each squad slot hosts a player whose identity (name, debut
// age, peak quality) is fixed for his whole career span, whose age advances
// with the season, whose ability follows an age curve (rise -> peak -> decline),
// and who is individually replaced by the next generation when his span ends.
// Spans are staggered per slot, so turnover is gradual — you watch a rival's
// star age across cycles while their next kid breaks through. All of it is
// derived deterministically from (careerSeed, nation, slot, generation): zero
// save-file cost, and several high peaks overlapping IS a golden generation.

// Same 18-man composition the old snapshot squads had (keeps match balance).
const WORLD_SQUAD_LINES: { pos: Position; count: number }[] = [
  { pos: 'GK', count: 3 },
  { pos: 'DF', count: 6 },
  { pos: 'MF', count: 6 },
  { pos: 'FW', count: 3 },
]
// Career span in seasons. Debut age is derived FROM the span so everyone
// retires around 34-36: long spans are prodigies who debut at 16-18, short
// spans are late bloomers arriving in their early 20s.
const SPAN_MIN = 13
const SPAN_MAX = 19
const WORLD_STAR_CHANCE = 0.08 // per slot-generation: a genuine star is born
// The age curve deflates most of a squad below peak; nudge the anchor up so a
// nation's fielded XI still averages out near its rating.
const WORLD_CURVE_COMP = 3

// Ability multiplier across a virtual career: raw teenager -> peak 26-29 ->
// decline (slower for GK/DF, matching the development engine's shape).
function worldAgeCurve(age: number, pos: Position): number {
  if (age <= 26) return 0.86 + (Math.max(age, 17) - 17) * (0.14 / 9)
  if (age <= 29) return 1
  const rate = pos === 'GK' || pos === 'DF' ? 0.008 : 0.015
  return 1 - rate * (age - 29)
}

export function generateSquadForNation(
  nation: Nation,
  seed: number,
  season = 1,
  anchorRating = nation.nationRating,
): Player[] {
  const players: Player[] = []
  let slotIndex = 0

  for (const line of WORLD_SQUAD_LINES) {
    for (let r = 0; r < line.count; r++) {
      const i = slotIndex++
      const slotSeed = deriveSeed(seed, hashStr(nation.id), i, 0x5107)
      const span = SPAN_MIN + (slotSeed % (SPAN_MAX - SPAN_MIN + 1))
      const phase = deriveSeed(slotSeed, 0x0f) % span
      const gen = Math.floor((season + phase) / span)
      const seasonsIn = (season + phase) % span

      // One RNG per (nation, slot, generation): the identity rolls (name, debut
      // age) land on the same sequence positions every season, so the player
      // stays HIMSELF for his whole career while his numbers evolve.
      const rng = new RNG(deriveSeed(seed, hashStr(nation.id), i, gen, 0x9e))
      const debutAge = 35 - span + rng.int(0, 2) // span 19 -> 16..18, span 13 -> 22..24
      const age = debutAge + seasonsIn // debut .. ~34-36

      // Stars come from a separate stream so they never disturb identity rolls.
      const starRng = new RNG(deriveSeed(slotSeed, gen, 0x57a7))
      const star = starRng.bool(WORLD_STAR_CHANCE) ? starRng.range(4, 10) : 0

      const top = anchorRating + (line.pos === 'GK' ? -1 : 3) + WORLD_CURVE_COMP
      const rank = line.count <= 1 ? 0 : r / (line.count - 1)
      const peak = clamp(Math.round(top - Math.pow(rank, 1.1) * 30 + rng.range(-4, 4) + star), 40, 97)
      const current = clamp(Math.round(peak * worldAgeCurve(age, line.pos)), 38, 97)

      const p = generatePlayer({
        nation,
        position: line.pos,
        age,
        seniorTargetOverall: current,
        rng,
        index: i,
      })
      players.push({ ...p, id: `${nation.id}-w${i}-g${gen}`, potential: Math.max(p.potential, peak) })
    }
  }
  return players
}

// Build a ratings block that evaluates (via overallFor) to roughly `target`,
// with position-appropriate emphasis.
function ratingsForOverall(position: Position, target: number, rng: RNG): Ratings {
  const j = () => clamp(Math.round(target + rng.range(-6, 6)), 18, 99)
  const low = () => clamp(Math.round(target - rng.range(10, 24)), 14, 84)
  const r: Ratings = {
    finishing: low(),
    pace: j(),
    technique: j(),
    passing: j(),
    physical: j(),
    mental: j(),
    defending: low(),
    goalkeeping: clamp(Math.round(14 + rng.range(0, 10)), 10, 34),
  }
  switch (position) {
    case 'GK':
      r.goalkeeping = clamp(target + rng.int(2, 6), 20, 99)
      r.defending = clamp(target - rng.int(4, 12), 20, 90)
      break
    case 'DF':
      r.defending = clamp(target + rng.int(2, 6), 20, 99)
      r.physical = j()
      break
    case 'MF':
      r.passing = clamp(target + rng.int(2, 6), 20, 99)
      r.technique = j()
      break
    case 'FW':
      r.finishing = clamp(target + rng.int(2, 7), 20, 99)
      r.pace = j()
      break
  }
  return r
}

// Headroom between a senior's current ability and his ceiling, by age.
function headroomByAge(age: number, rng: RNG): number {
  if (age <= 20) return rng.range(8, 20)
  if (age <= 23) return rng.range(4, 12)
  if (age <= 27) return rng.range(1, 6)
  return rng.range(0, 3)
}

// Unrounded position-weighted overall — used by the development engine so tiny
// weekly changes accumulate instead of being rounded away.
export function overallForRaw(position: Position, r: Ratings): number {
  switch (position) {
    case 'GK':
      return r.goalkeeping * 0.6 + r.defending * 0.2 + r.mental * 0.2
    case 'DF':
      return r.defending * 0.45 + r.physical * 0.2 + r.pace * 0.15 + r.mental * 0.2
    case 'MF':
      return r.passing * 0.35 + r.technique * 0.25 + r.physical * 0.2 + r.mental * 0.2
    case 'FW':
    default:
      return r.finishing * 0.4 + r.pace * 0.25 + r.technique * 0.2 + r.mental * 0.15
  }
}

// Position-weighted overall used for display + zone strength snapshots.
export function overallFor(position: Position, r: Ratings): number {
  let v: number
  switch (position) {
    case 'GK':
      v = r.goalkeeping * 0.6 + r.defending * 0.2 + r.mental * 0.2
      break
    case 'DF':
      v = r.defending * 0.45 + r.physical * 0.2 + r.pace * 0.15 + r.mental * 0.2
      break
    case 'MF':
      v = r.passing * 0.35 + r.technique * 0.25 + r.physical * 0.2 + r.mental * 0.2
      break
    case 'FW':
    default:
      v = r.finishing * 0.4 + r.pace * 0.25 + r.technique * 0.2 + r.mental * 0.15
      break
  }
  return Math.round(v)
}

// A dual-national's second eligibility, drawn from plausible migration patterns
// (heritage-weighted) with a small chance of an out-of-pattern surprise.
function pickSecondNation(nation: Nation, rng: RNG): Nation {
  const others = ALL_NATIONS.filter((x) => x.id !== nation.id)

  // Flavor randomness — the occasional unexpected heritage.
  if (rng.bool(HERITAGE_FLAVOR_CHANCE)) return rng.pick(others)

  const weights = (HERITAGE[nation.id] ?? []).filter(([id]) => ALL_NATIONS_BY_ID[id])
  const total = weights.reduce((s, [, w]) => s + w, 0)
  if (total > 0) {
    let r = rng.next() * total
    for (const [id, w] of weights) {
      r -= w
      if (r <= 0) return ALL_NATIONS_BY_ID[id]
    }
  }

  // Fallback for nations without a heritage entry: a confederation neighbour,
  // else anyone.
  const sameConf = others.filter((x) => x.confederation === nation.confederation)
  return rng.pick(sameConf.length ? sameConf : others)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

