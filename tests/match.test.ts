import { describe, it, expect } from 'vitest'
import { createCareer } from '@/engine/career'
import { simulateMatch } from '@/engine/match'
import { simulateLite } from '@/engine/matchLite'
import { buildManagerTeam, buildOpponentTeam } from '@/engine/matchSetup'
import { NATIONS_BY_ID } from '@/data/nations'

function career(nationId: string, seed = 123) {
  return createCareer({
    managerName: 'T',
    nationId,
    style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
    seed,
  })
}

describe('match engine', () => {
  it('is deterministic for a given seed', () => {
    const c = career('BRA')
    const home = buildManagerTeam(c, true)
    const away = buildOpponentTeam(NATIONS_BY_ID['ARG'], c.seed, false)
    const seed = 1234567
    const a = simulateMatch(home, away, seed)
    const b = simulateMatch(home, away, seed)
    expect(a.homeGoals).toBe(b.homeGoals)
    expect(a.awayGoals).toBe(b.awayGoals)
    expect(a.xgHome).toBe(b.xgHome)
  })

  it('produces realistic scoring and consistent scorer counts', () => {
    const c = career('GER')
    const home = buildManagerTeam(c, true)
    const away = buildOpponentTeam(NATIONS_BY_ID['ITA'], c.seed, false)

    let totalGoals = 0
    const N = 200
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(home, away, 1000 + i)
      // scorers list length must equal the goals scored
      expect(r.scorersHome.length).toBe(r.homeGoals)
      expect(r.scorersAway.length).toBe(r.awayGoals)
      // xG never below the floor
      expect(r.xgHome).toBeGreaterThanOrEqual(0.3)
      expect(r.xgAway).toBeGreaterThanOrEqual(0.3)
      totalGoals += r.homeGoals + r.awayGoals
    }
    const avgPerMatch = totalGoals / N
    // international-ish: roughly 1.5–4.5 goals per game on average
    expect(avgPerMatch).toBeGreaterThan(1.5)
    expect(avgPerMatch).toBeLessThan(4.5)
  })

  it('the stronger side wins clearly more often over a sample', () => {
    const c = career('BRA') // 88 rating
    const home = buildManagerTeam(c, true)
    const away = buildOpponentTeam(NATIONS_BY_ID['NZL'], c.seed, false) // 64 rating
    let homeWins = 0
    let awayWins = 0
    for (let i = 0; i < 300; i++) {
      const r = simulateMatch(home, away, 5000 + i)
      if (r.homeGoals > r.awayGoals) homeWins++
      else if (r.awayGoals > r.homeGoals) awayWins++
    }
    expect(homeWins).toBeGreaterThan(awayWins)
    // but the underdog still nicks the odd result (puncher's chance)
    expect(awayWins).toBeGreaterThan(0)
  })

  it('tier-3 lite resolution returns non-negative goals', () => {
    const r = simulateLite(80, 60, true, 42)
    expect(r.goalsA).toBeGreaterThanOrEqual(0)
    expect(r.goalsB).toBeGreaterThanOrEqual(0)
  })
})
