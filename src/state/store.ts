import { create } from 'zustand'
import type { Career, Player, PlayStyle } from '@/engine/types'
import { createCareer, autoFillLineup, type NewCareerInput } from '@/engine/career'
import { advanceWeek as advanceWeekEngine } from '@/engine/calendar'
import { simulateMatch, type MatchResult } from '@/engine/match'
import { buildManagerTeam, buildOpponentTeam, matchSeed } from '@/engine/matchSetup'
import { deriveSeed } from '@/engine/rng'
import { NATIONS_BY_ID } from '@/data/nations'
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

  playExhibition: (opponentId: string, style: PlayStyle, isHome: boolean) => MatchResult
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
    const lineup = autoFillLineup(career.players, formationId, career.style)
    const next = { ...career, formation: formationId, lineup }
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

  playExhibition: (opponentId, style, isHome) => {
    const { career } = get()
    if (!career) throw new Error('no career')
    const opponent = NATIONS_BY_ID[opponentId]

    const managerTeam = buildManagerTeam(career, style, isHome)
    const opponentTeam = buildOpponentTeam(opponent, career.seed, !isHome)
    const home = isHome ? managerTeam : opponentTeam
    const away = isHome ? opponentTeam : managerTeam
    // Mix in a per-friendly counter so replaying the same fixture this week
    // rolls a fresh result instead of reproducing the previous one. Scheduled
    // competitive fixtures (later) will stay seed-stable for save/reload.
    const count = career.exhibitionCount ?? 0 // tolerate pre-Milestone-1 saves
    const seed = deriveSeed(matchSeed(career.seed, career.year, career.week, opponentId), count)
    const result = simulateMatch(home, away, seed)

    // Apply a light form nudge to the manager's players who featured, pulling
    // form toward their match rating — so results carry into the next match.
    const ratings = isHome ? result.ratingsHome : result.ratingsAway
    const ratingById = new Map(ratings.map((r) => [r.playerId, r.rating]))
    const players: Player[] = career.players.map((p) => {
      const r = ratingById.get(p.id)
      if (r === undefined) return p
      const delta = (r - 6.5) * 3
      return { ...p, form: Math.max(20, Math.min(99, Math.round(p.form + delta))) }
    })

    const headline = matchHeadline(result, isHome, career.year, career.week, count)
    const next: Career = {
      ...career,
      players,
      exhibitionCount: count + 1,
      news: [headline, ...career.news].slice(0, 60),
    }
    set({ career: next })
    scheduleSave(next)
    return result
  },
}))

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
