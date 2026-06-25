// Presentation helpers. Critically, this is where the scouting-freshness model
// surfaces: the player object holds the real rating, but the UI must show a
// read whose *sharpness* depends on freshness. Low freshness => fuzzy display.

import type { Player } from '@/engine/types'

export function formColor(form: number): string {
  if (form >= 78) return 'var(--hot)'
  if (form >= 62) return 'var(--good)'
  if (form >= 45) return 'var(--ok)'
  if (form >= 30) return 'var(--warn)'
  return 'var(--bad)'
}

export function freshnessLabel(freshness: number): string {
  if (freshness >= 99) return 'Known'
  if (freshness >= 72) return 'Sharp'
  if (freshness >= 45) return 'Rough'
  if (freshness >= 25) return 'Vague'
  return 'Unknown'
}

export function freshnessColor(freshness: number): string {
  if (freshness >= 72) return 'var(--good)'
  if (freshness >= 45) return 'var(--ok)'
  if (freshness >= 25) return 'var(--warn)'
  return 'var(--bad)'
}

// Weeks an in-person read stays exact, then ~exact, before reverting to a range.
const EXACT_WEEKS = 14 // ~a quarter: you just saw him, you know him exactly
const MEMORY_WEEKS = 52 // up to a year: you remember him, shown as ~exact

// Half-width of the displayed rating band, from coverage confidence. Floored —
// there is always at least a wide range, never "??".
export function ratingMargin(freshness: number): number {
  if (freshness >= 70) return 2 // well covered
  if (freshness >= 52) return 3
  if (freshness >= 38) return 4
  if (freshness >= 28) return 6
  return 8 // floor — a wide range, but you always have some read
}

// A capped player you saw recently enough to still trust an exact figure for.
function inPersonMode(p: Player): 'exact' | 'aging' | null {
  if (p.inPersonOverall === null) return null
  if (p.inPersonWeeks < EXACT_WEEKS) return 'exact'
  if (p.inPersonWeeks < MEMORY_WEEKS) return 'aging'
  return null // older than a year — fall back to a coverage range
}

// Displayed rating. A recently-capped player shows his exact in-person figure
// (or ~figure as the memory ages); otherwise a coverage band centered on the
// scouted estimate. Never the hidden real value, never "??".
export function displayOverall(p: Player): string {
  const mode = inPersonMode(p)
  if (mode === 'exact') return String(p.inPersonOverall)
  if (mode === 'aging') return `~${p.inPersonOverall}`
  const m = ratingMargin(p.freshness)
  const lo = Math.max(1, p.knownOverall - m)
  const hi = Math.min(99, p.knownOverall + m)
  return `${lo}–${hi}`
}

// Compact form for small tokens (pitch): exact number or ~estimate.
export function displayOverallShort(p: Player): string {
  const mode = inPersonMode(p)
  if (mode === 'exact') return String(p.inPersonOverall)
  if (mode === 'aging') return `~${p.inPersonOverall}`
  return `~${p.knownOverall}`
}

// Potential read: unknown until you've watched enough, then a coarse star band.
export function displayPotential(p: Player): string {
  if (p.knownPotential === 0 || p.freshness < 38) return '?'
  return starString(p.knownPotential)
}

export function positionColor(position: Player['position']): string {
  switch (position) {
    case 'GK':
      return '#f59e0b'
    case 'DF':
      return '#38bdf8'
    case 'MF':
      return '#22c55e'
    case 'FW':
      return '#fb7185'
  }
}

// The ids of the top-N players (by scouted rating) among a given id set — used
// to star a squad's best players in the squad/formation views.
export function topRatedIds(players: Player[], ids: string[], n: number): Set<string> {
  const set = new Set(ids)
  return new Set(
    players
      .filter((p) => set.has(p.id))
      .sort((a, b) => b.knownOverall - a.knownOverall)
      .slice(0, n)
      .map((p) => p.id),
  )
}

// Star rating from a 0..99 scale, for potential bands (shown only when known).
export function starString(value: number): string {
  const stars = Math.max(0.5, Math.min(5, Math.round((value / 99) * 10) / 2))
  const full = Math.floor(stars)
  const half = stars - full >= 0.5
  return '★'.repeat(full) + (half ? '½' : '')
}
