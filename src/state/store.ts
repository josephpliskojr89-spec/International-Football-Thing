import { create } from 'zustand'
import type { Career, NewsItem, Player, PlayStyle } from '@/engine/types'
import { createCareer, autoFillLineup, type NewCareerInput } from '@/engine/career'
import { advanceWeek as advanceWeekEngine } from '@/engine/calendar'
import { simulateMatch, type MatchResult } from '@/engine/match'
import { buildManagerTeam, buildOpponentTeam, matchSeed } from '@/engine/matchSetup'
import { seeInPerson, targetedLook } from '@/engine/scouting'
import { fixtureFor, isSquadLocked } from '@/engine/fixtures'
import { NATIONS_BY_ID } from '@/data/nations'
import { windowAtWeek, fixtureKey } from '@/data/windows'
import { saveCareer, loadCareer, deleteSave } from './persist'

// Top-level navigation. Plain state machine, no router — simpler and more
// reliable one-handed on a phone than URL routing, and trivial to wrap in
// Capacitor later.
export type Route =
  | 'title'
  | 'new-game'
  | 'schedule'
  | 'squad'
  | 'pool'
  | 'dual-nationals'
  | 'settings'
  | 'save'
  | 'match'
  | 'scouting'
  | 'squad-select'

interface GameState {
  route: Route
  career: Career | null
  hydrated: boolean

  go: (route: Route) => void
  startNewCareer: (input: NewCareerInput) => Promise<void>
  continueCareer: () => Promise<boolean>
  hydrate: () => Promise<void>

  advanceWeek: () => void
  setFormation: (formationId: string) => void
  setLineupSlot: (slotId: string, playerId: string | null) => void
  swapLineupSlots: (slotA: string, slotB: string) => void
  saveNow: () => Promise<void>
  abandonCareer: () => Promise<void>

  setSquad: (ids: string[]) => void
  setStyle: (style: PlayStyle) => void
  setFocalPoint: (playerId: string | null) => void
  playScheduledMatch: () => MatchResult | null
  assignCoach: (coachId: string, league: string | null) => void
  sendScout: (newsId: string, playerId: string) => boolean
}

// Clear the focal point if the chosen player is no longer in the XI.
function keepFocalIfInXI(tactics: Career['tactics'], xiIds: string[]): Career['tactics'] {
  if (tactics.focalPointId && !xiIds.includes(tactics.focalPointId)) {
    return { ...tactics, focalPointId: null }
  }
  return tactics
}

// Debounced autosave so rapid taps don't thrash IndexedDB.
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(career: Career | null) {
  if (!career) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveCareer(career)
  }, 400)
}

export const useGame = create<GameState>((set, get) => ({
  route: 'title',
  career: null,
  hydrated: false,

  go: (route) => set({ route }),

  hydrate: async () => {
    // We don't auto-load into a career; we just mark that hydration ran so the
    // title screen can enable/disable "Continue".
    set({ hydrated: true })
  },

  startNewCareer: async (input) => {
    const career = createCareer(input)
    set({ career, route: 'schedule' })
    await saveCareer(career)
  },

  continueCareer: async () => {
    const career = await loadCareer()
    if (!career) return false
    set({ career, route: 'schedule' })
    return true
  },

  advanceWeek: () => {
    const { career } = get()
    if (!career) return
    const next = advanceWeekEngine(career)
    set({ career: next })
    scheduleSave(next)
  },

  setFormation: (formationId) => {
    const { career } = get()
    if (!career) return
    // Fill the XI from the registered 26 only; bench = the squad minus the XI.
    const squadPlayers = career.players.filter((p) => career.registeredSquad.includes(p.id))
    const lineup = autoFillLineup(squadPlayers, formationId, career.style)
    const xiIds = Object.values(lineup).filter(Boolean) as string[]
    const bench = career.registeredSquad.filter((id) => !xiIds.includes(id))
    const tactics = keepFocalIfInXI(career.tactics, xiIds)
    const next = { ...career, formation: formationId, lineup, bench, tactics }
    set({ career: next })
    scheduleSave(next)
  },

  setLineupSlot: (slotId, playerId) => {
    const { career } = get()
    if (!career) return
    const next = { ...career, lineup: { ...career.lineup, [slotId]: playerId } }
    set({ career: next })
    scheduleSave(next)
  },

  swapLineupSlots: (slotA, slotB) => {
    const { career } = get()
    if (!career) return
    const lineup = { ...career.lineup }
    const tmp = lineup[slotA] ?? null
    lineup[slotA] = lineup[slotB] ?? null
    lineup[slotB] = tmp
    const next = { ...career, lineup }
    set({ career: next })
    scheduleSave(next)
  },

  saveNow: async () => {
    const { career } = get()
    if (career) await saveCareer(career)
  },

  abandonCareer: async () => {
    await deleteSave()
    set({ career: null, route: 'title' })
  },

  assignCoach: (coachId, league) => {
    const { career } = get()
    if (!career) return
    const coaches = career.coaches.map((c) => (c.id === coachId ? { ...c, leagueAssignment: league } : c))
    const next = { ...career, coaches }
    set({ career: next })
    scheduleSave(next)
  },

  setSquad: (ids) => {
    const { career } = get()
    if (!career) return
    if (isSquadLocked(career)) return // registration deadline passed
    const dedup = [...new Set(ids)]
    const squadPlayers = career.players.filter((p) => dedup.includes(p.id))
    const lineup = autoFillLineup(squadPlayers, career.formation, career.style)
    const xiIds = Object.values(lineup).filter(Boolean) as string[]
    const bench = dedup.filter((id) => !xiIds.includes(id))
    const tactics = keepFocalIfInXI(career.tactics, xiIds)
    const next = { ...career, registeredSquad: dedup, lineup, bench, tactics }
    set({ career: next })
    scheduleSave(next)
  },

  setStyle: (style) => {
    const { career } = get()
    if (!career) return
    const next = { ...career, tactics: { ...career.tactics, style } }
    set({ career: next })
    scheduleSave(next)
  },

  setFocalPoint: (playerId) => {
    const { career } = get()
    if (!career) return
    const next = { ...career, tactics: { ...career.tactics, focalPointId: playerId } }
    set({ career: next })
    scheduleSave(next)
  },

  playScheduledMatch: () => {
    const { career } = get()
    if (!career) return null
    const window = windowAtWeek(career.week)
    if (!window) return null
    const key = fixtureKey(career.season, window.id)
    if (career.playedFixtures.includes(key)) return null // already played this window

    const fixture = fixtureFor(career, window, career.season)
    const opponent = NATIONS_BY_ID[fixture.opponentId]
    const isHome = fixture.home

    const managerTeam = buildManagerTeam(career, isHome)
    const opponentTeam = buildOpponentTeam(opponent, career.seed, !isHome)
    const home = isHome ? managerTeam : opponentTeam
    const away = isHome ? opponentTeam : managerTeam
    // Scheduled fixtures are seed-stable (reproducible on save/reload).
    const seed = matchSeed(career.seed, career.season, career.week, fixture.opponentId)
    const result = simulateMatch(home, away, seed)

    // The whole registered 26 was in camp this window: exact reads for all, form
    // nudge for those who featured.
    const ratings = isHome ? result.ratingsHome : result.ratingsAway
    const ratingById = new Map(ratings.map((r) => [r.playerId, r.rating]))
    const squad = new Set<string>(career.registeredSquad)
    const players: Player[] = career.players.map((p) => {
      if (!squad.has(p.id)) return p
      const r = ratingById.get(p.id)
      const formed =
        r === undefined ? p : { ...p, form: Math.max(20, Math.min(99, Math.round(p.form + (r - 6.5) * 3))) }
      return seeInPerson(formed)
    })

    const headline = matchHeadline(result, isHome, career.year, career.week, 0)
    const next: Career = {
      ...career,
      players,
      playedFixtures: [...career.playedFixtures, key],
      // A new inter-window period begins: each coach's targeted look refreshes.
      coaches: career.coaches.map((c) => ({ ...c, targetedLookUsed: false })),
      news: [headline, ...career.news].slice(0, 60),
    }
    set({ career: next })
    scheduleSave(next)
    return result
  },

  sendScout: (newsId, playerId) => {
    const { career } = get()
    if (!career) return false
    const coachIdx = career.coaches.findIndex((c) => !c.targetedLookUsed)
    if (coachIdx < 0) return false // no targeted looks left this period

    const coaches = career.coaches.map((c, i) => (i === coachIdx ? { ...c, targetedLookUsed: true } : c))
    let scouted: Player | null = null
    const players = career.players.map((p) => {
      if (p.id !== playerId) return p
      scouted = targetedLook(p)
      return scouted
    })
    if (!scouted) return false

    const report = scoutReport(scouted, career.year, career.week)
    const news = [report, ...career.news.map((n) => (n.id === newsId ? { ...n, action: undefined } : n))].slice(0, 80)
    const next: Career = { ...career, coaches, players, news }
    set({ career: next })
    scheduleSave(next)
    return true
  },
}))

// A scout's verdict after a targeted look — confirmation or bust, keyed off the
// now-revealed potential (the player object passed in is already scouted).
function scoutReport(p: Player, year: number, week: number): NewsItem {
  let verdict: string
  if (p.potential >= 88) verdict = `${p.name} is the real deal — a generational ceiling. Lock him down before anyone else does.`
  else if (p.potential >= 80) verdict = `${p.name} has genuine top-team potential. Well worth tracking.`
  else if (p.potential >= 72) verdict = `${p.name} is a tidy player, but not the superstar the hype suggested.`
  else verdict = `${p.name} is a flat-track bully — the hype has outrun the talent. One for depth at best.`
  return {
    id: `scout-${p.id}-${year}-${week}-${p.potential}`,
    year,
    week,
    type: 'SCOUT_REPORT',
    magnitude: 0.6,
    subjectId: p.id,
    text: `Scout report: ${verdict}`,
  }
}

function matchHeadline(
  result: MatchResult,
  managerIsHome: boolean,
  year: number,
  week: number,
  nonce: number,
): Career['news'][number] {
  const mine = managerIsHome ? result.homeGoals : result.awayGoals
  const theirs = managerIsHome ? result.awayGoals : result.homeGoals
  const verb = mine > theirs ? 'beat' : mine < theirs ? 'lost to' : 'drew with'
  const myName = managerIsHome ? result.homeName : result.awayName
  const oppName = managerIsHome ? result.awayName : result.homeName
  const motm = result.motm ? ` ${result.motm.name} took the plaudits.` : ''
  return {
    id: `match-${nonce}-${myName}-${oppName}-${result.homeGoals}${result.awayGoals}-${year}${week}`,
    week,
    year,
    type: 'FRIENDLY',
    magnitude: 0.6,
    text: `${myName} ${verb} ${oppName} ${result.homeGoals}–${result.awayGoals} in a friendly.${motm}`,
  }
}
