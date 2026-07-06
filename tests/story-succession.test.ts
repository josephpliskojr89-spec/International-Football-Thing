import { describe, it, expect } from 'vitest'
import { matchStory } from '@/engine/matchStory'
import type { MatchResult } from '@/engine/match'

function mkResult(over: Partial<MatchResult>): MatchResult {
  return {
    homeName: 'England', awayName: 'France', homeGoals: 0, awayGoals: 0,
    xgHome: 1.2, xgAway: 1.1, possessionHome: 50, events: [],
    scorersHome: [], scorersAway: [], motm: null, ratingsHome: [], ratingsAway: [],
    ...over,
  } as MatchResult
}
const goal = (side: 'home' | 'away', minute: number, name = 'Player') =>
  ({ minute, type: 'GOAL' as const, side, playerId: 'x', playerName: name })

describe('the story of the match', () => {
  it('calls a comeback a comeback', () => {
    const r = mkResult({ homeGoals: 2, awayGoals: 1, events: [goal('away', 10), goal('home', 60), goal('home', 85)] })
    const s = matchStory(r, true)
    expect(/came from behind|found something/i.test(s)).toBe(true)
  })

  it('calls a collapse a collapse', () => {
    const r = mkResult({ homeGoals: 1, awayGoals: 2, events: [goal('home', 5), goal('away', 70), goal('away', 89, 'Villain')] })
    const s = matchStory(r, true)
    expect(/let it slip|collapse/i.test(s)).toBe(true)
    expect(s).toContain('Villain')
    expect(/cruelest kind of late/.test(s)).toBe(true)
  })

  it('spots a smash-and-grab from the xG', () => {
    const r = mkResult({ homeGoals: 1, awayGoals: 0, xgHome: 0.4, xgAway: 2.1, events: [goal('home', 30)] })
    expect(matchStory(r, true)).toContain('smash-and-grab')
  })

  it('is deterministic', () => {
    const r = mkResult({ homeGoals: 3, awayGoals: 0, events: [goal('home', 12), goal('home', 44), goal('home', 78)] })
    expect(matchStory(r, true)).toBe(matchStory(r, true))
  })
})

describe('succession (new manager, same world)', () => {
  it('the successor inherits world, history and season, at a cycle boundary', async () => {
    const { useGame } = await import('@/state/store')
    const { createCareer } = await import('@/engine/career')
    const prev = createCareer({ managerName: 'Old Guard', nationId: 'ENG', style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed: 808 })
    const evolved = {
      ...prev, season: 6, year: 2,
      world: { ...prev.world, ratings: { ...prev.world.ratings, ENG: 92 } },
      history: [...prev.history, { season: 4, type: 'WORLD_CUP' as const, text: 'Brazil win', nationId: 'BRA' }],
    }
    useGame.setState({ career: evolved })
    useGame.getState().beginSuccession()
    const payload = useGame.getState().succession!
    expect(payload.season).toBe(9) // handover at the cycle boundary (year 2 -> +3)
    await useGame.getState().startNewCareer({ managerName: 'New Blood', nationId: 'BRA', style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' } })
    const next = useGame.getState().career!
    expect(next.seed).toBe(808) // same world seed: generational identities continue
    expect(next.world.ratings.ENG).toBe(92) // evolved ratings inherited
    expect(next.season).toBe(9)
    expect(next.year).toBe(1)
    expect(next.eraStartSeason).toBe(9)
    expect(next.managerNationId).toBe('BRA')
    expect(next.history.some((h) => h.text.includes('succeeds Old Guard'))).toBe(true)
    expect(next.history.some((h) => h.nationId === 'BRA' && h.type === 'WORLD_CUP')).toBe(true) // predecessor almanac kept
    expect(useGame.getState().succession).toBeNull()
  })
})
