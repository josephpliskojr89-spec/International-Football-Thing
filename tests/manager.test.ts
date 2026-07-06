import { describe, it, expect } from 'vitest'
import { cycleObjective, objectiveMet, sackOffers, reputationLabel, clampRep } from '@/engine/manager'
import { initWorld, ratingOf } from '@/engine/world'
import { createCareer } from '@/engine/career'
import type { Career } from '@/engine/types'

function mk(nationId = 'ENG'): Career {
  return createCareer({ managerName: 'T', nationId, style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed: 42 })
}

describe('the manager career', () => {
  it('objectives scale with world rank', () => {
    const w = initWorld()
    expect(cycleObjective(w, 'BRA').tier).toBe(3) // world #1
    expect(cycleObjective(w, 'NZL').tier).toBe(0) // minnow
  })

  it('objective verdicts read the WC outcome and campaign position', () => {
    const c = mk('ENG')
    const tier3 = { ...c, objective: { text: '', tier: 3 } }
    expect(objectiveMet({ ...tier3, lastWcOutcome: 'SEMI' })).toBe(true)
    expect(objectiveMet({ ...tier3, lastWcOutcome: 'QUARTER' })).toBe(false)
    const tier1 = { ...c, objective: { text: '', tier: 1 } }
    expect(objectiveMet({ ...tier1, lastWcOutcome: 'MISSED' })).toBe(false)
    expect(objectiveMet({ ...tier1, lastWcOutcome: 'R16' })).toBe(true)
    const tier0 = { ...c, objective: { text: '', tier: 0 } }
    expect(objectiveMet({ ...tier0, lastWcOutcome: null, lastCampaignPosition: 3 })).toBe(true)
    expect(objectiveMet({ ...tier0, lastWcOutcome: null, lastCampaignPosition: 6 })).toBe(false)
  })

  it('sack offers are weaker nations, at least two doors open', () => {
    const c = mk('BRA')
    const offers = sackOffers(c, 42)
    expect(offers.length).toBeGreaterThanOrEqual(2)
    for (const id of offers) {
      expect(id).not.toBe('BRA')
      expect(ratingOf(c.world, id)).toBeLessThan(ratingOf(c.world, 'BRA'))
    }
  })

  it('reputation labels and clamping behave', () => {
    expect(reputationLabel(85)).toBe('Legendary')
    expect(reputationLabel(10)).toBe('On the brink')
    expect(clampRep(140)).toBe(100)
    expect(clampRep(-5)).toBe(0)
  })

  it('a new career opens with a board objective', () => {
    const c = mk('ENG')
    expect(c.objective).not.toBeNull()
    expect(c.reputation).toBe(40)
  })
})
