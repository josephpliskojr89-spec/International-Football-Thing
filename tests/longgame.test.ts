import { describe, it, expect } from 'vitest'
import { createCareer } from '@/engine/career'
import { advanceWeek } from '@/engine/calendar'
import { currentMatch, friendlyFixture, isSquadLocked } from '@/engine/fixtures'
import { qualifiersActiveInYear, displayYear } from '@/data/windows'
import { createTournament, decide, pickWorldCupHost } from '@/engine/tournament'
import { worldPlayerOfTheYear } from '@/engine/awards'
import { initWorld, seasonTick } from '@/engine/world'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import type { Career } from '@/engine/types'

function mkCareer(nationId = 'ENG', seed = 777): Career {
  return createCareer({
    managerName: 'T',
    nationId,
    style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
    seed,
  })
}

describe('the 4-year cycle', () => {
  it('year 1 and 4 windows are friendlies; years 2-3 are qualifiers', () => {
    expect(qualifiersActiveInYear(1)).toBe(false)
    expect(qualifiersActiveInYear(2)).toBe(true)
    expect(qualifiersActiveInYear(3)).toBe(true)
    expect(qualifiersActiveInYear(4)).toBe(false)
    const c = mkCareer()
    const cm = currentMatch({ ...c, week: 8 })
    expect(cm?.type).toBe('FRIENDLY')
    const cm2 = currentMatch({ ...c, year: 2, week: 8 })
    expect(cm2?.type).toBe('QUALIFIER')
  })

  it('friendly opponents are deterministic and never yourself', () => {
    const c = mkCareer('BRA')
    const a = friendlyFixture(c, 'spring', 1)
    const b = friendlyFixture(c, 'spring', 1)
    expect(a).toEqual(b)
    expect(a.opponentId).not.toBe('BRA')
    expect(a.competitive).toBe(false)
  })

  it('a fresh qualifying campaign is drawn as year 2 opens', () => {
    let c = mkCareer('ENG', 31)
    const firstCycle = c.campaign.cycle
    // Walk from year 1 week 1 to year 2 week 1 (52 advances).
    for (let i = 0; i < 52; i++) c = advanceWeek({ ...c, tournament: null, playedFixtures: dontPlay(c) })
    expect(c.year).toBe(2)
    expect(c.campaign.cycle).toBe(firstCycle + 1)
    expect(c.campaign.matchdayIndex).toBe(0)
  })
})

// Mark every window as already played so advanceWeek never blocks on a match.
function dontPlay(c: Career): string[] {
  return [
    ...new Set([
      ...c.playedFixtures,
      ...['late-winter', 'spring', 'early-autumn', 'october', 'november'].map((id) => `${c.season}:${id}`),
    ]),
  ]
}

describe('squad lock fairness', () => {
  it('does not lock the squad when the manager is not in the finals', () => {
    const c = mkCareer('ENG')
    const t = createTournament('WORLD_CUP', 'ENG', 1, 4, false, c.world)
    expect(t.inField).toBe(false)
    const watching: Career = { ...c, year: 4, week: 28, tournament: t }
    expect(isSquadLocked(watching)).toBe(false)
  })

  it('locks while alive in the finals, unlocks after elimination', () => {
    const c = mkCareer('ENG')
    const t = createTournament('CONTINENTAL', 'ENG', 1, 1, true, c.world)
    expect(isSquadLocked({ ...c, year: 1, week: 28, tournament: t })).toBe(true)
    expect(isSquadLocked({ ...c, year: 1, week: 28, tournament: { ...t, eliminated: true } })).toBe(false)
  })
})

describe('hosts & shootouts', () => {
  it('the World Cup host is force-included and recorded on the tournament', () => {
    const w = initWorld()
    const t = createTournament('WORLD_CUP', 'ENG', 5, 4, true, w, 'NZL')
    expect(t.field).toContain('NZL') // rating 64 would never make top 16 on merit
    expect(t.hostId).toBe('NZL')
  })

  it('host selection avoids back-to-back and is deterministic', () => {
    const h1 = pickWorldCupHost('ENG', 42, 2, null)
    const h2 = pickWorldCupHost('ENG', 42, 2, null)
    expect(h1).toBe(h2)
    const h3 = pickWorldCupHost('ENG', 42, 3, h1)
    expect(h3).not.toBe(h1)
    expect(ALL_NATIONS_BY_ID[h1].isPlayable).toBe(true)
  })

  it('penalty deciders produce a plausible shootout score', () => {
    const r = decide('ENG', 'FRA', 1, 1, 84, 87, 909)
    expect(r.pens).toBe(true)
    const winPens = r.winnerId === 'ENG' ? r.pensA! : r.pensB!
    const losePens = r.winnerId === 'ENG' ? r.pensB! : r.pensA!
    expect(winPens).toBeGreaterThan(losePens)
    expect(winPens).toBeGreaterThanOrEqual(3)
    expect(winPens).toBeLessThanOrEqual(7)
  })

  it('world cup names carry the year', () => {
    const t = createTournament('WORLD_CUP', 'ENG', 5, 4, true)
    expect(t.name).toBe(`World Cup ${displayYear(4)}`)
  })
})

describe('eras (development trends)', () => {
  it('trends stay bounded and shift where nations settle', () => {
    let w = initWorld()
    for (let s = 1; s <= 30; s++) w = seasonTick(w, 99, s).world
    const trends = Object.values(w.trends)
    expect(trends.length).toBeGreaterThan(20)
    for (const t of trends) expect(Math.abs(t)).toBeLessThanOrEqual(7)
    // Somebody, somewhere, is having an era.
    expect(trends.some((t) => Math.abs(t) > 2)).toBe(true)
  })
})

describe('awards', () => {
  it('world player of the year is deterministic and belongs to a real nation', () => {
    const c = mkCareer('ENG', 12)
    const a = worldPlayerOfTheYear(c, 1)
    const b = worldPlayerOfTheYear(c, 1)
    expect(a).toEqual(b)
    expect(ALL_NATIONS_BY_ID[a.nationId]).toBeDefined()
    expect(a.name.length).toBeGreaterThan(1)
  })
})

describe('the rival-nation clock', () => {
  it('a neglected dual national can be lost — and is pulled from the squad', () => {
    let c = mkCareer('USA', 5150)
    // Force a dire situation: one dual national, rival lean nearly decisive.
    c = {
      ...c,
      players: c.players.map((p) =>
        p.eligibleNations.length > 1 && p.eligibilityState === 'ELIGIBLE'
          ? { ...p, leans: { ...p.leans, [p.eligibleNations.find((n) => n !== 'USA')!]: 95, USA: 10 }, potential: 90 }
          : p,
      ),
    }
    let lost = 0
    for (let i = 0; i < 80 && lost === 0; i++) {
      c = advanceWeek({ ...c, tournament: null, playedFixtures: dontPlay(c) })
      lost = c.players.filter((p) => p.eligibilityState === 'LOST').length
    }
    expect(lost).toBeGreaterThan(0)
    const lostPlayer = c.players.find((p) => p.eligibilityState === 'LOST')!
    expect(c.registeredSquad).not.toContain(lostPlayer.id)
    expect(lostPlayer.tiedNation).not.toBe('USA')
  })
})

describe('injuries have consequences', () => {
  it('injured players heal week by week', () => {
    let c = mkCareer('ENG', 33)
    c = { ...c, players: c.players.map((p, i) => (i === 0 ? { ...p, injuredWeeks: 3 } : p)) }
    const id = c.players[0].id
    c = advanceWeek({ ...c, tournament: null, playedFixtures: dontPlay(c) })
    expect(c.players.find((p) => p.id === id)!.injuredWeeks).toBe(2)
  })
})
