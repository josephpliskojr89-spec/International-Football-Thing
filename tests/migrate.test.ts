import { describe, it, expect } from 'vitest'
import { migrateCareer } from '@/engine/migrate'
import { FORMATIONS_BY_ID } from '@/data/formations'

// A Milestone-1-era save: no season/bench, players lack the scouting/known and
// in-person fields. Loading this unmigrated crashed the Squad screen.
const OLD_SAVE = {
  seed: 123,
  saveVersion: 1,
  managerName: 'Old',
  managerNationId: 'BRA',
  style: { formation: '4-3-3', approach: 'Balanced', preference: 'Balanced' },
  year: 1,
  week: 5,
  players: [
    {
      id: 'p1', name: 'Old Player', nationality: 'BRA', position: 'FW', age: 25,
      club: 'X', clubLeague: 'Domestic League',
      ratings: { finishing: 70, pace: 70, technique: 70, passing: 70, physical: 70, mental: 70, defending: 40, goalkeeping: 20 },
      form: 60, overall: 70, potential: 75, injuryRisk: 10, professionalism: 70, consistency: 70,
      eligibleNations: ['BRA'], leans: { BRA: 60 }, eligibilityState: 'ELIGIBLE', tiedNation: null,
    },
  ],
  coaches: [{ id: 'c0', name: 'C', leagueAssignment: null, targetedLookUsed: false }],
  lineup: { ST: 'p1' },
  formation: '4-3-3',
  news: [],
}

describe('save migration', () => {
  it('fills in missing career-level fields', () => {
    const c = migrateCareer(OLD_SAVE)
    expect(c.season).toBe(1)
    expect(c.exhibitionCount).toBe(0)
    expect(Array.isArray(c.bench)).toBe(true)
  })

  it('fills in missing per-player fields so screens never crash', () => {
    const c = migrateCareer(OLD_SAVE)
    const p = c.players[0]
    expect(p.knownOverall).toBe(70)
    expect(p.knownPotential).toBe(0)
    expect(typeof p.freshness).toBe('number')
    expect(p.inPersonOverall).toBeNull()
    expect(p.inPersonWeeks).toBe(0)
    expect(p.playingTime).toBeGreaterThan(0)
  })

  it('is idempotent on an already-current save shape', () => {
    const once = migrateCareer(OLD_SAVE)
    const twice = migrateCareer(once)
    expect(twice.players.length).toBe(once.players.length)
    expect(twice.season).toBe(once.season)
  })

  it('repairs an empty/incomplete lineup so the match engine has an XI', () => {
    const c = migrateCareer({
      ...OLD_SAVE,
      lineup: {}, // empty — would otherwise field nobody
      players: Array.from({ length: 16 }, (_, i) => ({
        id: `pl${i}`, name: `P${i}`, nationality: 'BRA', position: ['GK', 'DF', 'MF', 'FW'][i % 4],
        age: 25, club: 'X', clubLeague: 'Domestic League',
        ratings: { finishing: 60, pace: 60, technique: 60, passing: 60, physical: 60, mental: 60, defending: 60, goalkeeping: 60 },
        form: 60, overall: 65, potential: 70,
      })),
    })
    const filled = Object.values(c.lineup).filter(Boolean)
    expect(filled.length).toBeGreaterThanOrEqual(11)
  })

  it('tolerates a wildly partial object without throwing', () => {
    expect(() => migrateCareer({})).not.toThrow()
    expect(() => migrateCareer({ players: [{}] })).not.toThrow()
    const c = migrateCareer({ formation: '4-4-2' })
    expect(FORMATIONS_BY_ID[c.formation]).toBeTruthy()
  })

  it('deep-defaults an old campaign missing newer fields, keeping its structure', () => {
    const c = migrateCareer({
      ...OLD_SAVE,
      campaign: {
        // pre-cycle-era campaign: no cycle/recentResults/qualifyCount/qualifiedIds
        groupNationIds: ['BRA', 'ARG', 'CHI', 'PER'],
        matchdays: [[], [], []],
        matchdayIndex: 1,
        standings: [{ nationId: 'BRA', p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, pts: 3 }],
      },
    })
    expect(c.campaign.groupNationIds).toContain('ARG') // structure preserved
    expect(c.campaign.matchdayIndex).toBe(1)
    expect(c.campaign.cycle).toBe(1)
    expect(c.campaign.recentResults).toEqual([])
    expect(c.campaign.qualifyCount).toBeGreaterThan(0)
    expect(c.campaign.qualifiedIds).toEqual([])
    expect(c.campaign.complete).toBe(false)
  })

  it('redraws a structurally broken campaign instead of keeping it', () => {
    const c = migrateCareer({ ...OLD_SAVE, campaign: { matchdays: [[]] } }) // no group, no standings
    expect(c.campaign.groupNationIds.length).toBeGreaterThan(0)
    expect(Array.isArray(c.campaign.standings)).toBe(true)
  })

  it('deep-defaults an old knockout-only tournament and drops a broken one', () => {
    const ok = migrateCareer({
      ...OLD_SAVE,
      tournament: {
        kind: 'WORLD_CUP', name: 'World Cup', managerId: 'BRA', inField: true,
        field: ['BRA', 'ARG'], rounds: [[{ aId: 'BRA', bId: 'ARG', aGoals: null, bGoals: null, winnerId: null, pens: false }]],
        roundIndex: 0, champion: null, eliminated: false,
        // no hostId / groups / groupMatchday — pre-group-stage save
      },
    })
    expect(ok.tournament).not.toBeNull()
    expect(ok.tournament!.hostId).toBeNull()
    expect(ok.tournament!.groups).toBeNull() // legacy straight knockout preserved
    expect(ok.tournament!.groupMatchday).toBe(3)
    expect(ok.tournament!.rounds.length).toBe(1)

    const broken = migrateCareer({ ...OLD_SAVE, tournament: { name: 'Ghost Cup' } }) // no field
    expect(broken.tournament).toBeNull()
  })
})
