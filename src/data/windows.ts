// The international calendar: a fixed set of windows across the 52-week year.
// Outside windows, players are at their clubs. Each window has a match week and
// a registration DEADLINE the week before — once the deadline passes you can't
// change your 26 until after the window's match (NTM Tournament Structure).

export interface CalendarWindow {
  id: string
  label: string
  deadlineWeek: number // squad locks at the start of this week
  matchWeek: number // the window's match is played this week
}

// Five windows a year. (Summer tournament blocks arrive with the tournament
// milestone; these are the qualifying/friendly windows.)
export const WINDOWS: CalendarWindow[] = [
  { id: 'late-winter', label: 'Late Winter Window', deadlineWeek: 7, matchWeek: 8 },
  { id: 'spring', label: 'Spring Window', deadlineWeek: 20, matchWeek: 21 },
  { id: 'early-autumn', label: 'Early Autumn Window', deadlineWeek: 34, matchWeek: 35 },
  { id: 'october', label: 'October Window', deadlineWeek: 39, matchWeek: 40 },
  { id: 'november', label: 'November Window', deadlineWeek: 44, matchWeek: 45 },
]

const WEEKS_PER_YEAR = 52

// The next window whose match is still ahead this year, plus weeks until it.
// Wraps to the first window of next year when all this year's have passed.
export function upcomingWindow(week: number): { window: CalendarWindow; weeksAway: number; nextYear: boolean } {
  const future = WINDOWS.filter((w) => w.matchWeek >= week)
  if (future.length > 0) {
    const window = future[0]
    return { window, weeksAway: window.matchWeek - week, nextYear: false }
  }
  const window = WINDOWS[0]
  return { window, weeksAway: WEEKS_PER_YEAR - week + window.matchWeek, nextYear: true }
}

// The window whose match is played on exactly this week, if any.
export function windowAtWeek(week: number): CalendarWindow | null {
  return WINDOWS.find((w) => w.matchWeek === week) ?? null
}

// Is squad registration closed right now? Closed from the upcoming window's
// deadline week through its match week (this year only — not the wrap-around).
export function isRegistrationClosed(week: number): boolean {
  const { window, nextYear } = upcomingWindow(week)
  if (nextYear) return false
  return week >= window.deadlineWeek && week <= window.matchWeek
}

export function fixtureKey(season: number, windowId: string): string {
  return `${season}:${windowId}`
}
