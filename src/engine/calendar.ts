import type { Career, NewsItem } from './types'
import { WEEKS_PER_YEAR } from '@/data/constants'
import { RNG, deriveSeed } from './rng'
import { NATIONS_BY_ID } from '@/data/nations'

// Shell-level week advance. Increments the calendar (week 1..52, cycle year 1..4),
// applies scouting-freshness decay for uncovered players, and emits a small set
// of flavor news so the feed feels alive. The real per-week fixture resolution
// (Tier 1/2/3) and the living-world simulation arrive in later milestones; this
// shares the Career shape so they slot in without a rewrite.

export function advanceWeek(career: Career): Career {
  let week = career.week + 1
  let year = career.year
  if (week > WEEKS_PER_YEAR) {
    week = 1
    year = (year % 4) + 1 // cycle 1->2->3->4->1
  }

  // Freshness decays for players in uncovered leagues. With no coach assignments
  // yet, everyone drifts a little — exactly the scouting tension, surfaced early.
  const coveredLeagues = new Set(
    career.coaches.map((c) => c.leagueAssignment).filter((l): l is string => !!l),
  )
  const players = career.players.map((p) => {
    if (coveredLeagues.has(p.clubLeague)) {
      return p.freshness >= 100 ? p : { ...p, freshness: Math.min(100, p.freshness + 25) }
    }
    return p.freshness <= 0 ? p : { ...p, freshness: Math.max(0, p.freshness - 3) }
  })

  const news = generateWeeklyNews(career, year, week)

  return {
    ...career,
    week,
    year,
    players,
    coaches: career.coaches.map((c) => ({ ...c, targetedLookUsed: false })),
    news: [...news, ...career.news].slice(0, 60),
  }
}

function generateWeeklyNews(career: Career, year: number, week: number): NewsItem[] {
  const rng = new RNG(deriveSeed(career.seed, year * 100 + week))
  const nation = NATIONS_BY_ID[career.managerNationId]
  const out: NewsItem[] = []

  // 0..2 flavor items per week (placeholder bank until the News engine lands).
  const count = rng.int(0, 2)
  for (let i = 0; i < count; i++) {
    const player = rng.pick(career.players)
    const template = rng.pick(FLAVOR_TEMPLATES)
    out.push({
      id: `${year}-${week}-${i}-${rng.int(1000, 9999)}`,
      week,
      year,
      type: 'FLAVOR',
      magnitude: rng.range(0.2, 0.6),
      text: template
        .replace('{player}', player.name)
        .replace('{club}', player.club)
        .replace('{nation}', nation.name),
    })
  }
  return out
}

const FLAVOR_TEMPLATES = [
  '{player} put in a strong shift for {club} this week — the {nation} staff will have noted it.',
  'Quiet week on the international front, but {player} kept the headlines warm at {club}.',
  'Whispers around {club} that {player} is rounding into form at just the right time.',
  '{player} picked up a knock at {club}; nothing serious, but one to monitor.',
  'A standout display from {player} has supporters dreaming about the {nation} squad.',
]
