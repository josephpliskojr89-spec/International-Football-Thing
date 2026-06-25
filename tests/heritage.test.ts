import { describe, it, expect } from 'vitest'
import { generatePlayer } from '@/engine/playerGen'
import { RNG } from '@/engine/rng'
import { NATIONS_BY_ID } from '@/data/nations'

function secondNationTally(producerId: string, n = 800): Record<string, number> {
  const rng = new RNG(123)
  const nation = NATIONS_BY_ID[producerId]
  const tally: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const p = generatePlayer({ nation, position: 'MF', age: 18, dualNational: true, rng, index: i })
    const second = p.eligibleNations.find((id) => id !== producerId)!
    tally[second] = (tally[second] ?? 0) + 1
  }
  return tally
}

describe('heritage-weighted dual nationality', () => {
  it('USA dual-nationals are most often Mexican- or German-eligible', () => {
    const t = secondNationTally('USA')
    const mex = t['MEX'] ?? 0
    const ger = t['GER'] ?? 0
    // Mexico is the strongest US connection; both should dwarf a random nation.
    expect(mex).toBeGreaterThan(0)
    expect(ger).toBeGreaterThan(0)
    const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0][0]
    expect(['MEX', 'GER']).toContain(top)
  })

  it('France draws heavily from its West/North African connections', () => {
    const t = secondNationTally('FRA')
    const african = (t['SEN'] ?? 0) + (t['MAR'] ?? 0) + (t['ALG'] ?? 0) + (t['MLI'] ?? 0) + (t['CIV'] ?? 0) + (t['CMR'] ?? 0) + (t['TUN'] ?? 0)
    // these connections should be the clear majority of France's dual-nationals
    expect(african).toBeGreaterThan(800 * 0.5)
  })

  it('still allows out-of-pattern surprises (flavor randomness)', () => {
    const t = secondNationTally('MEX') // MEX heritage is basically just USA
    const distinct = Object.keys(t).length
    expect(distinct).toBeGreaterThan(1) // not 100% USA — flavor randomness leaks others
  })
})
