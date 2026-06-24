// Durable local save via IndexedDB (idb-keyval). The entire game state is one
// serializable Career object; we snapshot it under a single key. Offline-first:
// no network is ever touched. A saveVersion field is reserved for future
// migrations.
//
// Every call is wrapped defensively: if IndexedDB is unavailable or throws
// (private-browsing modes, locked-down webviews, quota errors), persistence
// degrades to a no-op rather than letting a storage failure surface as a crash.

import { get, set, del } from 'idb-keyval'
import type { Career } from '@/engine/types'

const SAVE_KEY = 'ntm:career'
const SETTINGS_KEY = 'ntm:settings'

export interface Settings {
  volume: number // reserved (music lands later)
  difficulty: string // reserved
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.7, difficulty: 'Normal' }

const storageAvailable = typeof indexedDB !== 'undefined'

export async function saveCareer(career: Career): Promise<void> {
  if (!storageAvailable) return
  try {
    await set(SAVE_KEY, career)
  } catch (e) {
    console.warn('saveCareer failed', e)
  }
}

export async function loadCareer(): Promise<Career | undefined> {
  if (!storageAvailable) return undefined
  try {
    return (await get(SAVE_KEY)) as Career | undefined
  } catch (e) {
    console.warn('loadCareer failed', e)
    return undefined
  }
}

export async function hasSave(): Promise<boolean> {
  return (await loadCareer()) !== undefined
}

export async function deleteSave(): Promise<void> {
  if (!storageAvailable) return
  try {
    await del(SAVE_KEY)
  } catch (e) {
    console.warn('deleteSave failed', e)
  }
}

export async function loadSettings(): Promise<Settings> {
  if (!storageAvailable) return DEFAULT_SETTINGS
  try {
    return ((await get(SETTINGS_KEY)) as Settings | undefined) ?? DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  if (!storageAvailable) return
  try {
    await set(SETTINGS_KEY, s)
  } catch (e) {
    console.warn('saveSettings failed', e)
  }
}
