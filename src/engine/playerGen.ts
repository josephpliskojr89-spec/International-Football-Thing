// Lightweight player + squad generator for the shell. Produces a believable
// 23-man pool (plus a couple of uncommitted dual-nationals) for the manager's
// nation so every menu tab has real content. The full youth-intake / potential
// distribution system lands in a later milestone; this shares the same shape so
// it slots in without a rewrite.

import type { Nation, Player, Position, Ratings } from './types'
import { RNG, deriveSeed } from './rng'
import { generateName } from './nameGen'
import { NATIONS } from '@/data/nations'

const POSITION_SPINE: Position[] = [
  'GK', 'GK', 'GK',
  'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF',
  'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF',
  'FW', 'FW', 'FW', 'FW', 'FW', 'FW',
]

const CLUB_PRESTIGE_LEAGUES = [
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

export function generateSquadForNation(nation: Nation, seed: number): Player[] {
  const rng = new RNG(deriveSeed(seed, hashStr(nation.id)))
  const players: Player[] = []

  for (let i = 0; i < POSITION_SPINE.length; i++) {
    players.push(makePlayer(nation, POSITION_SPINE[i], rng, i, false))
  }

  // A small number of uncommitted dual-nationals eligible for this nation.
  const dualCount = rng.int(2, 4)
  for (let i = 0; i < dualCount; i++) {
    const pos = rng.pick(['DF', 'MF', 'MF', 'FW'] as Position[])
    players.push(makePlayer(nation, pos, rng, 100 + i, true))
  }

  return players
}

function makePlayer(
  nation: Nation,
  position: Position,
  rng: RNG,
  index: number,
  dualNational: boolean,
): Player {
  // Where the player learned his football drives which name pool to draw from
  // for a dual-national (gives the "German-raised, US-eligible" texture).
  const secondNation = dualNational ? pickSecondNation(nation, rng) : null
  const namePoolNation = dualNational && rng.bool(0.6) ? secondNation! : nation
  const name = generateName(namePoolNation.namePool, rng)

  const age = dualNational ? rng.int(16, 20) : rng.int(18, 34)
  const baseline = nation.nationRating - 10 + (index < 14 ? 6 : 0)
  const spread = rng.range(-9, 9)
  const target = clamp(Math.round(baseline + spread - youthPenalty(age)), 38, 92)

  const ratings = makeRatings(position, target, rng)
  const overall = overallFor(position, ratings)

  const eligibleNations = dualNational ? [nation.id, secondNation!.id] : [nation.id]
  const leans: Record<string, number> = {}
  for (const id of eligibleNations) leans[id] = rng.range(20, 80)
  if (dualNational) {
    // bias the lean toward where he was raised (the second nation, often)
    leans[namePoolNation.id] += rng.range(5, 20)
  }

  return {
    id: `${nation.id}-${index}-${rng.int(1000, 9999)}`,
    name,
    nationality: namePoolNation.id,
    position,
    age,
    club: makeClub(rng),
    clubLeague: rng.pick(CLUB_PRESTIGE_LEAGUES),
    ratings,
    form: rng.int(40, 85),
    overall,
    potential: clamp(overall + (dualNational ? rng.int(6, 22) : rng.int(0, 10)), overall, 99),
    injuryRisk: rng.int(5, 40),
    professionalism: rng.int(40, 95),
    consistency: rng.int(40, 95),
    eligibleNations,
    leans,
    eligibilityState: 'ELIGIBLE',
    tiedNation: null,
    freshness: dualNational ? rng.int(20, 60) : rng.int(70, 100),
  }
}

function pickSecondNation(nation: Nation, rng: RNG): Nation {
  const others = NATIONS.filter((x) => x.id !== nation.id)
  return rng.pick(others)
}

function makeRatings(position: Position, target: number, rng: RNG): Ratings {
  const j = () => clamp(Math.round(target + rng.range(-6, 6)), 20, 99)
  const low = () => clamp(Math.round(target - rng.range(12, 28)), 15, 80)
  const r: Ratings = {
    finishing: low(),
    pace: j(),
    technique: j(),
    passing: j(),
    physical: j(),
    mental: j(),
    defending: low(),
    goalkeeping: clamp(Math.round(15 + rng.range(0, 10)), 10, 35),
  }
  switch (position) {
    case 'GK':
      r.goalkeeping = j() + 4
      r.defending = clamp(target - rng.int(4, 12), 20, 90)
      break
    case 'DF':
      r.defending = j() + 3
      r.physical = j()
      break
    case 'MF':
      r.passing = j() + 3
      r.technique = j()
      break
    case 'FW':
      r.finishing = j() + 4
      r.pace = j()
      break
  }
  return r
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

function youthPenalty(age: number): number {
  if (age >= 23) return 0
  return (23 - age) * 1.6 // teenagers read lower now; potential carries the upside
}

function makeClub(rng: RNG): string {
  return `${rng.pick(CLUB_PLACES)} ${rng.pick(CLUB_PREFIXES)}`
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
