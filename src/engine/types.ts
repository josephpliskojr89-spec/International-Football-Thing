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

  // ---- REAL ability (HIDDEN — moved invisibly by the development engine) ----
  // These are the truth. The UI must never render them directly; it renders the
  // scouted read below. They only become known through coverage.
  ratings: Ratings
  overall: number // derived from ratings for the position
  potential: number // hidden ceiling
  form: number // 0..100, short-term

  // ---- other hidden traits ----
  injuryRisk: number
  professionalism: number
  consistency: number
  playingTime: number // 0..1 club playing-time factor (dominant growth lever)

  // ---- THE SCOUTED READ (what the UI shows) ----
  // knownOverall/knownPotential are the player's *last observed* values. They
  // sync to the real ones on coverage and otherwise stay frozen (going stale).
  knownOverall: number
  knownPotential: number // 0 = not yet projected
  freshness: number // coverage confidence -> range width (floored, never unknown)

  // Last EXACT read from seeing him in person (a call-up). null = never capped
  // by you. inPersonWeeks counts weeks since; a recent cap shows exact, an aging
  // one shows ~exact, and after a year it falls back to a coverage range.
  inPersonOverall: number | null
  inPersonWeeks: number

  // ---- eligibility ----
  eligibleNations: string[]
  leans: Record<string, number> // hidden lean per eligible nation
  eligibilityState: EligibilityState
  tiedNation: string | null
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

// Persistent in-game tactics that drive the match engine.
export interface Tactics {
  style: PlayStyle
  focalPointId: string | null // a player to "play through" (must be in the XI)
}

// ---- Qualifying campaign ----
export interface GroupStanding {
  nationId: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  pts: number
}

export interface GroupFixture {
  homeId: string
  awayId: string
}

export interface PlayedResult extends GroupFixture {
  hg: number
  ag: number
}

export interface Campaign {
  cycle: number // which qualifying campaign this is (1, 2, ...)
  groupNationIds: string[] // the manager's group (incl. the manager nation)
  matchdays: GroupFixture[][] // round-robin double; one entry per matchday
  matchdayIndex: number // next matchday to play (0-based)
  standings: GroupStanding[]
  recentResults: PlayedResult[] // results of the most recently completed matchday
  qualifyCount: number // top N qualify
  complete: boolean
  qualifiedIds: string[] // set when complete
}

export interface NewsItem {
  id: string
  week: number
  year: number
  type: string
  text: string
  magnitude: number
  subjectId?: string // player this item is about (for actions)
  action?: 'SEND_SCOUT' // optional tappable action in the feed
}

export interface Career {
  seed: number
  createdAt: number
  saveVersion: number

  managerName: string
  managerNationId: string
  style: ManagerStyle // initial preferences from new-game setup
  tactics: Tactics // persistent in-game tactics (drive the match)

  year: number // cycle year 1..4 (World Cup pulse)
  season: number // absolute season counter (drives aging + youth intake)
  week: number // 1..52
  exhibitionCount: number // # of one-off friendlies played; varies their seed

  players: Player[] // the manager nation's full eligible pool
  coaches: Coach[]
  registeredSquad: string[] // the called-up 26 (XI + subs) for the window
  lineup: Record<string, string | null> // formation slot id -> player id (the XI)
  bench: string[] // registered squad players not in the XI (the subs)
  formation: string
  playedFixtures: string[] // fixtureKey()s already played, to avoid replays
  campaign: Campaign // the World Cup qualifying campaign

  news: NewsItem[]
}
