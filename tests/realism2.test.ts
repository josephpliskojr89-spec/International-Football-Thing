import { describe, it, expect } from 'vitest'
import { createCareer } from '@/engine/career'
import { advanceWeek } from '@/engine/calendar'
import { LEAGUES_BY_NAME, GENERIC_LEAGUE } from '@/data/leagues'
import type { Career } from '@/engine/types'

function mk(seed: number, nationId = 'ENG'): Career {
  return createCareer({ managerName: 'T', nationId, style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed })
}
function walk(c: Career, n: number): Career {
  for (let i = 0; i < n; i++) {
    c = advanceWeek({ ...c, playedFixtures: [...new Set([...c.playedFixtures, ...['late-winter','spring','early-autumn','october','november'].map((id) => `${c.season}:${id}`)])], tournament: null })
  }
  return c
}

describe('the transfer market', () => {
  it('a star stuck below his level earns a move up during a window', () => {
    // Plant an 88-rated player in the generic league across a few seeds; at
    // least one January window must move him (deterministic per seed).
    let moved = false
    for (const seed of [11, 22, 33, 44]) {
      let c = mk(seed)
      c = {
        ...c,
        players: c.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                ratings: { finishing: 90, pace: 90, technique: 90, passing: 90, physical: 90, mental: 90, defending: 90, goalkeeping: 90 },
                overall: 90,
                potential: 92,
                clubLeague: GENERIC_LEAGUE,
                club: 'North United',
                age: 26,
                eligibilityState: 'ELIGIBLE' as const,
              }
            : p),
      }
      const id = c.players[0].id
      c = walk(c, 5) // weeks 2-4 = winter window
      const after = c.players.find((p) => p.id === id)!
      if (after.clubLeague !== GENERIC_LEAGUE) {
        moved = true
        expect(LEAGUES_BY_NAME[after.clubLeague]).toBeDefined()
        expect(c.news.some((n) => n.type === 'TRANSFER' && n.text.includes(after.name))).toBe(true)
        break
      }
    }
    expect(moved).toBe(true)
  })

  it('settled players do not churn clubs', () => {
    let c = mk(55)
    const before = Object.fromEntries(c.players.map((p) => [p.id, p.club]))
    c = walk(c, 5)
    const changed = c.players.filter((p) => before[p.id] && before[p.id] !== p.club).length
    expect(changed).toBeLessThanOrEqual(3) // a transfer window is a trickle, not a flood
  })
})

describe('camp arrivals & severe injuries', () => {
  it('deadline eve produces a camp-word dispatch', () => {
    let c = mk(88, 'BRA')
    // Ensure someone is clearly flying.
    c = { ...c, players: c.players.map((p, i) => (c.registeredSquad.includes(p.id) && i < 40 ? { ...p, form: 85 } : p)) }
    c = walk(c, 7) // arrive at week 8's deadline eve (week 7) along the way
    expect(c.news.some((n) => n.type === 'CAMP')).toBe(true)
  })
})
