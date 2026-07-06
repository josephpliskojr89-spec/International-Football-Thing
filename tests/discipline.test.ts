import { describe, it, expect } from 'vitest'
import { simulateMatch } from '@/engine/match'
import { buildOpponentTeam } from '@/engine/matchSetup'
import { NATIONS_BY_ID } from '@/data/nations'
import { matchStory } from '@/engine/matchStory'

describe('discipline', () => {
  it('the engine books players at a realistic rate, with occasional reds', () => {
    let yellows = 0
    let reds = 0
    for (let i = 0; i < 40; i++) {
      const h = buildOpponentTeam(NATIONS_BY_ID['ENG'], i, true)
      const a = buildOpponentTeam(NATIONS_BY_ID['GER'], i + 100, false)
      const r = simulateMatch(h, a, 1000 + i)
      yellows += r.events.filter((e) => e.type === 'YELLOW').length
      reds += r.events.filter((e) => e.type === 'RED').length
    }
    expect(yellows / 40).toBeGreaterThan(1) // a couple of bookings per match
    expect(yellows / 40).toBeLessThan(5)
    expect(reds).toBeGreaterThan(0) // reds exist...
    expect(reds / 40).toBeLessThan(0.4) // ...but stay rare
  })

  it('a red card enters the story of the match', () => {
    for (let i = 0; i < 60; i++) {
      const h = buildOpponentTeam(NATIONS_BY_ID['ITA'], i, true)
      const a = buildOpponentTeam(NATIONS_BY_ID['ESP'], i + 7, false)
      const r = simulateMatch(h, a, 5000 + i)
      if (r.events.some((e) => e.type === 'RED')) {
        expect(/red card/i.test(matchStory(r, true))).toBe(true)
        return
      }
    }
    throw new Error('no red card in 60 matches — rate too low')
  })
})
