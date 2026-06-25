import { describe, it, expect } from 'vitest'
import { createCampaign, managerFixture, resolveMatchday, GROUP_SIZE, QUALIFY_COUNT } from '@/engine/campaign'
import { simulateLite } from '@/engine/matchLite'

function playFullCampaign(nationId: string, seed: number) {
  let camp = createCampaign(nationId, seed, 1)
  let guard = 0
  while (!camp.complete && guard++ < 50) {
    const mf = managerFixture(camp, nationId)!
    const lite = simulateLite(75, 70, mf.home, seed + camp.matchdayIndex)
    const managerResult = {
      homeId: mf.home ? nationId : mf.opponentId,
      awayId: mf.home ? mf.opponentId : nationId,
      hg: lite.goalsA,
      ag: lite.goalsB,
    }
    camp = resolveMatchday(camp, managerResult, nationId, seed)
  }
  return camp
}

describe('qualifying campaign', () => {
  it('builds a full group around the manager nation', () => {
    const c = createCampaign('ENG', 7, 1)
    expect(c.groupNationIds.length).toBe(GROUP_SIZE)
    expect(c.groupNationIds).toContain('ENG')
    expect(new Set(c.groupNationIds).size).toBe(GROUP_SIZE) // no dupes
  })

  it('schedules a double round-robin (each team plays every other twice)', () => {
    const c = createCampaign('JPN', 3, 1)
    // matchdays = 2*(n-1); each matchday has n/2 fixtures
    expect(c.matchdays.length).toBe(2 * (GROUP_SIZE - 1))
    for (const md of c.matchdays) expect(md.length).toBe(GROUP_SIZE / 2)
  })

  it('runs to completion with a full table and exactly QUALIFY_COUNT qualifiers', () => {
    const camp = playFullCampaign('BRA', 99)
    expect(camp.complete).toBe(true)
    expect(camp.qualifiedIds.length).toBe(QUALIFY_COUNT)
    // every team played (n-1)*2 matches
    for (const s of camp.standings) expect(s.p).toBe(2 * (GROUP_SIZE - 1))
    // standings sorted by points desc
    for (let i = 1; i < camp.standings.length; i++) {
      expect(camp.standings[i - 1].pts).toBeGreaterThanOrEqual(camp.standings[i].pts)
    }
    // points add up: 3*wins + draws across the table is internally consistent
    for (const s of camp.standings) expect(s.pts).toBe(s.w * 3 + s.d)
  })

  it('a tiny confederation (OFU) still fills a full group', () => {
    const c = createCampaign('NZL', 5, 1)
    expect(c.groupNationIds.length).toBe(GROUP_SIZE)
    expect(c.groupNationIds).toContain('NZL')
  })
})
