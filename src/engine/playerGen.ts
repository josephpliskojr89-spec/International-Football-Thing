// Player generation. The talent lottery lives here: potential is a draw from a
// heavily right-skewed distribution (most ordinary, a long thin tail of
// brilliance), shifted up by the nation's Youth Rating and floored by Football
// Culture. Current ability is derived from potential via the age curve, so a
// 16-year-old wonderkid reads raw NOW but carries a hidden ceiling. Nothing is
// hand-placed — wonderkids fall out of the tail naturally.

import type { Nation, Player, Position, Ratings } from './types'
import { RNG, deriveSeed } from './rng'
import { generateName } from './nameGen'
import { NATIONS } from '@/data/nations'
import { maturityFactor } from './ageCurve'

const SENIOR_SPINE: Position[] = [
  'GK', 'GK', 'GK',
  'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF',
  'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF',
  'FW', 'FW', 'FW', 'FW', 'FW', 'FW',
]

const LEAGUES = [
  'English First Division',
  'Spanish First Division',
  'German First Division',
  'Italian First Division',
  'French First Division',
  'Dutch First Division',
  'Portuguese First Division',
  'American First Division',
]

const CLUB_PREFIXES = ['United', 'City', 'Athletic', 'Sporting', 'Real', 'Inter', 'Olympic', 'Rovers']
const CLUB_PLACES = ['North', 'Port', 'Lake', 'Hill', 'River', 'East', 'West', 'Central', 'Gold', 'Bay']

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
  const young = age <= 20
  const readNoise = young ? rng.range(-7, 7) : rng.range(-3, 3)
  const knownOverall = clamp(Math.round(overall + readNoise), 25, 99)
  const knownPotential = young ? 0 : clamp(Math.round(potential + rng.range(-4, 4)), 40, 99)
  const freshness = young ? rng.int(10, 45) : rng.int(55, 90)

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
    clubLeague: rng.pick(LEAGUES),
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
    eligibleNations,
    leans,
    eligibilityState: 'ELIGIBLE',
    tiedNation: null,
  }
}

// A senior pool for a playable nation (used to seed a starting squad).
export function generateSquadForNation(nation: Nation, seed: number): Player[] {
  const rng = new RNG(deriveSeed(seed, hashStr(nation.id)))
  const players: Player[] = []

  for (let i = 0; i < SENIOR_SPINE.length; i++) {
    const pos = SENIOR_SPINE[i]
    const age = i < 14 ? rng.int(23, 33) : rng.int(19, 30)
    // Starters anchor near the nation's strength; fringe players a notch below.
    const target = clamp(Math.round(nation.nationRating - 9 + (i < 14 ? 7 : 0) + rng.range(-8, 8)), 42, 93)
    players.push(generatePlayer({ nation, position: pos, age, seniorTargetOverall: target, rng, index: i }))
  }

  // A few uncommitted dual-national prospects — these DO use the youth lottery,
  // so an uncommitted teenage gem is genuinely possible.
  const dualCount = rng.int(2, 4)
  for (let i = 0; i < dualCount; i++) {
    const pos = rng.pick(['DF', 'MF', 'MF', 'FW'] as Position[])
    players.push(generatePlayer({ nation, position: pos, age: rng.int(17, 21), dualNational: true, rng, index: 100 + i }))
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

function pickSecondNation(nation: Nation, rng: RNG): Nation {
  const others = NATIONS.filter((x) => x.id !== nation.id)
  return rng.pick(others)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
