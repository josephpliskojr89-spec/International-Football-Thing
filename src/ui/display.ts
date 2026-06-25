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

// Half-width of the displayed rating band, from confidence. 0 = exact (seen in
// person); null = too little known to even give a range ("??").
export function ratingMargin(freshness: number): number | null {
  if (freshness >= 99) return 0 // exact — saw him in person
  if (freshness >= 88) return 1 // targeted look
  if (freshness >= 70) return 2 // well covered
  if (freshness >= 52) return 3
  if (freshness >= 38) return 5
  if (freshness >= 22) return 8
  return null // unknown
}

// Displayed rating is ALWAYS a band, except an exact in-person read. Centered on
// the scouted estimate (knownOverall), never the hidden real value.
export function displayOverall(p: Player): string {
  const m = ratingMargin(p.freshness)
  if (m === null) return '??'
  if (m === 0) return String(p.knownOverall)
  const lo = Math.max(1, p.knownOverall - m)
  const hi = Math.min(99, p.knownOverall + m)
  return `${lo}–${hi}`
}

// Compact form for small tokens (pitch): exact number, ~estimate, or ??.
export function displayOverallShort(p: Player): string {
  const m = ratingMargin(p.freshness)
  if (m === null) return '??'
  if (m === 0) return String(p.knownOverall)
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

// Star rating from a 0..99 scale, for potential bands (shown only when known).
export function starString(value: number): string {
  const stars = Math.max(0.5, Math.min(5, Math.round((value / 99) * 10) / 2))
  const full = Math.floor(stars)
  const half = stars - full >= 0.5
  return '★'.repeat(full) + (half ? '½' : '')
}
