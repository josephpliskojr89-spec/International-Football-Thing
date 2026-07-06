import { describe, it, expect } from 'vitest'
import { generateManagerPool, generateSquadForNation } from '@/engine/playerGen'
import { NATIONS_BY_ID } from '@/data/nations'
import { LEAGUES_BY_NAME, DOMESTIC_LEAGUE, GENERIC_LEAGUE } from '@/data/leagues'
import { createCareer } from '@/engine/career'
import { advanceWeek } from '@/engine/calendar'
import type { Career } from '@/engine/types'

describe('club football realism', () => {
  it('a big-league nation keeps the majority of its players at home', () => {
    const pool = generateManagerPool(NATIONS_BY_ID['ENG'], 42)
    const home = pool.filter((p) => p.clubLeague === 'English First Division').length
    expect(home / pool.length).toBeGreaterThan(0.6)
  })

  it('a strong-league exporter sends its stars abroad and keeps its depth', () => {
    const pool = generateManagerPool(NATIONS_BY_ID['BRA'], 42)
    const stars = pool.filter((p) => p.overall >= 84)
    const depth = pool.filter((p) => p.overall < 76)
    const starsAbroad = stars.filter((p) => LEAGUES_BY_NAME[p.clubLeague]?.tier === 1).length
    const depthHome = depth.filter((p) => p.clubLeague === 'Brazilian First Division').length
    if (stars.length >= 3) expect(starsAbroad / stars.length).toBeGreaterThan(0.5)
    expect(depthHome / depth.length).toBeGreaterThan(0.6)
  })

  it('a minnow exports its best and fills the rest domestically', () => {
    const pool = generateManagerPool(NATIONS_BY_ID['NZL'], 42)
    expect(DOMESTIC_LEAGUE['NZL']).toBeUndefined()
    const weak = pool.filter((p) => p.overall < 70)
    const weakGeneric = weak.filter((p) => p.clubLeague === GENERIC_LEAGUE).length
    expect(weakGeneric / Math.max(1, weak.length)).toBeGreaterThan(0.5)
  })

  it('players at named leagues play for that league\'s named clubs', () => {
    for (const nat of ['ENG', 'GER', 'MEX'] as const) {
      const pool = generateManagerPool(NATIONS_BY_ID[nat], 7)
      for (const p of pool) {
        const league = LEAGUES_BY_NAME[p.clubLeague]
        if (league) expect(league.clubs).toContain(p.club)
      }
    }
  })

  it('world squads keep league realism too', () => {
    const squad = generateSquadForNation(NATIONS_BY_ID['ITA'], 9, 3)
    const home = squad.filter((p) => p.clubLeague === 'Italian First Division').length
    expect(home / squad.length).toBeGreaterThan(0.55)
  })
})

describe('the weeks between windows', () => {
  function walk(c: Career, n: number): Career {
    for (let i = 0; i < n; i++) {
      c = advanceWeek({ ...c, playedFixtures: [...new Set([...c.playedFixtures, ...['late-winter','spring','early-autumn','october','november'].map((id) => `${c.season}:${id}`)])], tournament: null })
    }
    return c
  }

  it('club watch dispatches fill the quiet weeks', () => {
    let c = createCareer({ managerName: 'T', nationId: 'ESP', style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed: 77 })
    c = walk(c, 6)
    const clubItems = c.news.filter((n) => n.type === 'CLUB_WATCH')
    expect(clubItems.length).toBeGreaterThanOrEqual(6) // ~2 per non-window week
    // dispatches reference real clubs of real pool players
    const names = new Set(c.players.map((p) => p.name))
    expect(clubItems.some((n) => [...names].some((nm) => n.text.includes(nm)))).toBe(true)
  })
})
