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
  if (freshness >= 80) return 'Sharp'
  if (freshness >= 50) return 'Drifting'
  if (freshness >= 25) return 'Stale'
  return 'Fuzzy'
}

export function freshnessColor(freshness: number): string {
  if (freshness >= 80) return 'var(--good)'
  if (freshness >= 50) return 'var(--ok)'
  if (freshness >= 25) return 'var(--warn)'
  return 'var(--bad)'
}

// Displayed rating: sharp reads show the exact number; fuzzy reads show a band
// (e.g. "~70") because you genuinely don't know it precisely anymore.
export function displayOverall(p: Player): string {
  if (p.freshness >= 80) return String(p.overall)
  if (p.freshness >= 50) return `${p.overall - 1}–${p.overall + 1}`
  if (p.freshness >= 25) return `~${Math.round(p.overall / 5) * 5}`
  return '??'
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

// Star rating from a 0..99 scale, for potential bands (shown only when known).
export function starString(value: number): string {
  const stars = Math.max(0.5, Math.min(5, Math.round((value / 99) * 10) / 2))
  const full = Math.floor(stars)
  const half = stars - full >= 0.5
  return '★'.repeat(full) + (half ? '½' : '')
}
