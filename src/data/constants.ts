// All tuning levers live here so playtesting never means hunting through logic.
// Match Engine, development, youth, scouting and news all read from this file.

export const SAVE_VERSION = 1

// ---- Match Engine (NTM_Match_Engine_v1) ----
export const MATCH = {
  formRange: { min: 0.92, max: 1.1 }, // per-match wildcard, top-weighted
  homeBonus: 1.03,
  xgFloor: 0.3,
  baseChances: 1.3, // balanced match ~1.3 xG/side
  midfieldEdge: { min: 0.85, max: 1.15 },
} as const

// ---- Calendar ----
export const WEEKS_PER_YEAR = 52

// ---- Scouting ----
export const COACH_COUNT = 3 // fixed for v1 (manager progression deferred)

// (The registered-squad size lives in engine/fixtures.ts as SQUAD_SIZE = 26.)

// ---- Tactics: focal point ("play through" a chosen star) ----
export const FOCAL = {
  // Attack-zone lift when channeling through a quality focal point. Scales with
  // how much better than a baseline he is; capped so it stays a nudge.
  attackBoostPer: 0.0045, // per overall point above baseline
  attackBoostBaseline: 70,
  attackBoostMax: 0.06,
  // The focal player's form matters more (risk): extra form swing on the boost.
  formSwing: 0.5,
  // How much more likely the focal player is to be the scorer/outlet.
  scorerWeight: 2.5,
} as const
