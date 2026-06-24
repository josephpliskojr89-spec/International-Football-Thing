import type { Position } from '@/engine/types'

// Curated, commonly used formations. Each slot has a pitch coordinate
// (x,y as 0..100, GK at the bottom) for the formation view, and the position
// group it belongs to — which the Match Engine uses to decide who lands in
// which zone (Attack / Midfield / Defense). The tactical effect is emergent
// from how many slots each formation places in each zone.

export interface FormationSlot {
  id: string
  position: Position
  x: number // 0 (left) .. 100 (right)
  y: number // 0 (own goal) .. 100 (opponent goal)
}

export interface Formation {
  id: string
  label: string
  slots: FormationSlot[]
}

const gk: FormationSlot = { id: 'GK', position: 'GK', x: 50, y: 6 }

function back4(): FormationSlot[] {
  return [
    { id: 'LB', position: 'DF', x: 16, y: 26 },
    { id: 'LCB', position: 'DF', x: 38, y: 22 },
    { id: 'RCB', position: 'DF', x: 62, y: 22 },
    { id: 'RB', position: 'DF', x: 84, y: 26 },
  ]
}
function back5(): FormationSlot[] {
  return [
    { id: 'LWB', position: 'DF', x: 10, y: 32 },
    { id: 'LCB', position: 'DF', x: 30, y: 20 },
    { id: 'CB', position: 'DF', x: 50, y: 18 },
    { id: 'RCB', position: 'DF', x: 70, y: 20 },
    { id: 'RWB', position: 'DF', x: 90, y: 32 },
  ]
}
function back3(): FormationSlot[] {
  return [
    { id: 'LCB', position: 'DF', x: 30, y: 22 },
    { id: 'CB', position: 'DF', x: 50, y: 20 },
    { id: 'RCB', position: 'DF', x: 70, y: 22 },
  ]
}

export const FORMATIONS: Formation[] = [
  {
    id: '4-4-2',
    label: '4-4-2',
    slots: [
      gk,
      ...back4(),
      { id: 'LM', position: 'MF', x: 16, y: 54 },
      { id: 'LCM', position: 'MF', x: 40, y: 50 },
      { id: 'RCM', position: 'MF', x: 60, y: 50 },
      { id: 'RM', position: 'MF', x: 84, y: 54 },
      { id: 'LST', position: 'FW', x: 40, y: 82 },
      { id: 'RST', position: 'FW', x: 60, y: 82 },
    ],
  },
  {
    id: '4-3-3',
    label: '4-3-3',
    slots: [
      gk,
      ...back4(),
      { id: 'LCM', position: 'MF', x: 32, y: 50 },
      { id: 'CM', position: 'MF', x: 50, y: 46 },
      { id: 'RCM', position: 'MF', x: 68, y: 50 },
      { id: 'LW', position: 'FW', x: 18, y: 80 },
      { id: 'ST', position: 'FW', x: 50, y: 84 },
      { id: 'RW', position: 'FW', x: 82, y: 80 },
    ],
  },
  {
    id: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      gk,
      ...back4(),
      { id: 'LDM', position: 'MF', x: 38, y: 42 },
      { id: 'RDM', position: 'MF', x: 62, y: 42 },
      { id: 'LAM', position: 'MF', x: 22, y: 66 },
      { id: 'CAM', position: 'MF', x: 50, y: 66 },
      { id: 'RAM', position: 'MF', x: 78, y: 66 },
      { id: 'ST', position: 'FW', x: 50, y: 86 },
    ],
  },
  {
    id: '5-4-1',
    label: '5-4-1',
    slots: [
      gk,
      ...back5(),
      { id: 'LM', position: 'MF', x: 18, y: 56 },
      { id: 'LCM', position: 'MF', x: 40, y: 52 },
      { id: 'RCM', position: 'MF', x: 60, y: 52 },
      { id: 'RM', position: 'MF', x: 82, y: 56 },
      { id: 'ST', position: 'FW', x: 50, y: 84 },
    ],
  },
  {
    id: '5-3-2',
    label: '5-3-2',
    slots: [
      gk,
      ...back5(),
      { id: 'LCM', position: 'MF', x: 32, y: 54 },
      { id: 'CM', position: 'MF', x: 50, y: 50 },
      { id: 'RCM', position: 'MF', x: 68, y: 54 },
      { id: 'LST', position: 'FW', x: 40, y: 82 },
      { id: 'RST', position: 'FW', x: 60, y: 82 },
    ],
  },
  {
    id: '3-5-2',
    label: '3-5-2',
    slots: [
      gk,
      ...back3(),
      { id: 'LWB', position: 'MF', x: 12, y: 50 },
      { id: 'LCM', position: 'MF', x: 36, y: 50 },
      { id: 'CM', position: 'MF', x: 50, y: 46 },
      { id: 'RCM', position: 'MF', x: 64, y: 50 },
      { id: 'RWB', position: 'MF', x: 88, y: 50 },
      { id: 'LST', position: 'FW', x: 40, y: 82 },
      { id: 'RST', position: 'FW', x: 60, y: 82 },
    ],
  },
  {
    id: '3-4-1-2',
    label: '3-4-1-2',
    slots: [
      gk,
      ...back3(),
      { id: 'LM', position: 'MF', x: 16, y: 50 },
      { id: 'LCM', position: 'MF', x: 40, y: 46 },
      { id: 'RCM', position: 'MF', x: 60, y: 46 },
      { id: 'RM', position: 'MF', x: 84, y: 50 },
      { id: 'CAM', position: 'MF', x: 50, y: 66 },
      { id: 'LST', position: 'FW', x: 40, y: 84 },
      { id: 'RST', position: 'FW', x: 60, y: 84 },
    ],
  },
]

export const FORMATIONS_BY_ID: Record<string, Formation> = Object.fromEntries(
  FORMATIONS.map((f) => [f.id, f]),
)

export const DEFAULT_FORMATION = '4-3-3'
