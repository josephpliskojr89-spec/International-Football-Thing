import { describe, it, expect } from 'vitest'
import { RNG } from '@/engine/rng'
import { drawPotential, generatePlayer, overallForRaw } from '@/engine/playerGen'
import { developPlayerWeek, agePlayerOneYear } from '@/engine/development'
import { generateYouthIntake } from '@/engine/youth'
import { applyCoverageWeek, targetedLook } from '@/engine/scouting'
import { createCareer } from '@/engine/career'
import { NATIONS_BY_ID } from '@/data/nations'
import type { Player } from '@/engine/types'

describe('potential distribution', () => {
  it('is right-skewed: most ordinary, gems rare', () => {
    const rng = new RNG(1)
    let elite = 0
    const N = 5000
    for (let i = 0; i < N; i++) {
      if (drawPotential(rng, 80, 80) >= 88) elite++
    }
    const eliteRate = elite / N
    expect(eliteRate).toBeGreaterThan(0) // gems exist
    expect(eliteRate).toBeLessThan(0.15) // but are rare
  })

  it('a youth powerhouse out-produces a minnow at the top end', () => {
    const big = new RNG(2)
    const small = new RNG(2)
    let bigElite = 0
    let smallElite = 0
    for (let i = 0; i < 3000; i++) {
      if (drawPotential(big, 90, 90) >= 85) bigElite++
      if (drawPotential(small, 60, 62) >= 85) smallElite++
    }
    expect(bigElite).toBeGreaterThan(smallElite * 2)
  })
})

describe('development engine', () => {
  function youngProspect(): Player {
    const rng = new RNG(42)
    return generatePlayer({
      nation: NATIONS_BY_ID['FRA'],
      position: 'MF',
      age: 17,
      rng,
      index: 1,
      goldenSeed: true, // ensures a high ceiling to test growth
    })
  }

  it('a young player with playing time grows toward potential', () => {
    let p = { ...youngProspect(), playingTime: 0.9 }
    const start = p.overall
    const rng = new RNG(7)
    for (let s = 0; s < 4; s++) {
      for (let w = 0; w < 52; w++) p = developPlayerWeek(p, rng)
      p = agePlayerOneYear(p)
    }
    expect(p.overall).toBeGreaterThan(start + 5)
    expect(p.overall).toBeLessThanOrEqual(p.potential + 1)
  })

  it('a benched player of the same talent grows much less', () => {
    const rng = new RNG(7)
    let played = { ...youngProspect(), playingTime: 0.9 }
    let benched = { ...youngProspect(), playingTime: 0.1 }
    for (let w = 0; w < 52; w++) {
      played = developPlayerWeek(played, rng)
      benched = developPlayerWeek(benched, rng)
    }
    expect(played.overall).toBeGreaterThan(benched.overall)
  })

  it('a veteran past peak declines', () => {
    const rng = new RNG(3)
    let p = generatePlayer({
      nation: NATIONS_BY_ID['ITA'],
      position: 'FW',
      age: 34,
      seniorTargetOverall: 82,
      rng,
      index: 1,
    })
    const start = p.overall
    for (let w = 0; w < 52; w++) p = developPlayerWeek(p, rng)
    expect(p.overall).toBeLessThan(start)
  })
})

describe('youth intake', () => {
  it('major producers generate larger classes than minnows', () => {
    const big = generateYouthIntake(NATIONS_BY_ID['BRA'], 2, 100)
    const small = generateYouthIntake(NATIONS_BY_ID['NZL'], 2, 100)
    expect(big.players.length).toBeGreaterThanOrEqual(small.players.length)
    for (const p of big.players) {
      expect(p.age).toBeGreaterThanOrEqual(16)
      expect(p.age).toBeLessThanOrEqual(18)
    }
  })
})

describe('scouting coverage', () => {
  it('covered players sharpen and sync; uncovered drift', () => {
    const career = createCareer({
      managerName: 'T',
      nationId: 'GER',
      style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
      seed: 11,
    })
    const league = career.players[0].clubLeague
    const coaches = [{ id: 'c0', name: 'X', leagueAssignment: league, targetedLookUsed: false }]

    const before = career.players.map((p) => p.freshness)
    const after = applyCoverageWeek(career.players, coaches)
    after.forEach((p, i) => {
      if (p.clubLeague === league) {
        expect(p.freshness).toBeGreaterThanOrEqual(before[i])
        expect(p.knownOverall).toBe(p.overall) // read synced to real
      }
    })
  })

  it('a targeted look syncs the read to the real value', () => {
    const career = createCareer({
      managerName: 'T',
      nationId: 'USA',
      style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
      seed: 12,
    })
    const fuzzy = { ...career.players[0], freshness: 5, knownOverall: 1, knownPotential: 0 }
    const looked = targetedLook(fuzzy)
    expect(looked.knownOverall).toBe(fuzzy.overall)
    expect(looked.knownPotential).toBe(fuzzy.potential)
    expect(looked.freshness).toBe(100)
  })
})

describe('overallForRaw matches overallFor pre-round', () => {
  it('rounds consistently', () => {
    const rng = new RNG(5)
    const p = generatePlayer({ nation: NATIONS_BY_ID['ESP'], position: 'DF', age: 25, seniorTargetOverall: 80, rng, index: 1 })
    expect(Math.round(overallForRaw(p.position, p.ratings))).toBe(p.overall)
  })
})
