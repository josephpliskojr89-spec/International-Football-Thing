import { create } from 'zustand'
import type { Career, NewsItem, Player, PlayStyle } from '@/engine/types'
import { createCareer, autoFillLineup, type NewCareerInput } from '@/engine/career'
import { advanceWeek as advanceWeekEngine } from '@/engine/calendar'
import { simulateMatch, type MatchResult } from '@/engine/match'
import { buildManagerTeam, buildOpponentTeam } from '@/engine/matchSetup'
import { seeInPerson, targetedLook } from '@/engine/scouting'
import { isSquadLocked, currentMatch } from '@/engine/fixtures'
import { managerFixture, resolveMatchday, createCampaign } from '@/engine/campaign'
import {
  createTournament,
  managerTie,
  resolveTournamentRound,
  decide,
  roundName,
  totalRounds,
  type TieResult,
} from '@/engine/tournament'
import { deriveSeed, hashStr } from '@/engine/rng'
import { ratingOf, applyResults } from '@/engine/world'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import {
  windowAtWeek,
  fixtureKey,
  tournamentForYear,
  tournamentRoundAtWeek,
  TOURNAMENT_DEADLINE_WEEK,
} from '@/data/windows'
import type { Tournament, Trophy } from '@/engine/types'
import { saveCareer, loadCareer, deleteSave } from './persist'

// Top-level navigation. Plain state machine, no router — simpler and more
// reliable one-handed on a phone than URL routing, and trivial to wrap in
// Capacitor later.
export type Route =
  | 'title'
  | 'new-game'
  | 'schedule'
  | 'squad'
  | 'pool'
  | 'dual-nationals'
  | 'settings'
  | 'save'
  | 'match'
  | 'scouting'
  | 'squad-select'
  | 'standings'
  | 'bracket'
  | 'rankings'

interface GameState {
  route: Route
  career: Career | null
  hydrated: boolean

  go: (route: Route) => void
  startNewCareer: (input: NewCareerInput) => Promise<void>
  continueCareer: () => Promise<boolean>
  hydrate: () => Promise<void>

  advanceWeek: () => void
  setFormation: (formationId: string) => void
  swapLineupSlots: (slotA: string, slotB: string) => void
  saveNow: () => Promise<void>
  abandonCareer: () => Promise<void>

  setSquad: (ids: string[]) => void
  setStyle: (style: PlayStyle) => void
  setFocalPoint: (playerId: string | null) => void
  playCurrentMatch: () => MatchResult | null
  assignCoach: (coachId: string, league: string | null) => void
  sendScout: (newsId: string, playerId: string) => boolean
}

// Clear the focal point if the chosen player is no longer in the XI.
function keepFocalIfInXI(tactics: Career['tactics'], xiIds: string[]): Career['tactics'] {
  if (tactics.focalPointId && !xiIds.includes(tactics.focalPointId)) {
    return { ...tactics, focalPointId: null }
  }
  return tactics
}

// Debounced autosave so rapid taps don't thrash IndexedDB.
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(career: Career | null) {
  if (!career) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveCareer(career)
  }, 400)
}

// Flush any pending debounced save immediately — used when the app is about to
// be backgrounded or closed (PWAs are frequently frozen inside the debounce
// window, which would otherwise lose the last action).
function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const career = useGame.getState().career
  if (career) void saveCareer(career)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave()
  })
  window.addEventListener('pagehide', flushSave)
}

export const useGame = create<GameState>((set, get) => ({
  route: 'title',
  career: null,
  hydrated: false,

  go: (route) => set({ route }),

  hydrate: async () => {
    // We don't auto-load into a career; we just mark that hydration ran so the
    // title screen can enable/disable "Continue".
    set({ hydrated: true })
  },

  startNewCareer: async (input) => {
    const career = createCareer(input)
    set({ career, route: 'schedule' })
    await saveCareer(career)
  },

  continueCareer: async () => {
    const career = await loadCareer()
    if (!career) return false
    set({ career, route: 'schedule' })
    return true
  },

  advanceWeek: () => {
    const { career } = get()
    if (!career) return
    if (currentMatch(career)) return // a match is pending this week — play it first
    let next = advanceWeekEngine(career)
    next = progressTournament(next) // create the summer finals / auto-sim rounds you're not in
    set({ career: next })
    scheduleSave(next)
  },

  setFormation: (formationId) => {
    const { career } = get()
    if (!career) return
    // Fill the XI from the registered 26 only; bench = the squad minus the XI.
    const squadPlayers = career.players.filter((p) => career.registeredSquad.includes(p.id))
    const lineup = autoFillLineup(squadPlayers, formationId, career.style)
    const xiIds = Object.values(lineup).filter(Boolean) as string[]
    const bench = career.registeredSquad.filter((id) => !xiIds.includes(id))
    const tactics = keepFocalIfInXI(career.tactics, xiIds)
    const next = { ...career, formation: formationId, lineup, bench, tactics }
    set({ career: next })
    scheduleSave(next)
  },

  swapLineupSlots: (slotA, slotB) => {
    const { career } = get()
    if (!career) return
    const lineup = { ...career.lineup }
    const tmp = lineup[slotA] ?? null
    lineup[slotA] = lineup[slotB] ?? null
    lineup[slotB] = tmp
    const next = { ...career, lineup }
    set({ career: next })
    scheduleSave(next)
  },

  saveNow: async () => {
    const { career } = get()
    if (career) await saveCareer(career)
  },

  abandonCareer: async () => {
    await deleteSave()
    set({ career: null, route: 'title' })
  },

  assignCoach: (coachId, league) => {
    const { career } = get()
    if (!career) return
    const coaches = career.coaches.map((c) => (c.id === coachId ? { ...c, leagueAssignment: league } : c))
    const next = { ...career, coaches }
    set({ career: next })
    scheduleSave(next)
  },

  setSquad: (ids) => {
    const { career } = get()
    if (!career) return
    if (isSquadLocked(career)) return // registration deadline passed
    const dedup = [...new Set(ids)]
    const squadPlayers = career.players.filter((p) => dedup.includes(p.id))
    const lineup = autoFillLineup(squadPlayers, career.formation, career.style)
    const xiIds = Object.values(lineup).filter(Boolean) as string[]
    const bench = dedup.filter((id) => !xiIds.includes(id))
    const tactics = keepFocalIfInXI(career.tactics, xiIds)
    const next = { ...career, registeredSquad: dedup, lineup, bench, tactics }
    set({ career: next })
    scheduleSave(next)
  },

  setStyle: (style) => {
    const { career } = get()
    if (!career) return
    const next = { ...career, tactics: { ...career.tactics, style } }
    set({ career: next })
    scheduleSave(next)
  },

  setFocalPoint: (playerId) => {
    const { career } = get()
    if (!career) return
    const next = { ...career, tactics: { ...career.tactics, focalPointId: playerId } }
    set({ career: next })
    scheduleSave(next)
  },

  playCurrentMatch: () => {
    const { career } = get()
    if (!career) return null
    const cm = currentMatch(career)
    if (!cm) return null
    const resolved = cm.type === 'TOURNAMENT' ? resolveTournament(career) : resolveQualifier(career)
    if (!resolved) return null
    set({ career: resolved.next })
    scheduleSave(resolved.next)
    return resolved.result
  },

  sendScout: (newsId, playerId) => {
    const { career } = get()
    if (!career) return false
    const coachIdx = career.coaches.findIndex((c) => !c.targetedLookUsed)
    if (coachIdx < 0) return false // no targeted looks left this period

    const coaches = career.coaches.map((c, i) => (i === coachIdx ? { ...c, targetedLookUsed: true } : c))
    let scouted: Player | null = null
    const players = career.players.map((p) => {
      if (p.id !== playerId) return p
      scouted = targetedLook(p)
      return scouted
    })
    if (!scouted) return false

    const report = scoutReport(scouted, career.year, career.week)
    const news = [report, ...career.news.map((n) => (n.id === newsId ? { ...n, action: undefined } : n))].slice(0, 80)
    const next: Career = { ...career, coaches, players, news }
    set({ career: next })
    scheduleSave(next)
    return true
  },
}))

// ---- match resolution (pure: take a career, return the next career + result) ----

// Apply an exact-read + form nudge to the registered 26 who were in camp.
function applySquadAfterMatch(career: Career, ratings: { playerId: string; rating: number }[]): Player[] {
  const ratingById = new Map(ratings.map((r) => [r.playerId, r.rating]))
  const squad = new Set<string>(career.registeredSquad)
  return career.players.map((p) => {
    if (!squad.has(p.id)) return p
    const r = ratingById.get(p.id)
    const formed = r === undefined ? p : { ...p, form: Math.max(20, Math.min(99, Math.round(p.form + (r - 6.5) * 3))) }
    return seeInPerson(formed)
  })
}

function resolveQualifier(career: Career): { next: Career; result: MatchResult } | null {
  const window = windowAtWeek(career.week)
  if (!window) return null
  const key = fixtureKey(career.season, window.id)
  if (career.playedFixtures.includes(key)) return null

  const mf = managerFixture(career.campaign, career.managerNationId)
  if (!mf) return null
  const opponent = ALL_NATIONS_BY_ID[mf.opponentId]
  const isHome = mf.home
  const managerTeam = buildManagerTeam(career, isHome)
  const opponentTeam = buildOpponentTeam(opponent, career.seed, !isHome, career.season, ratingOf(career.world, opponent.id))
  const home = isHome ? managerTeam : opponentTeam
  const away = isHome ? opponentTeam : managerTeam
  const seed = deriveSeed(career.seed, career.campaign.cycle, career.campaign.matchdayIndex, hashStr(opponent.id))
  const result = simulateMatch(home, away, seed)

  const players = applySquadAfterMatch(career, isHome ? result.ratingsHome : result.ratingsAway)

  const myId = career.managerNationId
  const managerResult = {
    homeId: isHome ? myId : opponent.id,
    awayId: isHome ? opponent.id : myId,
    hg: result.homeGoals,
    ag: result.awayGoals,
  }
  let campaign = resolveMatchday(career.campaign, managerResult, myId, career.seed, career.season, career.world)
  // Every result of the matchday — the manager's included — moves the world.
  let world = applyResults(career.world, campaign.recentResults, 'qualifier')
  const extraNews: NewsItem[] = []
  let qualifiedForWorldCup = career.qualifiedForWorldCup
  if (campaign.complete) {
    qualifiedForWorldCup = campaign.qualifiedIds.includes(myId)
    extraNews.push(qualificationNews(campaign, myId, career.year, career.week))
    campaign = createCampaign(myId, career.seed, campaign.cycle + 1, world)
  }

  const headline = matchHeadline(result, isHome, career.year, career.week)
  const next: Career = {
    ...career,
    players,
    campaign,
    world,
    qualifiedForWorldCup,
    playedFixtures: [...career.playedFixtures, key],
    coaches: career.coaches.map((c) => ({ ...c, targetedLookUsed: false })),
    news: [headline, ...extraNews, ...career.news].slice(0, 60),
  }
  return { next, result }
}

function resolveTournament(career: Career): { next: Career; result: MatchResult } | null {
  const t = career.tournament
  if (!t || t.champion) return null
  const mt = managerTie(t)
  if (!mt) return null

  const opponent = ALL_NATIONS_BY_ID[mt.opponentId]
  const isHome = mt.home
  const managerTeam = buildManagerTeam(career, isHome)
  const opponentTeam = buildOpponentTeam(opponent, career.seed, !isHome, career.season, ratingOf(career.world, opponent.id))
  const home = isHome ? managerTeam : opponentTeam
  const away = isHome ? opponentTeam : managerTeam
  const seed = deriveSeed(career.seed, t.roundIndex, hashStr(opponent.id), 0xfeed)
  const result = simulateMatch(home, away, seed)

  const players = applySquadAfterMatch(career, isHome ? result.ratingsHome : result.ratingsAway)

  // Build the tie result in the tie's a/b orientation (aGoals = home goals here,
  // because the team built as "home" is always the tie's a-side).
  const myRating = ratingOf(career.world, career.managerNationId)
  const oppRating = ratingOf(career.world, opponent.id)
  const tieResult: TieResult = decide(
    mt.tie.aId,
    mt.tie.bId,
    result.homeGoals,
    result.awayGoals,
    isHome ? myRating : oppRating,
    isHome ? oppRating : myRating,
    deriveSeed(seed, 7),
  )

  const next = stepTournament({ ...career, players }, tieResult)
  // The manager's own match also gets a headline.
  const headline = matchHeadline(result, isHome, career.year, career.week, t.name)
  return { next: { ...next, news: [headline, ...next.news].slice(0, 80) }, result }
}

// Resolve the current finals round (manager result applied if given, rest
// simmed), then surface champion / elimination news and bank any trophy.
// Finals ties hit the world ratings hardest — this is where eras shift.
function stepTournament(career: Career, managerResult: TieResult | null): Career {
  const t = career.tournament!
  const newT = resolveTournamentRound(t, managerResult, career.seed, career.season, career.world)
  const playedRound = newT.rounds[t.roundIndex] ?? []
  const world = applyResults(
    career.world,
    playedRound.map((tie) => ({
      homeId: tie.aId,
      awayId: tie.bId,
      hg: tie.aGoals ?? 0,
      ag: tie.bGoals ?? 0,
      neutral: true,
      shootout: tie.pens,
      shootoutWinnerId: tie.pens ? tie.winnerId ?? undefined : undefined,
    })),
    'finals',
  )
  const news: NewsItem[] = []
  let trophies = career.trophies

  if (newT.champion) {
    const champ = ALL_NATIONS_BY_ID[newT.champion]
    const won = newT.champion === career.managerNationId
    news.push({
      id: `champ-${newT.kind}-${career.season}`,
      year: career.year,
      week: career.week,
      type: newT.kind === 'WORLD_CUP' ? 'WORLD_CUP' : 'CONTINENTAL',
      magnitude: 1,
      text: won
        ? `CHAMPIONS! ${champ.name} have won the ${newT.name}. Scenes that will never be forgotten.`
        : `${champ.name} are crowned ${newT.name} champions.`,
    })
    if (won) trophies = [...trophies, { kind: newT.kind, name: newT.name, season: career.season } as Trophy]
  } else if (newT.eliminated && !t.eliminated) {
    news.push({
      id: `out-${newT.kind}-${career.season}-${t.roundIndex}`,
      year: career.year,
      week: career.week,
      type: 'KNOCKED_OUT',
      magnitude: 0.8,
      text: `${ALL_NATIONS_BY_ID[career.managerNationId].name} are out of the ${newT.name}. The dream ends here — for now.`,
    })
  }

  return { ...career, tournament: newT, world, trophies, news: [...news, ...career.news].slice(0, 80) }
}

// Calendar-driven tournament lifecycle: create the summer finals at its deadline,
// and auto-resolve rounds the manager isn't playing (eliminated or didn't enter).
function progressTournament(career: Career): Career {
  let c = career
  const slot = tournamentForYear(c.year)
  if (slot && c.week === TOURNAMENT_DEADLINE_WEEK && !c.tournament) {
    const include = slot === 'WORLD_CUP' ? worldCupInclusion(c) : true
    const t = createTournament(slot, c.managerNationId, c.seed, c.season, include, c.world)
    c = { ...c, tournament: t, news: [tournamentDrawNews(t, c), ...c.news].slice(0, 80) }
  }

  const t = c.tournament
  if (t && !t.champion && tournamentRoundAtWeek(c.week) === t.roundIndex && !managerTie(t)) {
    c = stepTournament(c, null) // a round the manager isn't in — sim it
  }
  return c
}

function worldCupInclusion(career: Career): boolean {
  if (career.qualifiedForWorldCup) return true
  const pos = career.campaign.standings.findIndex((s) => s.nationId === career.managerNationId)
  return pos >= 0 && pos < career.campaign.qualifyCount
}

function tournamentDrawNews(t: Tournament, career: Career): NewsItem {
  const me = ALL_NATIONS_BY_ID[career.managerNationId].name
  const mt = managerTie(t)
  const text = !t.inField
    ? `The ${t.name} draw is made. ${me} aren't there — one to watch from home.`
    : mt
      ? `The ${t.name} is here! ${me} open against ${ALL_NATIONS_BY_ID[mt.opponentId].name} in the ${roundName(t.kind, 0, totalRounds(t.field.length))}.`
      : `The ${t.name} is here.`
  return { id: `draw-${t.kind}-${career.season}`, year: career.year, week: career.week, type: 'DRAW', magnitude: 0.8, text }
}

// A scout's verdict after a targeted look — confirmation or bust, keyed off the
// now-revealed potential (the player object passed in is already scouted).
function scoutReport(p: Player, year: number, week: number): NewsItem {
  let verdict: string
  if (p.potential >= 88) verdict = `${p.name} is the real deal — a generational ceiling. Lock him down before anyone else does.`
  else if (p.potential >= 80) verdict = `${p.name} has genuine top-team potential. Well worth tracking.`
  else if (p.potential >= 72) verdict = `${p.name} is a tidy player, but not the superstar the hype suggested.`
  else verdict = `${p.name} is a flat-track bully — the hype has outrun the talent. One for depth at best.`
  return {
    id: `scout-${p.id}-${year}-${week}-${p.potential}`,
    year,
    week,
    type: 'SCOUT_REPORT',
    magnitude: 0.6,
    subjectId: p.id,
    text: `Scout report: ${verdict}`,
  }
}

function matchHeadline(
  result: MatchResult,
  managerIsHome: boolean,
  year: number,
  week: number,
  context = 'qualifying',
): NewsItem {
  const mine = managerIsHome ? result.homeGoals : result.awayGoals
  const theirs = managerIsHome ? result.awayGoals : result.homeGoals
  const verb = mine > theirs ? 'beat' : mine < theirs ? 'lost to' : 'drew with'
  const myName = managerIsHome ? result.homeName : result.awayName
  const oppName = managerIsHome ? result.awayName : result.homeName
  const motm = result.motm ? ` ${result.motm.name} took the plaudits.` : ''
  return {
    id: `match-${myName}-${oppName}-${result.homeGoals}${result.awayGoals}-${year}${week}`,
    week,
    year,
    type: context === 'qualifying' ? 'QUALIFIER' : 'TOURNAMENT',
    magnitude: 0.6,
    text: `${myName} ${verb} ${oppName} ${result.homeGoals}–${result.awayGoals} in ${context}.${motm}`,
  }
}

function qualificationNews(campaign: Career['campaign'], myId: string, year: number, week: number): NewsItem {
  const qualified = campaign.qualifiedIds.includes(myId)
  const me = ALL_NATIONS_BY_ID[myId]
  return {
    id: `qual-${campaign.cycle}-${myId}-${qualified ? 'in' : 'out'}`,
    week,
    year,
    type: qualified ? 'QUALIFIED' : 'ELIMINATED',
    magnitude: 1,
    text: qualified
      ? `${me.name} have QUALIFIED for the World Cup! A campaign to remember — now the real thing begins.`
      : `Heartbreak: ${me.name} have missed out on World Cup qualification. The rebuild starts now.`,
  }
}

