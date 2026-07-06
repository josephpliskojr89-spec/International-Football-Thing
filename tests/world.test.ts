import { describe, it, expect } from 'vitest'
import {
  initWorld,
  ratingOf,
  applyResult,
  applyResults,
  seasonTick,
  worldRanking,
  worldRankOf,
  playBackgroundWindow,
  playForeignContinentals,
} from '@/engine/world'
import { generateSquadForNation } from '@/engine/playerGen'
import { ALL_NATIONS_BY_ID, NATIONS_BY_ID } from '@/data/nations'
import { createCareer } from '@/engine/career'
import { advanceWeek } from '@/engine/calendar'

describe('dynamic world ratings (Elo)', () => {
  it('initializes every nation at its static base', () => {
    const w = initWorld()
    expect(ratingOf(w, 'BRA')).toBe(ALL_NATIONS_BY_ID['BRA'].nationRating)
    expect(ratingOf(w, 'NZL')).toBe(ALL_NATIONS_BY_ID['NZL'].nationRating)
  })

  it('is zero-sum: winner gains what the loser sheds', () => {
    const w0 = initWorld()
    const w1 = applyResult(w0, { homeId: 'ENG', awayId: 'FRA', hg: 2, ag: 0 }, 'qualifier')
    const engDelta = ratingOf(w1, 'ENG') - ratingOf(w0, 'ENG')
    const fraDelta = ratingOf(w1, 'FRA') - ratingOf(w0, 'FRA')
    expect(engDelta).toBeGreaterThan(0)
    expect(engDelta + fraDelta).toBeCloseTo(0, 9)
  })

  it('an upset moves ratings more than an expected result', () => {
    const w0 = initWorld()
    // NZL (64) beating BRA (88) is a shock; BRA beating NZL is routine.
    const shock = applyResult(w0, { homeId: 'NZL', awayId: 'BRA', hg: 1, ag: 0 }, 'qualifier')
    const routine = applyResult(w0, { homeId: 'BRA', awayId: 'NZL', hg: 1, ag: 0 }, 'qualifier')
    const shockGain = ratingOf(shock, 'NZL') - ratingOf(w0, 'NZL')
    const routineGain = ratingOf(routine, 'BRA') - ratingOf(w0, 'BRA')
    expect(shockGain).toBeGreaterThan(routineGain * 3)
  })

  it('finals move ratings harder than qualifiers, and margin amplifies', () => {
    const w0 = initWorld()
    const q = applyResult(w0, { homeId: 'ENG', awayId: 'FRA', hg: 1, ag: 0 }, 'qualifier')
    const f = applyResult(w0, { homeId: 'ENG', awayId: 'FRA', hg: 1, ag: 0, neutral: true }, 'finals')
    const big = applyResult(w0, { homeId: 'ENG', awayId: 'FRA', hg: 4, ag: 0 }, 'qualifier')
    expect(ratingOf(f, 'ENG')).toBeGreaterThan(ratingOf(q, 'ENG'))
    expect(ratingOf(big, 'ENG')).toBeGreaterThan(ratingOf(q, 'ENG'))
  })

  it('a shootout win counts for less than a win in normal time', () => {
    const w0 = initWorld()
    const pens = applyResult(
      w0,
      { homeId: 'ENG', awayId: 'FRA', hg: 1, ag: 1, neutral: true, shootout: true, shootoutWinnerId: 'ENG' },
      'finals',
    )
    const win = applyResult(w0, { homeId: 'ENG', awayId: 'FRA', hg: 2, ag: 1, neutral: true }, 'finals')
    expect(ratingOf(win, 'ENG')).toBeGreaterThan(ratingOf(pens, 'ENG'))
    expect(ratingOf(pens, 'ENG')).toBeGreaterThan(ratingOf(w0, 'ENG'))
  })

  it('season tick reverts toward the static base and refreshes rank snapshots', () => {
    let w = initWorld()
    for (let i = 0; i < 10; i++) w = applyResult(w, { homeId: 'USA', awayId: 'MEX', hg: 3, ag: 0 }, 'finals')
    const inflated = ratingOf(w, 'USA')
    const ticked = seasonTick(w)
    expect(ratingOf(ticked, 'USA')).toBeLessThan(inflated)
    expect(ratingOf(ticked, 'USA')).toBeGreaterThan(ALL_NATIONS_BY_ID['USA'].nationRating)
    expect(ticked.seasonStartRanks['USA']).toBe(worldRankOf(ticked, 'USA'))
  })

  it('sustained success climbs the world ranking', () => {
    let w = initWorld()
    const startRank = worldRankOf(w, 'USA')
    const results = Array.from({ length: 20 }, () => ({ homeId: 'USA', awayId: 'MEX', hg: 2, ag: 0 }))
    w = applyResults(w, results, 'qualifier')
    expect(worldRankOf(w, 'USA')).toBeLessThan(startRank)
    const ranking = worldRanking(w)
    expect(ranking[0].rank).toBe(1)
    expect(ranking.every((r, i) => i === 0 || ranking[i - 1].rating >= r.rating)).toBe(true)
  })

  it('background windows move only non-busy nations and are deterministic', () => {
    const w0 = initWorld()
    const busy = new Set(['ENG', 'FRA', 'ESP'])
    const a = playBackgroundWindow(w0, 42, 1, 8, busy)
    const b = playBackgroundWindow(w0, 42, 1, 8, busy)
    expect(a.ratings).toEqual(b.ratings)
    for (const id of busy) expect(ratingOf(a, id)).toBe(ratingOf(w0, id))
    const moved = Object.keys(a.ratings).filter((id) => a.ratings[id] !== w0.ratings[id])
    expect(moved.length).toBeGreaterThan(10)
  })

  it('foreign continentals crown a champion per other confederation', () => {
    const w0 = initWorld()
    const { champions } = playForeignContinentals(w0, 7, 1, 'EFU')
    const confs = champions.map((c) => c.confederation)
    expect(confs).not.toContain('EFU')
    expect(champions.length).toBeGreaterThanOrEqual(3)
    for (const c of champions) {
      expect(ALL_NATIONS_BY_ID[c.championId].confederation).toBe(c.confederation)
    }
  })
})

describe('generational world squads', () => {
  const nation = NATIONS_BY_ID['BRA']

  it('a player keeps his name and position across his career, aging 1/season', () => {
    const s1 = generateSquadForNation(nation, 99, 1)
    const s2 = generateSquadForNation(nation, 99, 2)
    // Players still in the same generation share ids and names, one year older.
    const carried = s2.filter((p) => s1.some((q) => q.id === p.id))
    expect(carried.length).toBeGreaterThan(12) // most of the squad persists year to year
    for (const p of carried) {
      const before = s1.find((q) => q.id === p.id)!
      expect(p.name).toBe(before.name)
      expect(p.position).toBe(before.position)
      expect(p.age).toBe(before.age + 1)
    }
  })

  it('squads turn over gradually: players retire and are replaced individually', () => {
    const s1 = generateSquadForNation(nation, 99, 1)
    const s6 = generateSquadForNation(nation, 99, 6)
    const s20 = generateSquadForNation(nation, 99, 20)
    const survive6 = s6.filter((p) => s1.some((q) => q.id === p.id)).length
    const survive20 = s20.filter((p) => s1.some((q) => q.id === p.id)).length
    expect(survive6).toBeGreaterThan(2) // some careers span 5+ seasons
    expect(survive6).toBeLessThan(18) // but some have ended
    expect(survive20).toBe(0) // a whole generation has passed
  })

  it('nobody is ever older than 36 or younger than 16', () => {
    for (let season = 1; season <= 25; season += 3) {
      for (const p of generateSquadForNation(nation, 5, season)) {
        expect(p.age).toBeGreaterThanOrEqual(16)
        expect(p.age).toBeLessThanOrEqual(36)
      }
    }
  })

  it('squad quality tracks the anchor rating across seasons', () => {
    for (const [natId, anchor] of [['BRA', 88], ['USA', 76], ['NZL', 64]] as const) {
      const nat = NATIONS_BY_ID[natId]
      for (const season of [1, 7, 14]) {
        const squad = generateSquadForNation(nat, 123, season, anchor)
        const top11 = squad.map((p) => p.overall).sort((a, b) => b - a).slice(0, 11)
        const avg = top11.reduce((s, v) => s + v, 0) / 11
        expect(Math.abs(avg - anchor)).toBeLessThan(6)
      }
    }
  })

  it('a risen nation fields better players', () => {
    const base = generateSquadForNation(nation, 7, 3, 80)
    const risen = generateSquadForNation(nation, 7, 3, 90)
    const avg = (ps: typeof base) => ps.reduce((s, p) => s + p.overall, 0) / ps.length
    expect(avg(risen)).toBeGreaterThan(avg(base) + 5)
  })
})

describe('history no longer repeats', () => {
  it('after seasons of results, the World Cup field/seeding differs from the static world', async () => {
    const { createTournament } = await import('@/engine/tournament')
    let w = initWorld()
    // A decade of the world playing: windows + continental finals + reversion.
    for (let season = 1; season <= 10; season++) {
      for (const week of [8, 21, 35, 40, 45]) {
        w = playBackgroundWindow(w, 31337, season, week, new Set())
      }
      if (season % 4 === 1) w = playForeignContinentals(w, 31337, season, 'NONE').world
      w = seasonTick(w)
    }
    const before = createTournament('WORLD_CUP', 'ENG', 1, 1, true).field
    const after = createTournament('WORLD_CUP', 'ENG', 1, 1, true, w).field
    expect(after).not.toEqual(before) // the order (seeding) and/or membership shifted
  })
})

describe('the world breathes through the calendar', () => {
  it('advancing into a window week moves background ratings', () => {
    let career = createCareer({
      managerName: 'T',
      nationId: 'ENG',
      style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
      seed: 424242,
    })
    // Walk from week 1 into week 8 (first window match week).
    for (let i = 0; i < 7; i++) career = advanceWeek(career)
    expect(career.week).toBe(8)
    const moved = Object.keys(career.world.ratings).filter(
      (id) => career.world.ratings[id] !== ALL_NATIONS_BY_ID[id]?.nationRating,
    )
    expect(moved.length).toBeGreaterThan(10)
    // The manager's group is busy that week — untouched by background sims.
    for (const id of career.campaign.groupNationIds) {
      expect(career.world.ratings[id]).toBe(ALL_NATIONS_BY_ID[id].nationRating)
    }
  })
})
