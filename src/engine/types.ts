// Core domain types. Hidden fields (potential, leans, injuryRisk…) live on the
// objects but are NEVER rendered raw — the UI reads scouted/derived views only.

export type Confederation = 'EFU' | 'SAC' | 'NCC' | 'AFU' | 'ASC' | 'OFU'

export type Position = 'GK' | 'DF' | 'MF' | 'FW'

export type PlayStyle = 'Balanced' | 'Possession' | 'Counter' | 'Direct' | 'HighPress'

export type EligibilityState = 'ELIGIBLE' | 'PROVISIONAL' | 'CAP_TIED'

// The eight-attribute model (canonical per Match Engine bible).
export interface Ratings {
  finishing: number
  pace: number
  technique: number
  passing: number
  physical: number
  mental: number
  defending: number
  goalkeeping: number
}

export interface Player {
  id: string
  name: string
  nationality: string // nation id
  position: Position
  age: number
  club: string
  clubLeague: string
  ratings: Ratings
  form: number // 0..100, short-term
  overall: number // convenience: weighted snapshot of ratings for the position

  // ---- hidden (never surfaced raw) ----
  potential: number
  injuryRisk: number
  professionalism: number
  consistency: number

  // ---- eligibility ----
  eligibleNations: string[]
  leans: Record<string, number> // hidden lean per eligible nation
  eligibilityState: EligibilityState
  tiedNation: string | null

  // ---- scouting freshness ----
  freshness: number // 100 = sharp, decays when uncovered
}

export interface Nation {
  id: string
  name: string
  confederation: Confederation
  namePool: string
  isPlayable: boolean
  nationRating: number
  youthRating: number
  footballCulture: number
  tacticalIdentity: PlayStyle
}

export interface Coach {
  id: string
  name: string
  leagueAssignment: string | null
  targetedLookUsed: boolean
}

export interface ManagerStyle {
  formation: string // e.g. '4-3-3'
  approach: 'Attacking' | 'Balanced' | 'Defensive'
  preference: 'Youth' | 'Balanced' | 'Experience'
}

export interface NewsItem {
  id: string
  week: number
  year: number
  type: string
  text: string
  magnitude: number
}

export interface Career {
  seed: number
  createdAt: number
  saveVersion: number

  managerName: string
  managerNationId: string
  style: ManagerStyle

  year: number // cycle year 1..4
  week: number // 1..52

  players: Player[] // the manager nation's pool (shell: generated squad+fringe)
  coaches: Coach[]
  lineup: Record<string, string | null> // formation slot id -> player id
  formation: string

  news: NewsItem[]
}
