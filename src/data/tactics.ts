import type { PlayStyle } from '@/engine/types'

// Player-facing labels + one-line descriptions for the five match styles. The
// mechanical effect lives in the match engine's STYLE_MODS; this is just how the
// choice reads on the Tactics screen.
export const STYLES: PlayStyle[] = ['Balanced', 'Possession', 'Counter', 'Direct', 'HighPress']

export const STYLE_LABELS: Record<PlayStyle, string> = {
  Balanced: 'Balanced',
  Possession: 'Possession',
  Counter: 'Counter-Attack',
  Direct: 'Direct',
  HighPress: 'High Press',
}

export const STYLE_DESC: Record<PlayStyle, string> = {
  Balanced: 'No bias — solid everywhere.',
  Possession: 'Control the midfield and keep the ball.',
  Counter: 'Sit deep, soak pressure, hit on the break.',
  Direct: 'Get it forward fast — favour the attack.',
  HighPress: 'Press high and dominate midfield; leaves space behind.',
}
