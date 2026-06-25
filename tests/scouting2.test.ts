import { describe, it, expect } from 'vitest'
import { createCareer } from '@/engine/career'
import { topRatedIds } from '@/ui/display'
import { targetedLook } from '@/engine/scouting'

function career() {
  return createCareer({
    managerName: 'T', nationId: 'FRA',
    style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed: 77,
  })
}

describe('top-rated stars', () => {
  it('returns the N best of a given id set by scouted rating', () => {
    const c = career()
    const top = topRatedIds(c.players, c.registeredSquad, 3)
    expect(top.size).toBe(3)
    const ranked = [...c.registeredSquad]
      .map((id) => c.players.find((p) => p.id === id)!)
      .sort((a, b) => b.knownOverall - a.knownOverall)
    expect(top.has(ranked[0].id)).toBe(true)
    expect(top.has(ranked[2].id)).toBe(true)
  })
})

describe('targeted look (send a scout)', () => {
  it('tightens the read toward exact without making it fully exact', () => {
    const c = career()
    const fuzzy = { ...c.players[0], freshness: 20 }
    const looked = targetedLook(fuzzy)
    expect(looked.freshness).toBeGreaterThan(fuzzy.freshness)
    expect(looked.freshness).toBeLessThan(100)
    expect(looked.knownOverall).toBe(fuzzy.overall)
  })
})
