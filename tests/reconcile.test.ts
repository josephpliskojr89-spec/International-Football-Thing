import { describe, it, expect } from 'vitest'
import { createCareer } from '@/engine/career'
import { advanceWeek } from '@/engine/calendar'

describe('season rollover reconciliation', () => {
  it('never leaves retired player ids in the squad/lineup/bench/focal point', () => {
    let c = createCareer({
      managerName: 'T', nationId: 'ITA',
      style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' }, seed: 42,
    })
    // Force several squad members to retirement age and pin one into the XI + focal.
    const xiIds = Object.values(c.lineup).filter(Boolean) as string[]
    const oldId = xiIds[5]
    c = {
      ...c,
      players: c.players.map((p) => (c.registeredSquad.includes(p.id) ? { ...p, age: 40 } : p)),
      tactics: { ...c.tactics, focalPointId: oldId },
      week: 52,
    }
    const next = advanceWeek(c) // triggers the season rollover + retirements
    const valid = new Set(next.players.map((p) => p.id))

    for (const id of next.registeredSquad) expect(valid.has(id)).toBe(true)
    for (const id of next.bench) expect(valid.has(id)).toBe(true)
    for (const id of Object.values(next.lineup).filter(Boolean) as string[]) expect(valid.has(id)).toBe(true)
    if (next.tactics.focalPointId) expect(valid.has(next.tactics.focalPointId)).toBe(true)
    // the XI should still be full (refilled from survivors, not left with holes)
    const filled = Object.values(next.lineup).filter(Boolean).length
    expect(filled).toBe(Object.keys(next.lineup).length)
  })
})
