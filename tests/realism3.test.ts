import { describe, it, expect } from 'vitest'
import { clubArc, arcOutcome, arcFormDrift } from '@/engine/clubs'
import { matchStory } from '@/engine/matchStory'
import { createCareer } from '@/engine/career'
import { advanceWeek } from '@/engine/calendar'
import type { Career } from '@/engine/types'
import type { MatchResult } from '@/engine/match'

function mk(seed: number): Career {
  return createCareer({ managerName: 'T', nationId: 'ENG', style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed })
}
function walk(c: Career, n: number): Career {
  for (let i = 0; i < n; i++) {
    c = advanceWeek({ ...c, playedFixtures: [...new Set([...c.playedFixtures, ...['late-winter','spring','early-autumn','october','november'].map((id) => `${c.season}:${id}`)])], tournament: null })
  }
  return c
}

describe('club season arcs', () => {
  it('are deterministic, season-scoped, and outcomes follow the arc', () => {
    expect(clubArc('Mersey Rovers', 3, 42)).toBe(clubArc('Mersey Rovers', 3, 42))
    // arcs vary across seasons for the same club (some seed will differ within 6 seasons)
    const arcs = new Set([1, 2, 3, 4, 5, 6].map((s) => clubArc('Mersey Rovers', s, 42)))
    expect(arcs.size).toBeGreaterThan(1)
    // outcome only ever crowns title-racers / relegates dogfighters
    for (let s2 = 1; s2 <= 20; s2++) {
      const o = arcOutcome('Bavaria München', s2, 7)
      if (o === 'CHAMPIONS') expect(clubArc('Bavaria München', s2, 7)).toBe('TITLE')
      if (o === 'RELEGATED') expect(clubArc('Bavaria München', s2, 7)).toBe('RELEGATION')
    }
    expect(arcFormDrift('TITLE')).toBeGreaterThan(0)
    expect(arcFormDrift('RELEGATION')).toBeLessThan(0)
  })
})

describe('one last dance', () => {
  it('an announced veteran retires at the season end, guaranteed', () => {
    let c = mk(9)
    // Plant an announced 30-year-old (would never retire by age roll alone).
    const vetId = c.players[0].id
    c = { ...c, players: c.players.map((p) => (p.id === vetId ? { ...p, age: 30, caps: 60, announcedRetirement: true } : p)) }
    c = { ...c, week: 51 }
    c = walk(c, 2) // roll the season
    expect(c.season).toBe(2)
    expect(c.players.find((p) => p.id === vetId)).toBeUndefined() // gone, as promised
  })

  it('farewell announcements appear at season start for squad veterans', () => {
    let announced = false
    for (const seed of [3, 6, 9, 12]) {
      let c = mk(seed)
      c = { ...c, players: c.players.map((p, i) => (i < 5 ? { ...p, age: 34, caps: 70 } : p)) }
      c = { ...c, week: 51 }
      c = walk(c, 2)
      if (c.news.some((n) => n.type === 'FAREWELL')) { announced = true; break }
    }
    expect(announced).toBe(true)
  })
})

describe('weather in the story', () => {
  it('a winter week can open with weather; the story stays deterministic', () => {
    const r: MatchResult = {
      homeName: 'England', awayName: 'France', homeGoals: 2, awayGoals: 0,
      xgHome: 1.8, xgAway: 0.6, possessionHome: 55,
      events: [{ minute: 20, type: 'GOAL', side: 'home', playerId: 'x', playerName: 'A' }, { minute: 70, type: 'GOAL', side: 'home', playerId: 'y', playerName: 'B' }],
      scorersHome: [], scorersAway: [], motm: null, ratingsHome: [], ratingsAway: [],
    } as unknown as MatchResult
    expect(matchStory(r, true, 45)).toBe(matchStory(r, true, 45))
    // across many result keys, winter weeks sometimes set the scene
    let sawWeather = false
    for (let g = 0; g <= 8; g++) {
      const rr = { ...r, xgHome: 1 + g * 0.1 }
      if (/freezing|frost|winter rain/i.test(matchStory(rr, true, 45))) { sawWeather = true; break }
    }
    expect(sawWeather).toBe(true)
  })
})
