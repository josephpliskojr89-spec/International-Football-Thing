// Durable local save via IndexedDB (idb-keyval). The entire game state is one
// serializable Career object; we snapshot it under a single key. Offline-first:
// no network is ever touched. A saveVersion field is reserved for future
// migrations.

import { get, set, del } from 'idb-keyval'
import type { Career } from '@/engine/types'

const SAVE_KEY = 'ntm:career'
const SETTINGS_KEY = 'ntm:settings'

export interface Settings {
  volume: number // reserved (music lands later)
  difficulty: string // reserved
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.7, difficulty: 'Normal' }

export async function saveCareer(career: Career): Promise<void> {
  await set(SAVE_KEY, career)
}

export async function loadCareer(): Promise<Career | undefined> {
  return (await get(SAVE_KEY)) as Career | undefined
}

export async function hasSave(): Promise<boolean> {
  return (await loadCareer()) !== undefined
}

export async function deleteSave(): Promise<void> {
  await del(SAVE_KEY)
}

export async function loadSettings(): Promise<Settings> {
  return ((await get(SETTINGS_KEY)) as Settings | undefined) ?? DEFAULT_SETTINGS
}

export async function saveSettings(s: Settings): Promise<void> {
  await set(SETTINGS_KEY, s)
}
