import type { Nation } from '@/engine/types'

// The 25 playable nations. Confederation labels are generic / trademark-safe
// (per Tournament Structure bible). Ratings are first-pass tunable values
// (nationRating / youthRating / footballCulture, all 1..100) and the nation's
// default tactical identity. Filler (non-playable) nations are out of scope for
// the shell and will be generated as data in a later milestone.

export const NATIONS: Nation[] = [
  // EFU — European Football Union
  n('ENG', 'England', 'EFU', 'ENGLAND', 84, 86, 88, 'Direct'),
  n('FRA', 'France', 'EFU', 'FRANCE', 87, 88, 86, 'Balanced'),
  n('ESP', 'Spain', 'EFU', 'SPAIN', 86, 85, 90, 'Possession'),
  n('GER', 'Germany', 'EFU', 'GERMANY', 85, 84, 88, 'HighPress'),
  n('ITA', 'Italy', 'EFU', 'ITALY', 83, 80, 85, 'Counter'),
  n('POR', 'Portugal', 'EFU', 'PORTUGAL', 84, 85, 84, 'Possession'),
  n('NED', 'Netherlands', 'EFU', 'NETHERLANDS', 83, 84, 87, 'Possession'),
  n('BEL', 'Belgium', 'EFU', 'BELGIUM', 81, 78, 82, 'Direct'),
  n('CRO', 'Croatia', 'EFU', 'CROATIA', 79, 74, 80, 'Possession'),
  n('SRB', 'Serbia', 'EFU', 'SERBIA', 77, 75, 78, 'Direct'),

  // SAC — South American Confederation
  n('BRA', 'Brazil', 'SAC', 'BRAZIL', 88, 90, 92, 'Possession'),
  n('ARG', 'Argentina', 'SAC', 'ARGENTINA', 87, 85, 90, 'Balanced'),
  n('URU', 'Uruguay', 'SAC', 'URUGUAY', 80, 78, 84, 'Counter'),
  n('COL', 'Colombia', 'SAC', 'COLOMBIA', 78, 80, 82, 'Direct'),

  // NCC — North & Central Confederation
  n('USA', 'United States', 'NCC', 'UNITED_STATES', 76, 78, 72, 'HighPress'),
  n('MEX', 'Mexico', 'NCC', 'MEXICO', 78, 79, 80, 'Possession'),

  // AFU — African Football Union
  n('MAR', 'Morocco', 'AFU', 'MOROCCO', 79, 78, 76, 'Counter'),
  n('NGA', 'Nigeria', 'AFU', 'NIGERIA', 77, 82, 78, 'Direct'),
  n('SEN', 'Senegal', 'AFU', 'SENEGAL', 78, 80, 75, 'HighPress'),
  n('GHA', 'Ghana', 'AFU', 'GHANA', 74, 78, 74, 'Direct'),
  n('CMR', 'Cameroon', 'AFU', 'CAMEROON', 73, 76, 73, 'Counter'),

  // ASC — Asian Football Confederation
  n('JPN', 'Japan', 'ASC', 'JAPAN', 79, 81, 83, 'Possession'),
  n('KOR', 'South Korea', 'ASC', 'SOUTH_KOREA', 77, 78, 80, 'HighPress'),
  n('AUS', 'Australia', 'ASC', 'AUSTRALIA', 73, 72, 74, 'Direct'),

  // OFU — Oceania Football Union
  n('NZL', 'New Zealand', 'OFU', 'NEW_ZEALAND', 64, 62, 66, 'Direct'),
]

function n(
  id: string,
  name: string,
  confederation: Nation['confederation'],
  namePool: string,
  nationRating: number,
  youthRating: number,
  footballCulture: number,
  tacticalIdentity: Nation['tacticalIdentity'],
): Nation {
  return {
    id,
    name,
    confederation,
    namePool,
    isPlayable: true,
    nationRating,
    youthRating,
    footballCulture,
    tacticalIdentity,
  }
}

export const NATIONS_BY_ID: Record<string, Nation> = Object.fromEntries(
  NATIONS.map((nat) => [nat.id, nat]),
)

export const CONFEDERATION_NAMES: Record<Nation['confederation'], string> = {
  EFU: 'European Football Union',
  SAC: 'South American Confederation',
  NCC: 'North & Central Confederation',
  AFU: 'African Football Union',
  ASC: 'Asian Football Confederation',
  OFU: 'Oceania Football Union',
}
