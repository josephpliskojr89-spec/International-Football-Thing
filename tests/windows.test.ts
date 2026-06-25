import { describe, it, expect } from 'vitest'
import { WINDOWS, upcomingWindow, windowAtWeek, isRegistrationClosed, fixtureKey } from '@/data/windows'
import { createCareer } from '@/engine/career'
import { fixtureFor, squadValidity, SQUAD_SIZE } from '@/engine/fixtures'

describe('international calendar', () => {
  it('finds the upcoming window and weeks away', () => {
    const u = upcomingWindow(1)
    expect(u.window.id).toBe(WINDOWS[0].id)
    expect(u.weeksAway).toBe(WINDOWS[0].matchWeek - 1)
  })

  it('wraps to next year after the last window', () => {
    const last = WINDOWS[WINDOWS.length - 1]
    const u = upcomingWindow(last.matchWeek + 1)
    expect(u.nextYear).toBe(true)
    expect(u.window.id).toBe(WINDOWS[0].id)
  })

  it('identifies a match week', () => {
    expect(windowAtWeek(WINDOWS[0].matchWeek)?.id).toBe(WINDOWS[0].id)
    expect(windowAtWeek(WINDOWS[0].matchWeek - 3)).toBeNull()
  })

  it('closes registration from the deadline week through the match week', () => {
    const w = WINDOWS[0]
    expect(isRegistrationClosed(w.deadlineWeek - 1)).toBe(false)
    expect(isRegistrationClosed(w.deadlineWeek)).toBe(true)
    expect(isRegistrationClosed(w.matchWeek)).toBe(true)
    expect(isRegistrationClosed(w.matchWeek + 1)).toBe(false)
  })
})

describe('fixtures & squad', () => {
  function career(nationId: string) {
    return createCareer({
      managerName: 'T',
      nationId,
      style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
      seed: 50,
    })
  }

  it('a new career registers a full, valid 26-man squad', () => {
    const c = career('ENG')
    expect(c.registeredSquad.length).toBe(SQUAD_SIZE)
    const v = squadValidity(c.players, c.registeredSquad)
    expect(v.valid).toBe(true)
  })

  it('fixtures are deterministic per season+window', () => {
    const c = career('BRA')
    const a = fixtureFor(c, WINDOWS[0], 1)
    const b = fixtureFor(c, WINDOWS[0], 1)
    expect(a.opponentId).toBe(b.opponentId)
    expect(a.home).toBe(b.home)
    expect(a.opponentId).not.toBe('BRA')
  })

  it('squad validity flags an undersized goalkeeper count', () => {
    const c = career('USA')
    const noKeepers = c.players.filter((p) => p.position !== 'GK').slice(0, 26).map((p) => p.id)
    const v = squadValidity(c.players, noKeepers)
    expect(v.valid).toBe(false)
    expect(v.reasons.join(' ')).toMatch(/goalkeeper/i)
  })

  it('fixtureKey is stable', () => {
    expect(fixtureKey(2, 'spring')).toBe('2:spring')
  })
})
