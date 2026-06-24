import type { Career, NewsItem, Player } from './types'
import { WEEKS_PER_YEAR } from '@/data/constants'
import { RNG, deriveSeed } from './rng'
import { NATIONS_BY_ID } from '@/data/nations'
import { developPlayerWeek, agePlayerOneYear } from './development'
import { applyCoverageWeek } from './scouting'
import { generateYouthIntake } from './youth'

// The master week loop. Each week: the development engine moves real ability,
// scouting coverage refreshes (or fails to refresh) reads, and the world emits
// news. On the season rollover (week 52 -> 1) everyone ages a year and a silent
// youth intake enters the manager's pool. Competitive fixtures / tournaments
// wire in here in a later milestone.

export function advanceWeek(career: Career): Career {
  let week = career.week + 1
  let year = career.year
  let season = career.season
  let rolledSeason = false
  if (week > WEEKS_PER_YEAR) {
    week = 1
    year = (year % 4) + 1
    season += 1
    rolledSeason = true
  }

  const rng = new RNG(deriveSeed(career.seed, season, week))
  const news: NewsItem[] = []

  // 1) Development moves REAL ability invisibly.
  let players = career.players.map((p) => developPlayerWeek(p, rng))

  // 2) Season rollover: age everyone, retire the old, bring in a new youth class.
  if (rolledSeason) {
    players = players.map(agePlayerOneYear)
    const retiring = players.filter((p) => p.age >= 36 && rng.bool(0.5 + (p.age - 36) * 0.15))
    for (const r of retiring.slice(0, 3)) {
      news.push(mkNews(`retire-${r.id}-${season}`, year, week, 'RETIREMENT', 0.5, `${r.name} has announced his retirement from international football.`))
    }
    const retiringIds = new Set(retiring.map((r) => r.id))
    players = players.filter((p) => !retiringIds.has(p.id))

    const nation = NATIONS_BY_ID[career.managerNationId]
    const intake = generateYouthIntake(nation, season, career.seed)
    players = [...players, ...intake.players]
    if (intake.golden) {
      news.push(
        mkNews(
          `golden-${season}`,
          year,
          week,
          'GOLDEN_GENERATION',
          0.9,
          `Excitement is building around ${nation.name}: this year's crop of teenagers is being called a golden generation. Time will tell — and the smart move is to start watching closely.`,
        ),
      )
    }
  }

  // 3) Coverage resolution: covered leagues sharpen reads, the rest drift fuzzy.
  players = applyCoverageWeek(players, career.coaches)

  // 4) News: emerging-youth hype (the lead) + a little flavor.
  news.push(...hypeNews(players, career, year, week, rng))
  news.push(...flavorNews(players, career, year, week, rng))

  return {
    ...career,
    week,
    year,
    season,
    players,
    coaches: career.coaches.map((c) => ({ ...c, targetedLookUsed: false })),
    news: [...news, ...career.news].slice(0, 80),
  }
}

// Hype is driven by a player's REAL hidden ability, but never reveals the
// number — it's the world telling you to go and look. Capped to avoid a
// firehose. The actionable "send a scout" lands with the discovery milestone.
function hypeNews(players: Player[], career: Career, year: number, week: number, rng: RNG): NewsItem[] {
  const candidates = players.filter((p) => p.age <= 21 && p.potential >= 78)
  const out: NewsItem[] = []
  for (const p of candidates) {
    // higher potential + good form -> more likely to flash promise this week
    const chance = 0.015 + (p.potential - 78) * 0.002 + (p.form - 60) * 0.0008
    if (rng.next() < chance) {
      out.push(
        mkNews(
          `hype-${p.id}-${career.season}-${week}`,
          year,
          week,
          'WONDERKID_EMERGING',
          0.85,
          rng.pick(HYPE_TEMPLATES).replace('{player}', p.name).replace('{age}', String(p.age)).replace('{club}', p.club).replace('{league}', p.clubLeague),
        ),
      )
      if (out.length >= 1) break // at most one wonderkid hype per week
    }
  }
  return out
}

function flavorNews(players: Player[], career: Career, year: number, week: number, rng: RNG): NewsItem[] {
  if (players.length === 0) return []
  const out: NewsItem[] = []
  const count = rng.int(0, 1)
  const nation = NATIONS_BY_ID[career.managerNationId]
  for (let i = 0; i < count; i++) {
    const p = rng.pick(players)
    out.push(
      mkNews(
        `flavor-${year}-${week}-${i}-${rng.int(1000, 9999)}`,
        year,
        week,
        'FLAVOR',
        rng.range(0.2, 0.5),
        rng
          .pick(FLAVOR_TEMPLATES)
          .replace('{player}', p.name)
          .replace('{club}', p.club)
          .replace('{nation}', nation.name),
      ),
    )
  }
  return out
}

function mkNews(id: string, year: number, week: number, type: string, magnitude: number, text: string): NewsItem {
  return { id, year, week, type, magnitude, text }
}

const HYPE_TEMPLATES = [
  '{player}, just {age}, is the name on everyone’s lips after lighting up the {league}.',
  'A teenager at {club} is turning heads: {age}-year-old {player} can’t stop impressing.',
  'Is {player} the real thing? The {age}-year-old has forced his way into the conversation at {club}.',
  'Scouts are circling {club} after a string of standout displays from {age}-year-old {player}.',
  '{player} ({age}) is the talk of the {league} — worth a closer look before everyone else gets there.',
]

const FLAVOR_TEMPLATES = [
  '{player} put in a strong shift for {club} this week — the {nation} staff will have noted it.',
  'Quiet week internationally, but {player} kept the headlines warm at {club}.',
  'Whispers around {club} that {player} is rounding into form at just the right time.',
  '{player} picked up a knock at {club}; nothing serious, but one to monitor.',
  'A standout display from {player} has supporters dreaming about the {nation} squad.',
]
