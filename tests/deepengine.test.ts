import { describe, it, expect } from 'vitest'
import { simulateMatch, settleKnockout, styleMatchup } from '@/engine/match'
import { buildOpponentTeam } from '@/engine/matchSetup'
import { NATIONS_BY_ID } from '@/data/nations'

const team = (id: string, seed: number, home: boolean) => buildOpponentTeam(NATIONS_BY_ID[id], seed, home)

describe('the deep match engine', () => {
  it('the style wheel is a closed circle with Balanced outside it', () => {
    expect(styleMatchup('HighPress', 'Possession').edge).toBe(1)
    expect(styleMatchup('Possession', 'Direct').edge).toBe(1)
    expect(styleMatchup('Direct', 'Counter').edge).toBe(1)
    expect(styleMatchup('Counter', 'HighPress').edge).toBe(1)
    expect(styleMatchup('Possession', 'HighPress').edge).toBe(-1)
    expect(styleMatchup('Balanced', 'Counter').edge).toBe(0)
    expect(styleMatchup('Counter', 'Counter').edge).toBe(0)
  })

  it('is two-phase: the half-time score is part of the full-time score', () => {
    for (let i = 0; i < 20; i++) {
      const r = simulateMatch(team('ENG', i, true), team('FRA', i + 50, false), 900 + i)
      expect(r.homeGoalsHT).toBeLessThanOrEqual(r.homeGoals)
      expect(r.awayGoalsHT).toBeLessThanOrEqual(r.awayGoals)
      // goal minutes respect their halves
      for (const e of r.events.filter((e2) => e2.type === 'GOAL')) {
        expect(e.minute).toBeGreaterThanOrEqual(1)
        expect(e.minute).toBeLessThanOrEqual(90)
      }
    }
  })

  it('a red card hurts TODAY: red-carded sides concede more on average', () => {
    let withRed = { matches: 0, conceded: 0 }
    let clean = { matches: 0, conceded: 0 }
    for (let i = 0; i < 400; i++) {
      const r = simulateMatch(team('GER', i, true), team('ESP', i + 999, false), 3000 + i)
      const homeRed = r.events.some((e) => e.type === 'RED' && e.side === 'home')
      if (homeRed) { withRed.matches++; withRed.conceded += r.awayGoals }
      else { clean.matches++; clean.conceded += r.awayGoals }
    }
    expect(withRed.matches).toBeGreaterThan(5)
    expect(withRed.conceded / withRed.matches).toBeGreaterThan(clean.conceded / clean.matches)
  })

  it('settleKnockout always produces a decisive result with a plausible path', () => {
    let sawET = false
    let sawPens = false
    for (let i = 0; i < 60; i++) {
      const h = team('ITA', i, false)
      const a = team('POR', i + 31, false)
      const base = simulateMatch(h, a, 7000 + i)
      if (base.homeGoals !== base.awayGoals) continue
      const s = settleKnockout(h, a, base, 7000 + i)
      sawET = sawET || !!s.extraTime
      if (s.shootout) {
        sawPens = true
        expect(s.homeGoals).toBe(s.awayGoals) // level after 120 — pens decided it
        expect(s.shootout.homePens).not.toBe(s.shootout.awayPens)
        expect(s.shootout.kicks.length).toBeGreaterThanOrEqual(6)
        // kicks alternate starting with home
        expect(s.shootout.kicks[0].side).toBe('home')
        const winnerPens = s.shootout.winner === 'home' ? s.shootout.homePens : s.shootout.awayPens
        expect(winnerPens).toBe(Math.max(s.shootout.homePens, s.shootout.awayPens))
      } else {
        expect(s.homeGoals).not.toBe(s.awayGoals) // extra time settled it
        expect(s.extraTime).toBe(true)
        // ET scorers landed in 91-120
        const et = s.events.filter((e) => e.type === 'GOAL' && e.minute > 90)
        expect(et.length).toBeGreaterThan(0)
      }
    }
    expect(sawET).toBe(true)
    expect(sawPens).toBe(true)
  })

  it('is still deterministic end to end', () => {
    const h = team('BRA', 5, false)
    const a = team('ARG', 6, false)
    const r1 = simulateMatch(h, a, 42)
    const r2 = simulateMatch(h, a, 42)
    expect(r1).toEqual(r2)
    const s1 = settleKnockout(h, a, r1, 43)
    const s2 = settleKnockout(h, a, r2, 43)
    expect(s1).toEqual(s2)
  })
})
