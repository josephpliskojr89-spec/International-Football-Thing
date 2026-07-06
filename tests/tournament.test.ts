import { describe, it, expect } from 'vitest'
import {
  createTournament,
  managerTie,
  resolveTournamentRound,
  decide,
  roundName,
  totalRounds,
  CONTINENTAL_SIZE,
  WORLD_CUP_SIZE,
} from '@/engine/tournament'
import { ALL_NATIONS_BY_ID } from '@/data/nations'

// Drive a tournament to its conclusion, simming every round (no manager result).
function runToEnd(seed: number, kind: 'CONTINENTAL' | 'WORLD_CUP', managerId: string, include: boolean) {
  let t = createTournament(kind, managerId, seed, 1, include)
  let guard = 0
  while (!t.champion && guard++ < 12) {
    t = resolveTournamentRound(t, null, seed).t
  }
  return t
}

describe('finals tournaments', () => {
  it('creates a continental bracket sized to the confederation and includes the manager', () => {
    const t = createTournament('CONTINENTAL', 'ENG', 123, 1, true)
    expect([CONTINENTAL_SIZE, 4]).toContain(t.field.length)
    expect(t.field).toContain('ENG')
    expect(t.inField).toBe(true)
    // round 0 pairs everyone exactly once
    expect(t.rounds[0].length).toBe(t.field.length / 2)
  })

  it('creates a 16-team World Cup with 4 seeded groups of 4', () => {
    const t = createTournament('WORLD_CUP', 'ENG', 7, 4, true)
    expect(t.field.length).toBe(WORLD_CUP_SIZE)
    expect(t.groups!.length).toBe(4)
    const all = t.groups!.flatMap((g) => g.teams)
    expect(new Set(all).size).toBe(16) // everyone drawn exactly once
    // pot 1: the top four seeds land in different groups
    const tops = t.groups!.map((g) => g.teams[0])
    expect(new Set([...t.field.slice(0, 4)])).toEqual(new Set(tops))
    expect(t.rounds.length).toBe(0) // knockout bracket forms after the groups
  })

  it('keeps the manager out of the World Cup when not included', () => {
    const t = createTournament('WORLD_CUP', 'ENG', 9, 4, false)
    expect(t.inField).toBe(false)
    expect(t.field).not.toContain('ENG')
  })

  it('always crowns exactly one champion: 3 group MDs then QF/SF/Final', () => {
    const t = runToEnd(42, 'WORLD_CUP', 'ENG', true)
    expect(t.champion).not.toBeNull()
    expect(t.field).toContain(t.champion)
    expect(t.roundIndex).toBe(6) // 3 group steps + 3 knockout rounds
    expect(t.groupMatchday).toBe(3)
    expect(t.rounds.length).toBe(3)
    // every group played a full round-robin
    for (const g of t.groups!) for (const st of g.standings) expect(st.p).toBe(3)
    // the champion emerged from the top two of their group
    const champGroup = t.groups!.find((g) => g.teams.includes(t.champion!))!
    const pos = champGroup.standings.findIndex((st) => st.nationId === t.champion)
    expect(pos).toBeLessThanOrEqual(1)
  })

  it('resolves a drawn tie on penalties to a field member', () => {
    const r = decide('ENG', 'BRA', 1, 1, 80, 82, 555)
    expect(r.pens).toBe(true)
    expect(['ENG', 'BRA']).toContain(r.winnerId)
  })

  it('a decisive tie has no shootout and the higher score wins', () => {
    const r = decide('ENG', 'BRA', 2, 0, 80, 82, 555)
    expect(r.pens).toBe(false)
    expect(r.winnerId).toBe('ENG')
  })

  it('eliminates the manager when their tie is lost', () => {
    const t = createTournament('CONTINENTAL', 'ENG', 1, 1, true)
    const mt = managerTie(t)!
    // Hand the manager a loss in their orientation (a-side = manager when home).
    const loss = mt.home
      ? { aGoals: 0, bGoals: 2, winnerId: mt.opponentId, pens: false }
      : { aGoals: 2, bGoals: 0, winnerId: mt.opponentId, pens: false }
    const next = resolveTournamentRound(t, loss, 1).t
    expect(next.eliminated).toBe(true)
    expect(managerTie(next)).toBeNull()
  })

  it('a manager bottom of the group after MD3 is eliminated with no KO fixture', async () => {
    const { managerStep, inGroupStage } = await import('@/engine/tournament')
    let t = createTournament('WORLD_CUP', 'ENG', 55, 4, true)
    expect(inGroupStage(t)).toBe(true)
    // Feed the manager three 0-5 defeats.
    for (let md = 0; md < 3; md++) {
      const loss = { aGoals: 0, bGoals: 5, winnerId: '', pens: false }
      const ms = managerStep(t)!
      expect(ms.phase).toBe('GROUP')
      // orientation: manager is a-side when home
      t = resolveTournamentRound(t, ms.home ? loss : { ...loss, aGoals: 5, bGoals: 0 }, 55).t
    }
    expect(t.eliminated).toBe(true)
    expect(managerStep(t)).toBeNull()
    expect(t.rounds[0].length).toBe(4) // the QF bracket formed without you
  })

  it('names rounds from the back of the bracket', () => {
    const r = totalRounds(WORLD_CUP_SIZE) // 4 rounds
    expect(roundName('WORLD_CUP', r - 1, r)).toBe('Final')
    expect(roundName('WORLD_CUP', r - 2, r)).toBe('Semi-final')
    expect(roundName('WORLD_CUP', 0, r)).toBe('Round of 16')
  })

  it('produces deterministic brackets for the same seed', () => {
    const a = runToEnd(2024, 'WORLD_CUP', 'ENG', true)
    const b = runToEnd(2024, 'WORLD_CUP', 'ENG', true)
    expect(a.champion).toBe(b.champion)
  })

  it('only fields nations that exist in the data set', () => {
    const t = createTournament('WORLD_CUP', 'ENG', 3, 4, true)
    for (const id of t.field) expect(ALL_NATIONS_BY_ID[id]).toBeDefined()
  })
})
