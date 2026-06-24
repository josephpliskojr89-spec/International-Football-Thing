import { create } from 'zustand'
import type { Career } from '@/engine/types'
import { createCareer, autoFillLineup, type NewCareerInput } from '@/engine/career'
import { advanceWeek as advanceWeekEngine } from '@/engine/calendar'
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
}))
