import type { Career, ManagerStyle, Player } from './types'
import { SAVE_VERSION, COACH_COUNT } from '@/data/constants'
import { NATIONS_BY_ID } from '@/data/nations'
import { FORMATIONS_BY_ID } from '@/data/formations'
import { generateManagerPool } from './playerGen'
import { RNG, deriveSeed } from './rng'
import { generateName } from './nameGen'

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

  const formation = input.style.formation
  const lineup = autoFillLineup(players, formation, input.style)
  const bench = autoFillBench(players, lineup, input.style)
  const coaches = makeCoaches(seed)

  return {
    seed,
    createdAt: stamp(),
    saveVersion: SAVE_VERSION,
    managerName: input.managerName.trim() || 'The Manager',
    managerNationId: input.nationId,
    style: input.style,
    year: 1,
    season: 1,
    week: 1,
    exhibitionCount: 0,
    players,
    coaches,
    lineup,
    bench,
    formation,
    news: [
      {
        id: 'welcome',
        week: 1,
        year: 1,
        type: 'APPOINTMENT',
        magnitude: 0.7,
        text: `${input.managerName.trim() || 'A new manager'} takes charge of ${nation.name}. The nation waits to see what kind of side they'll build.`,
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
    const candidates = players
      .filter((p) => !used.has(p.id))
      .map((p) => ({ p, score: slotScore(p, slot.position, style) }))
      .sort((a, b) => b.score - a.score)
    const pick = candidates[0]?.p ?? null
    if (pick) used.add(pick.id)
    lineup[slot.id] = pick?.id ?? null
  }
  return lineup
}

const BENCH_SIZE = 12 // XI + 12 = a 23-man matchday squad (full window squad later)

// Auto-pick the bench: a sensible spread of the next-best players not in the XI
// (at least one keeper, then best remaining outfield by ability).
export function autoFillBench(
  players: Player[],
  lineup: Record<string, string | null>,
  style: ManagerStyle,
): string[] {
  const inXI = new Set(Object.values(lineup).filter(Boolean) as string[])
  const available = players.filter((p) => !inXI.has(p.id))
  const byPos = (pos: Player['position']) =>
    available
      .filter((p) => p.position === pos)
      .sort((a, b) => slotScore(b, b.position, style) - slotScore(a, a.position, style))

  const bench: string[] = []
  const backupGk = byPos('GK')[0]
  if (backupGk) bench.push(backupGk.id)

  const rest = available
    .filter((p) => p.id !== backupGk?.id)
    .sort((a, b) => slotScore(b, b.position, style) - slotScore(a, a.position, style))
  for (const p of rest) {
    if (bench.length >= BENCH_SIZE) break
    bench.push(p.id)
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
