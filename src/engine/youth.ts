// Annual youth generation (NTM_Youth_Generation_v1). Once per year each nation
// produces an intake. Stage 1: intake SIZE scales with pool depth (more bodies,
// not just better ones). Stage 2: each prospect's POTENTIAL is the lottery draw
// (handled in playerGen.drawPotential). Rarely, a class is flagged a GOLDEN
// generation and seeded with several high-potential kids at once.
//
// Prospects enter SILENTLY — no notification, hidden potential. They surface
// only via news hype or scouting coverage.

import type { Nation, Player, Position } from './types'
import { RNG, deriveSeed, hashStr } from './rng'
import { generatePlayer } from './playerGen'

export interface YouthIntake {
  players: Player[]
  golden: boolean
}

// Stage 1 — how many draws this nation takes this year, by pool depth.
function intakeSize(nation: Nation, rng: RNG): number {
  const depth = (nation.nationRating + nation.youthRating) / 2
  if (depth >= 82) return rng.int(5, 7) // major producers
  if (depth >= 72) return rng.int(3, 5) // mid-tier
  return rng.int(1, 3) // minnows — a gem is a national event
}

const INTAKE_POSITIONS: Position[] = ['GK', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW']

export function generateYouthIntake(nation: Nation, year: number, careerSeed: number): YouthIntake {
  const rng = new RNG(deriveSeed(careerSeed, hashStr(nation.id), year, 0x59))

  // Golden generation: low annual probability, weighted by youth rating.
  const golden = rng.bool((nation.youthRating / 100) * 0.05)

  const n = intakeSize(nation, rng)
  const players: Player[] = []
  for (let i = 0; i < n; i++) {
    const position = rng.pick(INTAKE_POSITIONS)
    const age = rng.int(16, 18)
    // In a golden year, several of the class get the lifted potential floor.
    const goldenSeed = golden && i < Math.max(2, Math.floor(n / 2))
    const dualNational = rng.bool(0.12) // small fraction, per the scarcity rule
    players.push(
      generatePlayer({
        nation,
        position,
        age,
        dualNational,
        goldenSeed,
        rng,
        index: 1000 + year * 50 + i,
      }),
    )
  }

  return { players, golden }
}

