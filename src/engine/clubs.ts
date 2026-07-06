// Club season arcs: every club lives a season-long story — a title race, a
// European push, mid-table comfort, or a relegation dogfight. Deterministic
// per (club, season, seed), so the story holds together all year: the weekly
// club-watch references it, players\' form drifts with it, and at season\'s end
// somebody lifts a league title or goes down. Flavor with teeth.

import { RNG, deriveSeed, hashStr } from './rng'

export type ClubArc = 'TITLE' | 'EUROPE' | 'MID' | 'RELEGATION'

export function clubArc(club: string, season: number, seed: number): ClubArc {
  const r = new RNG(deriveSeed(seed, season, hashStr(club), 0xc1b)).next()
  if (r < 0.15) return 'TITLE'
  if (r < 0.35) return 'EUROPE'
  if (r < 0.75) return 'MID'
  return 'RELEGATION'
}

// Weekly form drift from the club\'s season: winning environments lift players,
// dogfights grind them down. Small, but a season of it compounds.
export function arcFormDrift(arc: ClubArc): number {
  switch (arc) {
    case 'TITLE': return 0.35
    case 'EUROPE': return 0.15
    case 'MID': return 0
    case 'RELEGATION': return -0.35
  }
}

export function arcPhrase(arc: ClubArc): string {
  switch (arc) {
    case 'TITLE': return 'with his club in the title race'
    case 'EUROPE': return 'with his club chasing a continental place'
    case 'MID': return 'in a comfortable mid-table season'
    case 'RELEGATION': return 'deep in a relegation dogfight'
  }
}

// Did the arc pay off? Resolved once at season\'s end, deterministically.
export function arcOutcome(club: string, season: number, seed: number): 'CHAMPIONS' | 'RELEGATED' | null {
  const arc = clubArc(club, season, seed)
  const r = new RNG(deriveSeed(seed, season, hashStr(club), 0x0c2)).next()
  if (arc === 'TITLE' && r < 0.45) return 'CHAMPIONS'
  if (arc === 'RELEGATION' && r < 0.45) return 'RELEGATED'
  return null
}
