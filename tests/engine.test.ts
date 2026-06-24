import { describe, it, expect } from 'vitest'
import { RNG, deriveSeed } from '@/engine/rng'
import { generateName } from '@/engine/nameGen'
import { createCareer } from '@/engine/career'
import { advanceWeek } from '@/engine/calendar'
import { FORMATIONS_BY_ID } from '@/data/formations'

describe('RNG', () => {
  it('is deterministic for a given seed', () => {
    const a = new RNG(12345)
    const b = new RNG(12345)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('range and int stay in bounds', () => {
    const r = new RNG(99)
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('deriveSeed is stable', () => {
    expect(deriveSeed(1, 2, 3)).toBe(deriveSeed(1, 2, 3))
  })
})

describe('nameGen', () => {
  it('produces non-empty names for every convention', () => {
    const rng = new RNG(7)
    for (const pool of ['ENGLAND', 'SPAIN', 'BRAZIL', 'JAPAN', 'NETHERLANDS', 'MOROCCO']) {
      const name = generateName(pool, rng)
      expect(name.length).toBeGreaterThan(1)
    }
  })

  it('double-surname pools yield three parts most of the time', () => {
    const rng = new RNG(42)
    let triples = 0
    for (let i = 0; i < 50; i++) {
      if (generateName('SPAIN', rng).split(' ').length >= 3) triples++
    }
    expect(triples).toBeGreaterThan(30)
  })
})

describe('career', () => {
  it('creates a playable career with a filled XI', () => {
    const career = createCareer({
      managerName: 'Test',
      nationId: 'BRA',
      style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
      seed: 1000,
    })
    expect(career.players.length).toBeGreaterThanOrEqual(23)
    const slots = FORMATIONS_BY_ID['4-3-3'].slots
    const filled = slots.filter((s) => career.lineup[s.id])
    expect(filled.length).toBe(slots.length)
    // no player assigned to two slots
    const ids = slots.map((s) => career.lineup[s.id]).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('advanceWeek rolls the calendar and cycles the year at week 52', () => {
    let career = createCareer({
      managerName: 'Test',
      nationId: 'USA',
      style: { formation: '4-4-2', approach: 'Attacking', preference: 'Youth' },
      seed: 5,
    })
    career = { ...career, week: 52, year: 1 }
    const next = advanceWeek(career)
    expect(next.week).toBe(1)
    expect(next.year).toBe(2)
  })
})
