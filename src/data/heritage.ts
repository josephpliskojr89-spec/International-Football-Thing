// Dual-national heritage / migration weighting (NTM Youth Generation Part 6,
// Dev & Eligibility Part 3): when a prospect is generated as a dual-national,
// his SECOND eligibility is drawn from plausible real-world migration patterns,
// not uniformly at random. Keyed by the producing nation -> weighted candidate
// second nations. A small flavor-randomness chance still allows surprises.
//
// All ids must exist in nations.ts or fillerNations.ts.

export const HERITAGE_FLAVOR_CHANCE = 0.15 // chance of an out-of-pattern surprise

export const HERITAGE: Record<string, [string, number][]> = {
  // EFU
  ENG: [['NGA', 4], ['JAM', 4], ['GHA', 3], ['SCO', 3], ['AUS', 2], ['USA', 1], ['ITA', 1]],
  FRA: [['SEN', 5], ['MAR', 5], ['ALG', 5], ['MLI', 4], ['CIV', 4], ['CMR', 3], ['TUN', 3], ['POR', 2], ['ESP', 1], ['GHA', 1]],
  ESP: [['ARG', 4], ['COL', 3], ['MAR', 3], ['VEN', 2], ['PER', 1], ['BRA', 1]],
  GER: [['POL', 4], ['CRO', 2], ['SRB', 2], ['AUT', 2], ['SUI', 1], ['USA', 1], ['GHA', 1]],
  ITA: [['ARG', 4], ['BRA', 3], ['URU', 2], ['GHA', 1], ['CIV', 1]],
  POR: [['BRA', 4], ['FRA', 2], ['ESP', 1], ['GHA', 1], ['CIV', 1]],
  NED: [['MAR', 5], ['BEL', 1], ['GHA', 1]],
  BEL: [['MAR', 5], ['FRA', 2], ['CMR', 2], ['CIV', 1]],
  CRO: [['GER', 3], ['SUI', 2], ['AUT', 2], ['SRB', 1]],
  SRB: [['GER', 3], ['SUI', 2], ['AUT', 2], ['CRO', 1]],
  // SAC
  BRA: [['POR', 4], ['ITA', 3], ['JPN', 2], ['ESP', 1]],
  ARG: [['ITA', 5], ['ESP', 4], ['CHI', 1], ['URU', 1], ['PAR', 1]],
  URU: [['ITA', 4], ['ESP', 3], ['ARG', 1]],
  COL: [['ESP', 3], ['VEN', 3], ['USA', 1], ['ECU', 1]],
  // NCC
  USA: [['MEX', 5], ['GER', 3], ['NGA', 2], ['GHA', 2], ['JAM', 2], ['CAN', 2], ['ENG', 1], ['ITA', 1]],
  MEX: [['USA', 6], ['ESP', 1]],
  // AFU
  MAR: [['FRA', 5], ['NED', 4], ['ESP', 3], ['BEL', 3], ['ITA', 2]],
  NGA: [['ENG', 5], ['USA', 2], ['GER', 1], ['CAN', 1]],
  SEN: [['FRA', 6], ['ITA', 2], ['ESP', 1]],
  GHA: [['ENG', 3], ['USA', 2], ['GER', 2], ['ITA', 1], ['NED', 1]],
  CMR: [['FRA', 5], ['GER', 1], ['BEL', 1], ['ESP', 1]],
  // ASC
  JPN: [['BRA', 2], ['USA', 1]],
  KOR: [['USA', 2], ['JPN', 1]],
  AUS: [['ENG', 4], ['CRO', 2], ['ITA', 2], ['GRE', 2], ['NZL', 1]],
  // OFU
  NZL: [['AUS', 3], ['ENG', 3], ['FIJ', 1]],

  // Notable filler producers
  ALG: [['FRA', 6], ['ESP', 1]],
  TUN: [['FRA', 5], ['ITA', 1]],
  CIV: [['FRA', 5], ['BEL', 1]],
  MLI: [['FRA', 6], ['ESP', 1]],
  EGY: [['FRA', 1], ['ITA', 1]],
  JAM: [['ENG', 4], ['USA', 2]],
  CAN: [['USA', 2], ['ENG', 1], ['ITA', 1]],
  POL: [['GER', 2], ['ENG', 1], ['USA', 1]],
  SCO: [['ENG', 3], ['AUS', 1]],
  SUI: [['ITA', 2], ['POR', 1], ['ESP', 1]],
  AUT: [['GER', 3]],
  GRE: [['GER', 1], ['AUS', 1]],
  CHI: [['ESP', 2], ['ITA', 1]],
  PER: [['ESP', 1], ['JPN', 1]],
  NCL: [['FRA', 5]], // New Caledonia — French territory
  TAH: [['FRA', 5]], // Tahiti — French territory
  FIJ: [['AUS', 2], ['NZL', 2], ['ENG', 1]],
}
