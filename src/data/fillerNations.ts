import type { Nation } from '@/engine/types'

// Non-playable "filler" nations (NTM Tournament Structure, Tier 3): they carry
// only the three ratings + a tactical identity and a regional name pool. No
// squad is ever generated for them; their matches resolve as lightweight
// Poisson scorelines. They exist to fill out qualifying groups per confederation.

function f(
  id: string,
  name: string,
  confederation: Nation['confederation'],
  namePool: string,
  nationRating: number,
  youthRating: number,
  footballCulture: number,
  tacticalIdentity: Nation['tacticalIdentity'],
): Nation {
  return { id, name, confederation, namePool, isPlayable: false, nationRating, youthRating, footballCulture, tacticalIdentity }
}

export const FILLER_NATIONS: Nation[] = [
  // EFU
  f('POL', 'Poland', 'EFU', 'EASTERN_EUROPEAN_SLAVIC', 75, 72, 74, 'Direct'),
  f('SWE', 'Sweden', 'EFU', 'NORDIC', 74, 73, 76, 'Balanced'),
  f('DEN', 'Denmark', 'EFU', 'NORDIC', 76, 74, 78, 'Possession'),
  f('NOR', 'Norway', 'EFU', 'NORDIC', 73, 76, 75, 'Direct'),
  f('SUI', 'Switzerland', 'EFU', 'WESTERN_EUROPEAN', 75, 72, 76, 'Balanced'),
  f('AUT', 'Austria', 'EFU', 'WESTERN_EUROPEAN', 74, 73, 74, 'HighPress'),
  f('CZE', 'Czechia', 'EFU', 'EASTERN_EUROPEAN_SLAVIC', 72, 70, 73, 'Balanced'),
  f('UKR', 'Ukraine', 'EFU', 'EASTERN_EUROPEAN_SLAVIC', 73, 72, 74, 'Counter'),
  f('GRE', 'Greece', 'EFU', 'EASTERN_EUROPEAN_SLAVIC', 70, 66, 71, 'Counter'),
  f('SCO', 'Scotland', 'EFU', 'WESTERN_EUROPEAN', 71, 68, 74, 'Direct'),

  // SAC
  f('CHI', 'Chile', 'SAC', 'HISPANIC_LATAM', 74, 70, 78, 'HighPress'),
  f('PER', 'Peru', 'SAC', 'HISPANIC_LATAM', 71, 69, 76, 'Possession'),
  f('ECU', 'Ecuador', 'SAC', 'HISPANIC_LATAM', 72, 74, 75, 'Direct'),
  f('PAR', 'Paraguay', 'SAC', 'HISPANIC_LATAM', 69, 67, 73, 'Counter'),
  f('BOL', 'Bolivia', 'SAC', 'HISPANIC_LATAM', 62, 60, 68, 'Counter'),
  f('VEN', 'Venezuela', 'SAC', 'HISPANIC_LATAM', 67, 68, 70, 'Balanced'),

  // NCC
  f('CRC', 'Costa Rica', 'NCC', 'HISPANIC_LATAM', 68, 64, 70, 'Counter'),
  f('CAN', 'Canada', 'NCC', 'WESTERN_EUROPEAN', 70, 72, 68, 'Direct'),
  f('JAM', 'Jamaica', 'NCC', 'WEST_AFRICAN', 66, 66, 67, 'Direct'),
  f('PAN', 'Panama', 'NCC', 'HISPANIC_LATAM', 63, 60, 65, 'Counter'),
  f('HON', 'Honduras', 'NCC', 'HISPANIC_LATAM', 61, 59, 64, 'Counter'),
  f('SLV', 'El Salvador', 'NCC', 'HISPANIC_LATAM', 57, 56, 60, 'Counter'),

  // AFU
  f('EGY', 'Egypt', 'AFU', 'NORTH_AFRICAN_MAGHREB', 73, 70, 74, 'Counter'),
  f('ALG', 'Algeria', 'AFU', 'NORTH_AFRICAN_MAGHREB', 74, 72, 73, 'Possession'),
  f('TUN', 'Tunisia', 'AFU', 'NORTH_AFRICAN_MAGHREB', 71, 68, 71, 'Balanced'),
  f('CIV', 'Ivory Coast', 'AFU', 'WEST_AFRICAN', 73, 75, 72, 'Direct'),
  f('MLI', 'Mali', 'AFU', 'WEST_AFRICAN', 70, 76, 70, 'HighPress'),
  f('RSA', 'South Africa', 'AFU', 'EAST_AFRICAN', 66, 67, 68, 'Possession'),

  // ASC
  f('IRN', 'Iran', 'ASC', 'ARABIC_MIDDLE_EASTERN', 72, 69, 72, 'Counter'),
  f('KSA', 'Saudi Arabia', 'ASC', 'ARABIC_MIDDLE_EASTERN', 69, 70, 71, 'Possession'),
  f('QAT', 'Qatar', 'ASC', 'ARABIC_MIDDLE_EASTERN', 68, 67, 70, 'Possession'),
  f('IRQ', 'Iraq', 'ASC', 'ARABIC_MIDDLE_EASTERN', 66, 66, 68, 'Counter'),
  f('UZB', 'Uzbekistan', 'ASC', 'EASTERN_EUROPEAN_SLAVIC', 67, 68, 67, 'Balanced'),
  f('CHN', 'China', 'ASC', 'EAST_ASIAN', 63, 64, 66, 'Balanced'),

  // OFU
  f('FIJ', 'Fiji', 'OFU', 'PACIFIC_OCEANIAN', 50, 50, 55, 'Direct'),
  f('NCL', 'New Caledonia', 'OFU', 'PACIFIC_OCEANIAN', 48, 48, 52, 'Direct'),
  f('SOL', 'Solomon Islands', 'OFU', 'PACIFIC_OCEANIAN', 47, 49, 51, 'Direct'),
  f('TAH', 'Tahiti', 'OFU', 'PACIFIC_OCEANIAN', 46, 47, 53, 'Possession'),
  f('VAN', 'Vanuatu', 'OFU', 'PACIFIC_OCEANIAN', 44, 46, 50, 'Direct'),
  f('PNG', 'Papua New Guinea', 'OFU', 'PACIFIC_OCEANIAN', 45, 47, 49, 'Direct'),
]
