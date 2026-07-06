import type { Career, ManagerStyle, Player } from './types'
import { SAVE_VERSION, COACH_COUNT } from '@/data/constants'
import { NATIONS_BY_ID } from '@/data/nations'
import { displayYear } from '@/data/windows'
import { FORMATIONS_BY_ID } from '@/data/formations'
import type { PlayStyle } from './types'
import { generateManagerPool } from './playerGen'
import { createCampaign } from './campaign'
import { pickWorldCupHost } from './tournament'
import { initWorld } from './world'
import { cycleObjective } from './manager'
import { RNG, deriveSeed } from './rng'
import { generateName } from './nameGen'

// Approach -> default match style (kept local to avoid a matchSetup import cycle).
export function styleForApproach(approach: ManagerStyle['approach']): PlayStyle {
  return approach === 'Attacking' ? 'HighPress' : approach === 'Defensive' ? 'Counter' : 'Balanced'
}

export interface NewCareerInput {
  managerName: string
  nationId: string
  style: ManagerStyle
  seed?: number
}

export function createCareer(input: NewCareerInput): Career {
  const seed = input.seed ?? makeSeed(input.managerName, input.nationId)
  const nation = NATIONS_BY_ID[input.nationId]
  const players = generateManagerPool(nation, seed)
  const hostId = pickWorldCupHost(input.nationId, seed, 1)
  const host = NATIONS_BY_ID[hostId] ?? { name: hostId }

  const formation = input.style.formation
  const lineup = autoFillLineup(players, formation, input.style)
  const bench = autoFillBench(players, lineup, input.style)
  const registeredSquad = [...(Object.values(lineup).filter(Boolean) as string[]), ...bench]
  const coaches = makeCoaches(seed)

  return {
    seed,
    createdAt: stamp(),
    saveVersion: SAVE_VERSION,
    managerName: input.managerName.trim() || 'The Manager',
    managerNationId: input.nationId,
    style: input.style,
    tactics: { style: styleForApproach(input.style.approach), focalPointId: null },
    year: 1,
    season: 1,
    week: 1,
    exhibitionCount: 0,
    players,
    coaches,
    registeredSquad,
    lineup,
    bench,
    formation,
    playedFixtures: [],
    campaign: createCampaign(input.nationId, seed, 1),
    world: initWorld(),
    qualifiedForWorldCup: false,
    tournament: null,
    trophies: [],
    wcHostId: hostId,
    history: [{ season: 1, type: 'HOST', text: `${host.name} awarded the ${displayYear(4)} World Cup`, nationId: hostId, managerMoment: hostId === input.nationId }],
    legends: [],
    record: { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 },
    reputation: 40,
    objective: cycleObjective(initWorld(), input.nationId),
    lastWcOutcome: null,
    lastCampaignPosition: null,
    offers: [],
    sackedFrom: null,
    news: [
      {
        id: 'welcome',
        week: 1,
        year: 1,
        type: 'APPOINTMENT',
        magnitude: 0.7,
        text: `${input.managerName.trim() || 'A new manager'} takes charge of ${nation.name}. The nation waits to see what kind of side they'll build.`,
      },
      {
        id: 'host-initial',
        week: 1,
        year: 1,
        type: 'HOST',
        magnitude: hostId === input.nationId ? 1 : 0.6,
        text:
          hostId === input.nationId
            ? `And one more thing: ${host.name} host the ${displayYear(4)} World Cup. Your first cycle ends at home, in front of everyone you know.`
            : `This cycle's World Cup, ${displayYear(4)}, will be hosted by ${host.name}.`,
      },
    ],
  }
}

// Auto-pick a starting XI: best-rated eligible player per slot, honoring the
// manager's youth/experience preference as a tiebreaker.
export function autoFillLineup(
  players: Player[],
  formationId: string,
  style: ManagerStyle,
): Record<string, string | null> {
  const formation = FORMATIONS_BY_ID[formationId]
  const lineup: Record<string, string | null> = {}
  const used = new Set<string>()

  for (const slot of formation.slots) {
    // Fit players first; if injuries have gutted the pool, field the walking
    // wounded rather than leave a hole.
    const candidates = players
      .filter((p) => !used.has(p.id))
      .map((p) => ({ p, score: slotScore(p, slot.position, style) - (p.injuredWeeks > 0 ? 1000 : 0) }))
      .sort((a, b) => b.score - a.score)
    const pick = candidates[0]?.p ?? null
    if (pick) used.add(pick.id)
    lineup[slot.id] = pick?.id ?? null
  }
  return lineup
}

const BENCH_SIZE = 15 // XI + 15 = a 26-man window squad
// Target composition of the full 26 (must satisfy the squad minimums).
const SQUAD_TARGETS: Record<Player['position'], number> = { GK: 3, DF: 9, MF: 9, FW: 5 }

// Auto-pick the bench so the full 26 has a sensible, valid positional spread
// (3 keepers, etc.): fill each position up to its target with the best
// available, then top up any remaining slots with the best of the rest.
export function autoFillBench(
  players: Player[],
  lineup: Record<string, string | null>,
  style: ManagerStyle,
): string[] {
  const inXI = new Set(Object.values(lineup).filter(Boolean) as string[])
  const xiPlayers = players.filter((p) => inXI.has(p.id))
  const xiCounts = { GK: 0, DF: 0, MF: 0, FW: 0 } as Record<Player['position'], number>
  for (const p of xiPlayers) xiCounts[p.position]++

  const available = players
    .filter((p) => !inXI.has(p.id))
    .sort((a, b) => slotScore(b, b.position, style) - slotScore(a, a.position, style))
  const used = new Set<string>()
  const bench: string[] = []

  const positions: Player['position'][] = ['GK', 'DF', 'MF', 'FW']
  for (const pos of positions) {
    const need = Math.max(0, SQUAD_TARGETS[pos] - xiCounts[pos])
    let added = 0
    for (const p of available) {
      if (added >= need || bench.length >= BENCH_SIZE) break
      if (p.position === pos && !used.has(p.id)) {
        used.add(p.id)
        bench.push(p.id)
        added++
      }
    }
  }
  // Top up any remaining bench slots with the best players left.
  for (const p of available) {
    if (bench.length >= BENCH_SIZE) break
    if (!used.has(p.id)) {
      used.add(p.id)
      bench.push(p.id)
    }
  }
  return bench
}

function slotScore(p: Player, slotPos: Player['position'], style: ManagerStyle): number {
  let score = p.overall
  if (p.position === slotPos) score += 12 // strong preference for natural position
  else score -= 8
  if (style.preference === 'Youth' && p.age <= 23) score += 4
  if (style.preference === 'Experience' && p.age >= 28) score += 4
  return score
}

function makeCoaches(seed: number): Career['coaches'] {
  const rng = new RNG(deriveSeed(seed, 7))
  const coaches: Career['coaches'] = []
  for (let i = 0; i < COACH_COUNT; i++) {
    coaches.push({
      id: `coach-${i}`,
      name: generateName('ENGLAND', rng),
      leagueAssignment: null,
      targetedLookUsed: false,
    })
  }
  return coaches
}

function makeSeed(name: string, nationId: string): number {
  let h = 2166136261
  const s = name + '|' + nationId
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  // mix in wall-clock so two careers with same inputs still differ
  return deriveSeed(h >>> 0, stamp() & 0xffffffff)
}

function stamp(): number {
  // Date.now is fine in app runtime (only the engine's RNG must stay deterministic
  // once seeded); the seed is captured once and stored on the career.
  return Date.now()
}
