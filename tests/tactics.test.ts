import { describe, it, expect } from 'vitest'
import { createCareer } from '@/engine/career'
import { simulateMatch } from '@/engine/match'
import { buildManagerTeam, buildOpponentTeam } from '@/engine/matchSetup'
import { NATIONS_BY_ID } from '@/data/nations'

function setup() {
  const c = createCareer({
    managerName: 'T', nationId: 'FRA',
    style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed: 9,
  })
  const xiIds = Object.values(c.lineup).filter(Boolean) as string[]
  const fwd = c.players
    .filter((p) => xiIds.includes(p.id) && p.position === 'FW')
    .sort((a, b) => b.overall - a.overall)[0]
  return { c, fwd }
}

function focalShare(career: any, focalId: string | null, fwdName: string, n = 500): number {
  const cc = { ...career, tactics: { ...career.tactics, focalPointId: focalId } }
  const home = buildManagerTeam(cc, true)
  const away = buildOpponentTeam(NATIONS_BY_ID['ITA'], career.seed, false)
  let total = 0
  let focal = 0
  for (let i = 0; i < n; i++) {
    const r = simulateMatch(home, away, 3000 + i)
    for (const s of r.scorersHome) {
      total++
      if (s.name === fwdName) focal++
    }
  }
  return total ? focal / total : 0
}

describe('focal point tactic', () => {
  it('concentrates scoring through the chosen player', () => {
    const { c, fwd } = setup()
    const without = focalShare(c, null, fwd.name)
    const withFocal = focalShare(c, fwd.id, fwd.name)
    expect(withFocal).toBeGreaterThan(without + 0.1) // clearly more of the goals
  })

  it('new careers default to no focal point and a sensible style', () => {
    const { c } = setup()
    expect(c.tactics.focalPointId).toBeNull()
    expect(c.tactics.style).toBe('Balanced')
  })
})
