import { describe, it, expect } from 'vitest'
import { ghostTimeline, worldCupDivergence } from '@/engine/counterfactual'
import { createCareer } from '@/engine/career'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { playoffFixture } from '@/engine/fixtures'
import { nationalManagerName } from '@/engine/manager'
import { NATIONS_BY_ID } from '@/data/nations'

function mk(nationId = 'ENG', seed = 4242) {
  return createCareer({ managerName: 'T', nationId, style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed })
}

describe('the road not taken (counterfactual engine)', () => {
  it('is fully deterministic and crowns plausible ghost champions', () => {
    const a = ghostTimeline(777, 12)
    const b = ghostTimeline(777, 12)
    expect(a).toEqual(b)
    const wcs = a.filter((g) => g.wcChampion)
    expect(wcs.length).toBe(3) // seasons 4, 8, 12
    for (const g of wcs) {
      const champ = ALL_NATIONS_BY_ID[g.wcChampion!]
      expect(champ).toBeDefined()
      expect(champ.nationRating).toBeGreaterThan(70) // no San Marino miracles
    }
    // continental champions crowned in every year-1 season
    expect(a[0].continentalChampions!.length).toBeGreaterThanOrEqual(4)
  })

  it('divergence report aligns ghost WCs with the almanac', () => {
    const c = mk('ENG', 99)
    // Fake a played WC in the real timeline.
    c.history.push({ season: 4, type: 'WORLD_CUP', text: 'x', nationId: 'ENG', managerMoment: true })
    const withHistory = { ...c, season: 5 }
    const rows = worldCupDivergence(withHistory)
    expect(rows.length).toBe(1)
    expect(rows[0].yours).toBe('ENG')
    expect(rows[0].isYou).toBe(true)
    expect(ALL_NATIONS_BY_ID[rows[0].ghost!]).toBeDefined()
  })
})

describe('intercontinental playoff & rival dugouts', () => {
  it('playoff opponent is from another confederation, deterministic', () => {
    const c = mk('USA', 31)
    const a = playoffFixture(c)
    const b = playoffFixture(c)
    expect(a).toEqual(b)
    expect(ALL_NATIONS_BY_ID[a.opponentId].confederation).not.toBe(NATIONS_BY_ID['USA'].confederation)
    expect(a.competitive).toBe(true)
  })

  it('rival managers persist within a tenure and eventually change', () => {
    const n1 = nationalManagerName('BRA', 1, 555)
    const n2 = nationalManagerName('BRA', 2, 555)
    expect(n1).toBe(n2) // same tenure, same face
    const names = new Set<string>()
    for (let s = 1; s <= 30; s++) names.add(nationalManagerName('BRA', s, 555))
    expect(names.size).toBeGreaterThanOrEqual(3) // turnover across decades
    expect(names.size).toBeLessThanOrEqual(10) // but tenures, not churn
  })
})
