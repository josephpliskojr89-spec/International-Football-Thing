import type { Career, NewsItem, Player, WorldState } from './types'
import { WEEKS_PER_YEAR } from '@/data/constants'
import { RNG, deriveSeed } from './rng'
import { ALL_NATIONS_BY_ID, NATIONS_BY_ID, CONFEDERATION_NAMES } from '@/data/nations'
import { windowAtWeek, displayYear } from '@/data/windows'
import { developPlayerWeek, agePlayerOneYear } from './development'
import { assignClub } from './playerGen'
import { LEAGUES_BY_NAME } from '@/data/leagues'
import { clubArc, arcFormDrift, arcPhrase, arcOutcome } from './clubs'
import { applyCoverageWeek } from './scouting'
import { generateYouthIntake } from './youth'
import { autoFillLineup } from './career'
import { createCampaign } from './campaign'
import { pickWorldCupHost } from './tournament'
import { worldPlayerOfTheYear } from './awards'
import { objectiveMet, clampRep, reputationLabel, SACK_THRESHOLD, sackOffers, poachOffer, cycleObjective } from './manager'
import { SQUAD_SIZE } from './fixtures'
import { playBackgroundWindow, playForeignContinentals, seasonTick, worldRanking, ratingOf } from './world'

// The master week loop. Each week: the development engine moves real ability,
// scouting coverage refreshes (or fails to refresh) reads, the REST of the
// world plays its own football (moving the live ratings), and the world emits
// news. On the season rollover (week 52 -> 1) everyone ages a year, a silent
// youth intake enters the manager's pool, and nation ratings revert a touch
// toward their cultural base.

// Week 32 = the last finals round week: in a Continental year, that's when the
// OTHER confederations' championships conclude too.
const FOREIGN_CONTINENTALS_WEEK = 32

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

  // 0) The rest of the world plays. On window match weeks, nations outside the
  // manager's group meet in their own qualifiers (lite-simmed, ratings move).
  // In a Continental year the other confederations crown champions at week 32.
  let world = career.world
  const history = [...career.history]
  let legends = career.legends
  if (windowAtWeek(week)) {
    const busy = new Set(career.campaign.groupNationIds)
    world = playBackgroundWindow(world, career.seed, season, week, busy)
  }
  if (year === 1 && week === FOREIGN_CONTINENTALS_WEEK) {
    const conf = NATIONS_BY_ID[career.managerNationId].confederation
    const foreign = playForeignContinentals(world, career.seed, season, conf)
    world = foreign.world
    if (foreign.champions.length > 0) {
      const line = foreign.champions
        .map((c) => `${ALL_NATIONS_BY_ID[c.championId].name} (${CONFEDERATION_NAMES[c.confederation as keyof typeof CONFEDERATION_NAMES] ?? c.confederation})`)
        .join(', ')
      news.push(
        mkNews(`foreign-continentals-${season}`, year, week, 'CONTINENTAL', 0.6,
          `Continental champions crowned around the world: ${line}.`),
      )
      for (const c of foreign.champions) {
        history.push({
          season,
          type: 'FOREIGN_CONTINENTAL',
          text: `${ALL_NATIONS_BY_ID[c.championId].name} win the ${CONFEDERATION_NAMES[c.confederation as keyof typeof CONFEDERATION_NAMES] ?? c.confederation} Championship`,
          nationId: c.championId,
        })
      }
    }
  }
  if (rolledSeason) {
    news.push(...rankingMovementNews(world, career, year))
    const tick = seasonTick(world, career.seed, season)
    world = tick.world
    for (const [i, text] of tick.eraNews.entries()) {
      news.push(mkNews(`era-${season}-${i}`, year, week, 'ERA', 0.7, text))
    }
    // Player of the Year — the world's best, crowned every season's end.
    const poty = worldPlayerOfTheYear(career, season - 1)
    news.push(
      mkNews(`poty-${season}`, year, week, 'PLAYER_OF_YEAR', poty.isYours ? 1 : 0.6,
        poty.isYours
          ? `${poty.name} is the World Player of the Year — YOUR ${poty.name}. A golden night for ${NATIONS_BY_ID[career.managerNationId].name}.`
          : `${poty.name} (${ALL_NATIONS_BY_ID[poty.nationId]?.name ?? poty.nationId}) is named World Player of the Year.`),
    )
    history.push({
      season: season - 1,
      type: 'POTY',
      text: `${poty.name} (${ALL_NATIONS_BY_ID[poty.nationId]?.name ?? poty.nationId}) — World Player of the Year`,
      nationId: poty.nationId,
      managerMoment: poty.isYours,
    })
  }

  // 1) Development moves REAL ability invisibly. Also age the memory of any
  // in-person read so a stale call-up eventually reverts to a range. Injured
  // players heal one week at a time.
  let players = career.players.map((p) => {
    let next = developPlayerWeek(p, rng)
    if (p.inPersonOverall !== null) next = { ...next, inPersonWeeks: p.inPersonWeeks + 1 }
    if (p.injuredWeeks > 0) next = { ...next, injuredWeeks: p.injuredWeeks - 1 }
    // A club's season seeps into a player: title races lift, dogfights grind.
    const drift = arcFormDrift(clubArc(p.club, season, career.seed))
    if (drift !== 0) next = { ...next, form: Math.max(20, Math.min(99, next.form + drift)) }
    return next
  })

  // 2) Season rollover: age everyone, retire the old, bring in a new youth class.
  if (rolledSeason) {
    players = players.map(agePlayerOneYear)
    const retiring = players.filter((p) => p.announcedRetirement || (p.age >= 36 && rng.bool(0.5 + (p.age - 36) * 0.15)))
    for (const r of retiring.slice(0, 3)) {
      news.push(mkNews(`retire-${r.id}-${season}`, year, week, 'RETIREMENT', 0.5, `${r.name} has announced his retirement from international football.`))
    }
    // Departing greats enter the pantheon — caps and goals remembered forever.
    for (const r of retiring) {
      if (r.caps >= 25 || r.intlGoals >= 10) {
        legends = [...legends, { name: r.name, position: r.position, caps: r.caps, goals: r.intlGoals, retiredSeason: season - 1, peakOverall: Math.round(Math.max(r.overall, r.knownOverall)) }]
        history.push({
          season: season - 1,
          type: 'LEGEND',
          text: `${r.name} retires: ${r.caps} caps, ${r.intlGoals} goals for ${NATIONS_BY_ID[career.managerNationId].name}`,
          nationId: career.managerNationId,
          managerMoment: true,
        })
        news.push(mkNews(`legend-${r.id}`, year, week, 'LEGEND', 0.85, `A legend bows out: ${r.name} retires with ${r.caps} caps and ${r.intlGoals} international goals. His shirt will weigh heavier on the next man.`))
      }
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

  // 2b-ii) Season fallout & farewells (rollover only).
  if (rolledSeason) {
    // One last dance: a veteran may tell you this season is his final one.
    const annRng = new RNG(deriveSeed(career.seed, season, 0xfa2e))
    const vets = players.filter(
      (p) => !p.announcedRetirement && career.registeredSquad.includes(p.id) && ((p.age >= 33 && p.caps >= 40) || p.age >= 35),
    )
    if (vets.length > 0 && annRng.bool(0.5)) {
      const v = vets[annRng.int(0, vets.length - 1)]
      players = players.map((p) => (p.id === v.id ? { ...p, announcedRetirement: true } : p))
      news.push(mkNews(`lastdance-${v.id}`, year, week, 'FAREWELL', 0.85,
        `${v.name} (${v.caps} caps) has told you privately: this is his last year. Whatever this season holds, it's his final dance — send him out right.`))
    }

    // Club season verdicts: your players' clubs won titles or went down.
    const clubs = [...new Set(players.filter((p) => career.registeredSquad.includes(p.id)).map((p) => p.club))]
    let clubNews = 0
    for (const club of clubs) {
      if (clubNews >= 2) break
      const outcome = arcOutcome(club, season - 1, career.seed)
      if (!outcome) continue
      const affected = players.filter((p) => p.club === club && career.registeredSquad.includes(p.id))
      if (affected.length === 0) continue
      clubNews++
      const names = affected.slice(0, 2).map((p) => p.name).join(' and ')
      const lift = outcome === 'CHAMPIONS' ? 6 : -6
      players = players.map((p) => (p.club === club ? { ...p, form: Math.max(20, Math.min(99, p.form + lift)) } : p))
      news.push(mkNews(`clubseason-${club}-${season}`, year, week, 'CLUB_SEASON', 0.6,
        outcome === 'CHAMPIONS'
          ? `${club} are champions — ${names} will arrive at the next camp with medals and swagger.`
          : `${club} have been RELEGATED. ${names} will turn up carrying a bruising year; handle with care.`))
    }
  }

  // 2c) The rival-nation clock. Every uncommitted dual national is being
  // courted by his OTHER country too. The better he is — and the stronger the
  // rival — the harder they push. Ignore him long enough and one week the news
  // simply reads: he's gone.
  const lostIds = new Set<string>()
  {
    const courtRng = new RNG(deriveSeed(career.seed, season, week, 0xc0e7))
    const myRating = ratingOf(world, career.managerNationId)
    players = players.map((p) => {
      if (p.eligibleNations.length < 2 || p.eligibilityState === 'CAP_TIED' || p.eligibilityState === 'LOST') return p
      const rivalId = p.eligibleNations.find((id) => id !== career.managerNationId)
      if (!rivalId) return p
      const rivalRating = ratingOf(world, rivalId)
      const interest = Math.min(
        0.2,
        Math.max(0.02, 0.05 + (p.potential - 70) * 0.004 + (rivalRating - myRating) * 0.003),
      )
      if (!courtRng.bool(interest)) return p
      const prevRival = p.leans[rivalId] ?? 50
      const myLean = p.leans[career.managerNationId] ?? 50
      const newRival = Math.min(100, prevRival + courtRng.range(2, 6))
      const leans = { ...p.leans, [rivalId]: newRival }
      // Crossing the danger line makes the papers — your warning shot.
      if (prevRival < 62 && newRival >= 62 && newRival > myLean) {
        news.push(mkNews(`court-warn-${p.id}-${season}-${week}`, year, week, 'COURTING', 0.75,
          `${ALL_NATIONS_BY_ID[rivalId].name} are pushing hard for ${p.name}. His agent says he "feels wanted over there." The clock is ticking.`))
      }
      // The declaration: rival lean high AND clearly ahead of yours.
      if (newRival >= 72 && newRival > myLean + 8 && courtRng.bool(0.25)) {
        lostIds.add(p.id)
        news.push(mkNews(`lost-${p.id}-${season}`, year, week, 'DECLARED', 0.9,
          `${p.name} has declared for ${ALL_NATIONS_BY_ID[rivalId].name}. He will never wear your shirt. The ones you don't call get called by someone else.`))
        return { ...p, leans, eligibilityState: 'LOST' as const, tiedNation: rivalId }
      }
      return { ...p, leans }
    })
  }

  // 2b) Cycle machinery on rollover: a fresh qualifying campaign as year 2
  // opens; a new World Cup host announced as each cycle begins.
  let campaign = career.campaign
  let wcHostId = career.wcHostId
  if (rolledSeason && year === 2) {
    campaign = createCampaign(career.managerNationId, career.seed, campaign.cycle + 1, world)
    news.push(mkNews(`quali-draw-${season}`, year, week, 'DRAW', 0.75,
      `The World Cup qualifying draw is made. ${groupSummary(campaign, career.managerNationId)} Ten matchdays. Top ${campaign.qualifyCount} go to the finals.`))
  }
  // Cycle verdict: as a new cycle opens, the board rules on the one just done.
  let { reputation, objective, lastWcOutcome, lastCampaignPosition, offers, sackedFrom } = career
  if (rolledSeason && year === 1) {
    const met = objectiveMet(career)
    if (career.objective) {
      reputation = clampRep(reputation + (met ? 8 : -12))
      news.push(mkNews(`verdict-${season}`, year, week, 'BOARD', met ? 0.8 : 0.95,
        met
          ? `The board is satisfied: "${career.objective.text}" — delivered. Your standing grows (${reputationLabel(reputation)}).`
          : `The board's demand — "${career.objective.text}" — was NOT met. Patience is thinning (${reputationLabel(reputation)}).`))
      if (!met && reputation < SACK_THRESHOLD) {
        sackedFrom = career.managerNationId
        offers = sackOffers(career, career.seed)
        news.push(mkNews(`sacked-${season}`, year, week, 'SACKED', 1,
          `SACKED. ${NATIONS_BY_ID[career.managerNationId].name} have dismissed you. But the phone is already ringing — ${offers.map((id) => ALL_NATIONS_BY_ID[id]?.name).join(', ')} want to talk.`))
        history.push({ season: season - 1, type: 'SACKED', text: `${career.managerName} sacked by ${NATIONS_BY_ID[career.managerNationId].name}`, nationId: career.managerNationId, managerMoment: true })
      } else if (met) {
        const suitor = poachOffer({ ...career, reputation }, career.seed)
        if (suitor) {
          offers = [suitor]
          news.push(mkNews(`poach-${season}`, year, week, 'APPROACH', 0.9,
            `${ALL_NATIONS_BY_ID[suitor].name} want YOU. Their board has made a formal approach. Loyalty or ambition — check your offers.`))
        }
      }
    }
    objective = cycleObjective(world, sackedFrom ?? career.managerNationId)
    if (!sackedFrom) {
      news.push(mkNews(`objective-${season}`, year, week, 'BOARD', 0.7, `The board sets the bar for the new cycle: "${objective.text}"`))
    }
    lastWcOutcome = null
    lastCampaignPosition = null
    wcHostId = pickWorldCupHost(career.managerNationId, career.seed, Math.ceil(season / 4) + 1, career.wcHostId)
    const host = ALL_NATIONS_BY_ID[wcHostId]
    const isYou = wcHostId === career.managerNationId
    news.push(mkNews(`host-${season}`, year, week, 'HOST', isYou ? 1 : 0.7,
      isYou
        ? `IT'S COMING HOME TO YOU: ${host.name} will host the ${displayYear(season + 3)} World Cup. Automatic qualification — and a nation expecting everything.`
        : `${host.name} are awarded the ${displayYear(season + 3)} World Cup. Expect them at full strength on home soil.`))
    history.push({ season, type: 'HOST', text: `${host.name} awarded the ${displayYear(season + 3)} World Cup`, nationId: wcHostId, managerMoment: isYou })
  }

  // 3) Coverage resolution: covered leagues sharpen reads, the rest drift fuzzy.
  players = applyCoverageWeek(players, career.coaches)

  // 4) News: emerging-youth hype (the lead) + a little flavor.
  news.push(...hypeNews(players, career, year, week, rng))
  news.push(...flavorNews(players, career, year, week, rng))

  // 4b) Club watch: what your players did for their clubs this weekend. This
  // is what the weeks BETWEEN windows are made of — you following your people
  // from a distance. Skipped on international match weeks (they're with you).
  if (!windowAtWeek(week)) {
    news.push(...clubWatchNews(players, career, year, week, rng))
  }

  // 4c) Club duty bites: occasionally a registered player gets hurt at his
  // club. The phone call every international manager dreads.
  {
    const inSquad = new Set(career.registeredSquad)
    players = players.map((p) => {
      if (!inSquad.has(p.id) || p.injuredWeeks > 0) return p
      if (!rng.bool(0.006 + p.injuryRisk * 0.0001)) return p
      // Most knocks are short. Once in a while it's the one you dread.
      const severe = rng.bool(0.08)
      const weeks = severe ? rng.int(10, 20) : rng.bool(0.6) ? rng.int(1, 2) : rng.int(3, 5)
      news.push(mkNews(`club-inj-${p.id}-${season}-${week}`, year, week, 'INJURY', severe ? 0.95 : weeks >= 3 ? 0.75 : 0.55,
        severe
          ? `Devastating news from ${p.club}: ${p.name} has ruptured knee ligaments. He is out for months — around ${weeks} weeks. Plans change today.`
          : weeks >= 3
            ? `Bad news from ${p.club}: ${p.name} has been injured in league action and faces around ${weeks} weeks out.`
            : `${p.name} picked up a knock playing for ${p.club} — expected back within ${weeks === 1 ? 'the week' : `${weeks} weeks`}.`))
      return { ...p, injuredWeeks: weeks }
    })
  }

  // 4d) Transfer windows (weeks 2-4 in winter, 33-35 in late summer): players
  // whose club no longer matches their level MOVE. The wonderkid earns his big
  // transfer; the fading veteran slides down a tier — and if he leaves a league
  // your coaches cover, your read on him starts to blur. Real consequences.
  if ((week >= 2 && week <= 4) || (week >= 33 && week <= 35)) {
    const txRng = new RNG(deriveSeed(career.seed, season, week, 0x7a4))
    const movers = players
      .filter((p) => p.eligibilityState !== 'LOST')
      .filter((p) => {
        const tier = LEAGUES_BY_NAME[p.clubLeague]?.tier ?? 4 // generic counts as 4
        // Outgrown his club: good player stuck below his level.
        if (p.overall >= 82 && tier >= 3) return true
        if (p.overall >= 85 && tier === 2) return true
        // Or the opposite: past it at the top level.
        if (p.overall < 68 && tier === 1 && p.age >= 30) return true
        return false
      })
    if (movers.length > 0 && txRng.bool(0.55)) {
      const p = movers[txRng.int(0, movers.length - 1)]
      const dest = assignClub(p.nationality, p.overall, txRng)
      if (dest.clubLeague !== p.clubLeague || dest.club !== p.club) {
        const oldClub = p.club
        const stepUp = (LEAGUES_BY_NAME[dest.clubLeague]?.tier ?? 4) < (LEAGUES_BY_NAME[p.clubLeague]?.tier ?? 4)
        // A step up risks the bench at first; a step down usually buys minutes.
        const ptShift = stepUp ? txRng.range(-0.18, 0.05) : txRng.range(0, 0.12)
        players = players.map((x) =>
          x.id === p.id
            ? { ...x, ...dest, playingTime: Math.max(0.1, Math.min(1, x.playingTime + ptShift)), freshness: Math.max(20, x.freshness - 10) }
            : x,
        )
        news.push(mkNews(`transfer-${p.id}-${season}-${week}`, year, week, 'TRANSFER', stepUp ? 0.7 : 0.5,
          stepUp
            ? `TRANSFER: ${p.name} completes his big move — ${oldClub} to ${dest.club} (${dest.clubLeague}). A step up in class; watch whether he plays.`
            : `Transfer: ${p.name} leaves ${oldClub} for ${dest.club} (${dest.clubLeague}). Regular football should follow — your scouts will need to find the new ground, though.`))
      }
    }
  }

  // 4e) Camp arrivals: on a registration deadline eve, the staff's word on who's
  // flying and who's flat — read the room before you pick the 26.
  {
    const nextWindow = windowAtWeek(week + 1)
    if (nextWindow) {
      const inSquad = players.filter((p) => career.registeredSquad.includes(p.id) && p.injuredWeeks === 0)
      if (inSquad.length >= 2) {
        const hot = [...inSquad].sort((a, b) => b.form - a.form)[0]
        const cold = [...inSquad].sort((a, b) => a.form - b.form)[0]
        if (hot.form >= 70) {
          news.push(mkNews(`camp-hot-${season}-${week}`, year, week, 'CAMP', 0.5,
            `Camp word: ${hot.name} arrives flying — ${hot.club} form has him full of belief. The staff say build around him this window.`))
        }
        if (cold.form <= 45 && cold.id !== hot.id) {
          news.push(mkNews(`camp-cold-${season}-${week}`, year, week, 'CAMP', 0.5,
            `Camp word: ${cold.name} turns up low on confidence after a rough spell at ${cold.club}. A quiet window — or a quiet bench — might serve him.`))
        }
      }
    }
  }

  // 5) On rollover (retirements) or a mid-season defection (a LOST dual
  // national), squad members may have vanished — reconcile the registered 26 /
  // XI / bench / focal point so we never field a dead player id.
  let { registeredSquad, lineup, bench, tactics } = career
  if (rolledSeason || lostIds.size > 0) {
    const validIds = new Set(players.filter((p) => p.eligibilityState !== 'LOST').map((p) => p.id))
    registeredSquad = registeredSquad.filter((id) => validIds.has(id))
    // Top up any vacancies left by retirements with the best available pool
    // players (this is where promoted youth get their first call-up).
    if (registeredSquad.length < SQUAD_SIZE) {
      const inSquad = new Set(registeredSquad)
      const fill = players.filter((p) => !inSquad.has(p.id) && p.eligibilityState !== 'LOST').sort((a, b) => b.overall - a.overall)
      for (const p of fill) {
        if (registeredSquad.length >= SQUAD_SIZE) break
        registeredSquad.push(p.id)
      }
    }
    const squadPlayers = players.filter((p) => registeredSquad.includes(p.id))
    lineup = autoFillLineup(squadPlayers, career.formation, career.style)
    const xiIds = Object.values(lineup).filter(Boolean) as string[]
    bench = registeredSquad.filter((id) => !xiIds.includes(id))
    if (tactics.focalPointId && !xiIds.includes(tactics.focalPointId)) {
      tactics = { ...tactics, focalPointId: null }
    }
  }

  return {
    ...career,
    week,
    year,
    season,
    players,
    world,
    campaign,
    wcHostId,
    history,
    legends,
    reputation,
    objective,
    lastWcOutcome,
    lastCampaignPosition,
    offers,
    sackedFrom,
    registeredSquad,
    lineup,
    bench,
    tactics,
    // Targeted looks persist across weeks; they refresh per inter-window period
    // (reset when a window match is played), not every week.
    coaches: career.coaches,
    // A finished/old finals tournament is cleared when a new cycle year begins.
    tournament: rolledSeason ? null : career.tournament,
    news: [...news, ...career.news].slice(0, 80),
  }
}

// "Drawn with Spain, Serbia, ..." — the group in one breath.
function groupSummary(campaign: Career['campaign'], myId: string): string {
  const others = campaign.groupNationIds.filter((id) => id !== myId).map((id) => ALL_NATIONS_BY_ID[id]?.name ?? id)
  return `Drawn with ${others.join(', ')}.`
}

// At season's end, call out the year's biggest climber and faller among the
// world's upper tier (and always note the manager's own movement if notable).
function rankingMovementNews(world: WorldState, career: Career, year: number): NewsItem[] {
  const ranked = worldRanking(world)
  const notable = ranked.filter((r) => r.rank <= 25 && r.nation.isPlayable)
  const out: NewsItem[] = []

  const riser = [...notable].sort((a, b) => b.movement - a.movement)[0]
  if (riser && riser.movement >= 3) {
    out.push(
      mkNews(`riser-${career.season}`, year, 1, 'RANKINGS', 0.5,
        `${riser.nation.name} are the year's big climbers, up ${riser.movement} places to ${ordinal(riser.rank)} in the world.`),
    )
  }
  const faller = [...notable].sort((a, b) => a.movement - b.movement)[0]
  if (faller && faller.movement <= -3 && faller.nation.id !== riser?.nation.id) {
    out.push(
      mkNews(`faller-${career.season}`, year, 1, 'RANKINGS', 0.45,
        `A year to forget for ${faller.nation.name}: down ${-faller.movement} places to ${ordinal(faller.rank)}.`),
    )
  }

  const mine = ranked.find((r) => r.nation.id === career.managerNationId)
  if (mine && Math.abs(mine.movement) >= 2 && mine.nation.id !== riser?.nation.id && mine.nation.id !== faller?.nation.id) {
    out.push(
      mkNews(`myrank-${career.season}`, year, 1, 'RANKINGS', 0.55,
        mine.movement > 0
          ? `${mine.nation.name} end the year ${ordinal(mine.rank)} in the world — up ${mine.movement} places. The project is working.`
          : `${mine.nation.name} slip to ${ordinal(mine.rank)} in the world rankings. Questions are being asked.`),
    )
  }
  return out
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Hype is driven by a player's REAL hidden ability, but never reveals the
// number — it's the world telling you to go and look. Capped to avoid a
// firehose. Carries a tappable "send a scout" action when he isn't already a
// sharp read in your pool.
function hypeNews(players: Player[], career: Career, year: number, week: number, rng: RNG): NewsItem[] {
  // Hype is form-driven, so a hot mediocre teenager (a flat-track bully) can get
  // hyped alongside genuine gems — that's exactly what scouting separates.
  const candidates = players.filter((p) => p.age <= 21 && p.form >= 70 && p.potential >= 68)
  const out: NewsItem[] = []
  for (const p of candidates) {
    const chance = 0.01 + (p.form - 70) * 0.0016 + (p.potential - 68) * 0.0006
    if (rng.next() < chance) {
      const item = mkNews(
        `hype-${p.id}-${career.season}-${week}`,
        year,
        week,
        'WONDERKID_EMERGING',
        0.85,
        rng.pick(HYPE_TEMPLATES).replace('{player}', p.name).replace('{age}', String(p.age)).replace('{club}', p.club).replace('{league}', p.clubLeague),
      )
      item.subjectId = p.id
      // Offer a scout look unless you already have a sharp read on him.
      if (p.freshness < 70 && p.inPersonOverall === null) item.action = 'SEND_SCOUT'
      out.push(item)
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

// Two dispatches a week from the club game, weighted toward YOUR 26 and the
// stars — goals, clean sheets, bench worries, form wobbles. Pure flavor with
// teeth: it reads freshness/form/playing time, so it doubles as soft scouting.
function clubWatchNews(players: Player[], career: Career, year: number, week: number, rng: RNG): NewsItem[] {
  if (players.length === 0) return []
  const inSquad = new Set(career.registeredSquad)
  // Weighted pool: squad members count triple, elite reads count double.
  const weighted: Player[] = []
  for (const p of players) {
    if (p.eligibilityState === 'LOST' || p.injuredWeeks > 0) continue
    weighted.push(p)
    if (inSquad.has(p.id)) weighted.push(p, p)
    if (p.knownOverall >= 80) weighted.push(p)
  }
  if (weighted.length === 0) return []

  const out: NewsItem[] = []
  const used = new Set<string>()
  for (let i = 0; i < 2; i++) {
    const p = rng.pick(weighted)
    if (used.has(p.id)) continue
    used.add(p.id)
    const arc = clubArc(p.club, career.season, career.seed)
    const line = rng.bool(0.35) && arc !== 'MID' ? `${clubLine(p, rng)} (${arcPhrase(arc)}.)` : clubLine(p, rng)
    out.push(mkNews(`clubwatch-${p.id}-${year}-${week}`, year, week, 'CLUB_WATCH', 0.35, line))
  }
  return out
}

function clubLine(p: Player, rng: RNG): string {
  if (p.playingTime < 0.35) {
    return rng.pick([
      `${p.name} watched from the bench again at ${p.club}. The minutes just aren't coming — and it shows in his sharpness.`,
      `Still no start for ${p.name} at ${p.club}. A player you can't watch play is a player you can't trust in ${p.position === 'GK' ? 'goal' : 'the XI'}.`,
    ])
  }
  if (p.form >= 72) {
    if (p.position === 'FW') return rng.pick([
      `${p.name} scored again for ${p.club} — that's the kind of form you build a window around.`,
      `Another goal for ${p.name} in the ${p.clubLeague}. ${p.club} fans are singing his name; yours soon might be too.`,
    ])
    if (p.position === 'MF') return rng.pick([
      `${p.name} ran the match for ${p.club} at the weekend. Everything good went through him.`,
      `A goal and the game's tempo: ${p.name} was ${p.club}'s best player again.`,
    ])
    if (p.position === 'DF') return rng.pick([
      `${p.name} was a wall for ${p.club} — another clean sheet built on his reading of the game.`,
      `Nothing got past ${p.name} at the weekend. ${p.club} look meaner with him back there.`,
    ])
    return rng.pick([
      `${p.name} kept a clean sheet for ${p.club}, including one save that had the ${p.clubLeague} talking.`,
      `Two match-winning stops from ${p.name} — ${p.club} owe him points this month.`,
    ])
  }
  if (p.form <= 45) {
    return rng.pick([
      `${p.name} struggled again as ${p.club} dropped points. A quiet word — or a rest — might be needed.`,
      `Rough patch for ${p.name}: hooked at half-time by ${p.club}. Form is a fickle friend.`,
    ])
  }
  return rng.pick([
    `${p.name} put in a steady shift for ${p.club} — nothing spectacular, nothing wrong.`,
    `Ninety unremarkable, professional minutes for ${p.name} at ${p.club}. Managers notice those too.`,
    `${p.name} did his job for ${p.club} at the weekend, the way he does most weekends.`,
  ])
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
