import { create } from 'zustand'
import type { Career, NewsItem, Player, PlayStyle } from '@/engine/types'
import { createCareer, autoFillLineup, type NewCareerInput } from '@/engine/career'
import { advanceWeek as advanceWeekEngine } from '@/engine/calendar'
import { simulateMatch, settleKnockout, type MatchResult } from '@/engine/match'
import { buildManagerTeam, buildOpponentTeam } from '@/engine/matchSetup'
import { seeInPerson, targetedLook } from '@/engine/scouting'
import { isSquadLocked, currentMatch, friendlyFixture, playoffFixture } from '@/engine/fixtures'
import { managerFixture, resolveMatchday } from '@/engine/campaign'
import { playerOfTheTournament } from '@/engine/awards'
import { clampRep, nationName } from '@/engine/manager'
import { autoFillBench } from '@/engine/career'
import { createCampaign } from '@/engine/campaign'
import { generateManagerPool } from '@/engine/playerGen'
import { cycleObjective } from '@/engine/manager'
import {
  pickWorldCupHost as pickWorldCupHostFor,
  createTournament,
  managerStep,
  resolveTournamentRound,
  decide,
  roundName,
  totalRounds,
  stepWeeks,
  groupStepCount,
  inGroupStage,
  type TieResult,
} from '@/engine/tournament'
import { RNG, deriveSeed, hashStr } from '@/engine/rng'
import { ratingOf, applyResults } from '@/engine/world'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import {
  windowAtWeek,
  fixtureKey,
  tournamentForYear,
  TOURNAMENT_DEADLINE_WEEK,
  WINDOWS,
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
  | 'legacy'
  | 'offers'
  | 'final-whistle'
  | 'ghost'

// What a retiring manager hands to their successor: the WORLD, not the office.
interface SuccessionPayload {
  seed: number
  world: Career['world']
  history: Career['history']
  legends: Career['legends']
  season: number
  prevHostId: string | null
  prevManagerName: string
}

interface GameState {
  route: Route
  career: Career | null
  hydrated: boolean
  succession: SuccessionPayload | null
  beginSuccession: () => void

  go: (route: Route) => void
  startNewCareer: (input: NewCareerInput) => Promise<void>
  continueCareer: () => Promise<boolean>
  hydrate: () => Promise<void>

  advanceWeek: () => void
  advanceToNextEvent: () => void
  setFormation: (formationId: string) => void
  swapLineupSlots: (slotA: string, slotB: string) => void
  swapWithBench: (slotId: string, benchPlayerId: string) => void
  saveNow: () => Promise<void>
  abandonCareer: () => Promise<void>

  setSquad: (ids: string[]) => void
  setStyle: (style: PlayStyle) => void
  setFocalPoint: (playerId: string | null) => void
  playCurrentMatch: () => MatchResult | null
  assignCoach: (coachId: string, league: string | null) => void
  sendScout: (newsId: string, playerId: string) => boolean
  courtPlayer: (playerId: string) => boolean
  acceptOffer: (nationId: string) => void
  declineOffers: () => void
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
  succession: null,

  // Retire — but the world doesn't reset. Your successor inherits the almanac,
  // the eras, the evolved ratings, even the rival players mid-career (same
  // seed, so every generational identity continues seamlessly). One timeline,
  // many managers. This is New Game+ the way football actually works.
  beginSuccession: () => {
    const { career } = get()
    if (!career) return
    // Hand over at the next cycle boundary: history stays clean.
    const seasonsToCycleEnd = 5 - career.year
    set({
      succession: {
        seed: career.seed,
        world: career.world,
        history: career.history,
        legends: career.legends,
        season: career.season + seasonsToCycleEnd,
        prevHostId: career.wcHostId,
        prevManagerName: career.managerName,
      },
      route: 'new-game',
    })
  },

  go: (route) => set({ route }),

  hydrate: async () => {
    // We don't auto-load into a career; we just mark that hydration ran so the
    // title screen can enable/disable "Continue".
    set({ hydrated: true })
  },

  startNewCareer: async (input) => {
    let career = createCareer(input)
    const inherit = get().succession
    if (inherit) {
      // Same seed = the same living world: generational squads, hosts and
      // ghost timelines all continue. New season, new cycle, new you.
      const cycleNum = Math.ceil(inherit.season / 4) + 1
      career = {
        ...career,
        seed: inherit.seed,
        world: inherit.world,
        legends: inherit.legends,
        season: inherit.season,
        year: 1,
        week: 1,
        eraStartSeason: inherit.season,
        campaign: createCampaign(input.nationId, inherit.seed, cycleNum, inherit.world),
        wcHostId: pickWorldCupHostFor(input.nationId, inherit.seed, cycleNum, inherit.prevHostId),
        objective: cycleObjective(inherit.world, input.nationId),
        reputation: 35,
        players: generateManagerPool(ALL_NATIONS_BY_ID[input.nationId], deriveSeed(inherit.seed, hashStr(input.nationId), inherit.season)),
        history: [
          ...inherit.history,
          {
            season: inherit.season,
            type: 'JOB',
            text: `A new era: ${career.managerName} succeeds ${inherit.prevManagerName} in international football, taking charge of ${ALL_NATIONS_BY_ID[input.nationId].name}`,
            nationId: input.nationId,
            managerMoment: true,
          },
        ],
        news: [
          {
            id: `succession-${inherit.season}`,
            week: 1,
            year: 1,
            type: 'APPOINTMENT',
            magnitude: 1,
            text: `The ${inherit.prevManagerName} era is over. The world ${inherit.prevManagerName} shaped — its champions, its risen and fallen powers — is now yours to inherit. No pressure.`,
          },
          ...career.news,
        ],
      }
      // Squad/lineup must come from the inherited-seed pool.
      const lineup = autoFillLineup(career.players, career.formation, career.style)
      const xiIds = Object.values(lineup).filter(Boolean) as string[]
      const bench = autoFillBench(career.players, lineup, career.style)
      career = { ...career, lineup, bench, registeredSquad: [...new Set([...xiIds, ...bench])] }
      set({ succession: null })
    }
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
    if (career.sackedFrom) return // sacked: choose your next job before time moves on
    if (currentMatch(career)) return // a match is pending this week — play it first
    let next = advanceWeekEngine(career)
    next = progressTournament(next) // create the summer finals / auto-sim rounds you're not in
    set({ career: next })
    scheduleSave(next)
  },

  // Fast-forward through the quiet weeks: advance until something needs YOU —
  // a match, a registration deadline, big news, a sacking, an offer. The weeks
  // still happen (club watch, courting clocks, world results all tick).
  advanceToNextEvent: () => {
    const { career } = get()
    if (!career || career.sackedFrom || currentMatch(career)) return
    let c = career
    for (let i = 0; i < 14; i++) {
      let next = advanceWeekEngine(c)
      next = progressTournament(next)
      c = next
      if (currentMatch(c)) break
      if (c.sackedFrom || c.offers.length > 0) break
      // Stop the week BEFORE a registration deadline (so the 26 is still
      // yours to change), and never blow past a match week either.
      if (WINDOWS.some((wd) => wd.deadlineWeek === c.week + 1)) break
      if (windowAtWeek(c.week + 1)) break
      if (c.week === TOURNAMENT_DEADLINE_WEEK - 1 && tournamentForYear(c.year)) break
      // ...or when something big lands in the feed.
      if (c.news[0] && c.news[0].magnitude >= 0.9 && !career.news.some((n) => n.id === c.news[0].id)) break
    }
    set({ career: c })
    scheduleSave(c)
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

  // Swap a bench player into the XI (and the starter out to the bench). The
  // registration lock freezes the 26, NOT the eleven — team selection within
  // your squad is always yours, right up to kickoff.
  swapWithBench: (slotId, benchPlayerId) => {
    const { career } = get()
    if (!career) return
    if (!career.bench.includes(benchPlayerId)) return
    const outgoing = career.lineup[slotId] ?? null
    const lineup = { ...career.lineup, [slotId]: benchPlayerId }
    const bench = [...career.bench.filter((id) => id !== benchPlayerId), ...(outgoing ? [outgoing] : [])]
    const xiIds = Object.values(lineup).filter(Boolean) as string[]
    const tactics = keepFocalIfInXI(career.tactics, xiIds)
    const next = { ...career, lineup, bench, tactics }
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
    const resolved =
      cm.type === 'TOURNAMENT'
        ? resolveTournament(career)
        : cm.type === 'FRIENDLY'
          ? resolveFriendly(career)
          : cm.type === 'PLAYOFF'
            ? resolvePlayoff(career)
            : resolveQualifier(career)
    if (!resolved) return null
    set({ career: resolved.next })
    scheduleSave(resolved.next)
    return resolved.result
  },

  // Take another nation's job. The WORLD comes with you — ratings, history,
  // almanac, your reputation and record — but the players, the campaign and
  // the dressing room are all new. This is how one save becomes a life's work.
  acceptOffer: (nationId) => {
    const { career } = get()
    if (!career || !career.offers.includes(nationId)) return
    const nation = ALL_NATIONS_BY_ID[nationId]
    if (!nation || !nation.isPlayable) return

    const players = generateManagerPool(nation, deriveSeed(career.seed, hashStr(nationId), career.season))
    const lineup = autoFillLineup(players, career.formation, career.style)
    const bench = autoFillBench(players, lineup, career.style)
    const registeredSquad = [...new Set([...(Object.values(lineup).filter(Boolean) as string[]), ...bench])]
    const oldName = nationName(career.managerNationId)

    const next: Career = {
      ...career,
      managerNationId: nationId,
      players,
      lineup,
      bench,
      registeredSquad,
      tactics: { ...career.tactics, focalPointId: null },
      coaches: career.coaches.map((c) => ({ ...c, leagueAssignment: null, targetedLookUsed: false })),
      campaign: createCampaign(nationId, career.seed, career.campaign.cycle, career.world),
      qualifiedForWorldCup: false,
      tournament: null,
      lastWcOutcome: null,
      lastCampaignPosition: null,
      objective: cycleObjective(career.world, nationId),
      offers: [],
      sackedFrom: null,
      history: [
        ...career.history,
        { season: career.season, type: 'JOB', text: `${career.managerName} takes charge of ${nation.name}`, nationId, managerMoment: true },
      ],
      news: [
        mkStoreNews(`job-${nationId}-${career.season}`, career, 'APPOINTMENT', 1,
          career.sackedFrom
            ? `A new chapter: you take charge of ${nation.name}. ${oldName} is behind you — prove them wrong.`
            : `You've done it — you walk out on ${oldName} to take the ${nation.name} job. No pressure.`),
        ...career.news,
      ].slice(0, 80),
    }
    set({ career: next, route: 'schedule' })
    scheduleSave(next)
  },

  declineOffers: () => {
    const { career } = get()
    if (!career || career.sackedFrom) return // can't decline your way out of a sacking
    const next: Career = {
      ...career,
      offers: [],
      reputation: clampRep(career.reputation + 2),
      news: [
        mkStoreNews(`loyal-${career.season}`, career, 'LOYALTY', 0.6,
          `You turn the approach down. The fans noticed. Loyalty like that buys patience.`),
        ...career.news,
      ].slice(0, 80),
    }
    set({ career: next, route: 'schedule' })
    scheduleSave(next)
  },

  // Personal contact with an uncommitted dual national: costs a staff visit
  // (same budget as targeted scouting — your people are stretched), warms his
  // lean toward you. Trophies talk: silverware makes the pitch land harder.
  courtPlayer: (playerId) => {
    const { career } = get()
    if (!career) return false
    const coachIdx = career.coaches.findIndex((c) => !c.targetedLookUsed)
    if (coachIdx < 0) return false

    const p = career.players.find((x) => x.id === playerId)
    if (!p || p.eligibleNations.length < 2 || p.eligibilityState === 'CAP_TIED' || p.eligibilityState === 'LOST') return false

    const rng = new RNG(deriveSeed(career.seed, career.season, career.week, hashStr(playerId)))
    const trophyPull = Math.min(6, career.trophies.length * 2)
    const gain = rng.range(9, 15) + trophyPull
    const coaches = career.coaches.map((c, i) => (i === coachIdx ? { ...c, targetedLookUsed: true } : c))
    const players = career.players.map((x) =>
      x.id === playerId
        ? { ...x, leans: { ...x.leans, [career.managerNationId]: Math.min(100, (x.leans[career.managerNationId] ?? 50) + gain) } }
        : x,
    )
    const news: NewsItem = mkStoreNews(`courted-${playerId}-${career.season}-${career.week}`, career, 'COURTING', 0.5,
      `Your staff paid ${p.name} a personal visit. ${trophyPull > 0 ? 'The trophies did some of the talking. ' : ''}He was listening.`)
    const next: Career = { ...career, coaches, players, news: [news, ...career.news].slice(0, 80) }
    set({ career: next })
    scheduleSave(next)
    return true
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

// Apply the aftermath of a match to the manager's pool: exact in-person reads
// and form for the 26 in camp, caps + goals for those who actually played,
// injuries picked up on the pitch (with news), and — if the match was
// competitive — any uncommitted dual national who played is now CAP-TIED to
// you, forever. Friendlies instead nudge his heart your way.
function applySquadAfterMatch(
  career: Career,
  result: MatchResult,
  managerIsHome: boolean,
  competitive: boolean,
): { players: Player[]; aftermathNews: NewsItem[] } {
  const ratings = managerIsHome ? result.ratingsHome : result.ratingsAway
  const ratingById = new Map(ratings.map((r) => [r.playerId, r.rating]))
  const goalsById = new Map(ratings.map((r) => [r.playerId, r.goals]))
  const mySide = managerIsHome ? 'home' : 'away'
  const injuredIds = new Set(
    result.events.filter((e) => e.type === 'INJURY' && e.side === mySide).map((e) => e.playerId),
  )
  const squad = new Set<string>(career.registeredSquad)
  const news: NewsItem[] = []
  let debutsAnnounced = 0 // an early-career first XI is ALL debuts; only the notable ones make news

  const players = career.players.map((p) => {
    if (!squad.has(p.id)) return p
    let next = p
    const r = ratingById.get(p.id)
    if (r !== undefined) {
      const goalsToday = goalsById.get(p.id) ?? 0
      next = {
        ...next,
        form: Math.max(20, Math.min(99, Math.round(p.form + (r - 6.5) * 3))),
        caps: p.caps + 1,
        intlGoals: p.intlGoals + goalsToday,
      }
      // Career texture: debuts, milestone caps, hat-tricks — the moments a
      // federation's media office actually writes about.
      if (next.caps === 1 && debutsAnnounced < 2 && (p.age <= 23 || goalsToday > 0)) {
        debutsAnnounced++
        news.push(mkStoreNews(`debut-${p.id}`, career, 'DEBUT', 0.6,
          `A debut to remember${goalsToday > 0 ? ' — with a goal' : ''}: ${p.name}, ${p.age}, wins his first cap for ${ALL_NATIONS_BY_ID[career.managerNationId].name}.`))
      } else if (next.caps === 50 || next.caps === 100) {
        news.push(mkStoreNews(`caps-${next.caps}-${p.id}`, career, 'MILESTONE', next.caps === 100 ? 0.9 : 0.7,
          next.caps === 100
            ? `A CENTURION: ${p.name} wins his 100th cap. Whatever happens next, he belongs to history.`
            : `${p.name} reaches 50 caps. Half a century of showing up when his country called.`))
      }
      if (goalsToday >= 3) {
        news.push(mkStoreNews(`hattrick-${p.id}-${career.season}-${career.week}`, career, 'HAT_TRICK', 0.8,
          `HAT-TRICK! ${p.name} takes the match ball home — ${goalsToday} goals in one shirt, one afternoon.`))
      }
      // Playing for you settles a torn heart — a friendly warms him, a
      // competitive match ties him for good.
      if (next.eligibleNations.length > 1 && next.eligibilityState !== 'CAP_TIED' && next.eligibilityState !== 'LOST') {
        if (competitive) {
          next = { ...next, eligibilityState: 'CAP_TIED', tiedNation: career.managerNationId }
          news.push(mkStoreNews(`tied-${p.id}-${career.season}-${career.week}`, career, 'CAP_TIED', 0.85,
            `${p.name} is now cap-tied to ${ALL_NATIONS_BY_ID[career.managerNationId].name}. The tug-of-war is over — he's yours.`))
        } else {
          const leans = { ...next.leans, [career.managerNationId]: Math.min(100, (next.leans[career.managerNationId] ?? 50) + 14) }
          next = { ...next, leans }
        }
      }
    }
    if (injuredIds.has(p.id)) {
      const weeks = 1 + (hashStr(p.id + career.week) % 6) // 1..6 weeks out
      next = { ...next, injuredWeeks: weeks }
      if (weeks >= 3) {
        news.push(mkStoreNews(`inj-${p.id}-${career.season}-${career.week}`, career, 'INJURY', 0.7,
          `Blow for ${ALL_NATIONS_BY_ID[career.managerNationId].name}: ${p.name} limps off and is ruled out for around ${weeks} weeks.`))
      }
    }
    return seeInPerson(next) // everyone in camp gets an exact in-person read
  })
  return { players, aftermathNews: news }
}

function mkStoreNews(id: string, career: Career, type: string, magnitude: number, text: string): NewsItem {
  return { id, year: career.year, week: career.week, type, magnitude, text }
}

// Head-to-head vs a nation — the duel the match screen narrates.
function updateH2h(h2h: Career['h2h'], oppId: string, mine: number, theirs: number): Career['h2h'] {
  const cur = h2h[oppId] ?? { w: 0, d: 0, l: 0 }
  return {
    ...h2h,
    [oppId]: {
      w: cur.w + (mine > theirs ? 1 : 0),
      d: cur.d + (mine === theirs ? 1 : 0),
      l: cur.l + (mine < theirs ? 1 : 0),
    },
  }
}

// Aggregate manager record, from the manager's perspective.
function updateRecord(record: Career['record'], mine: number, theirs: number): Career['record'] {
  return {
    p: record.p + 1,
    w: record.w + (mine > theirs ? 1 : 0),
    d: record.d + (mine === theirs ? 1 : 0),
    l: record.l + (mine < theirs ? 1 : 0),
    gf: record.gf + mine,
    ga: record.ga + theirs,
  }
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

  const { players, aftermathNews } = applySquadAfterMatch(career, result, isHome, true)

  const myId = career.managerNationId
  const managerResult = {
    homeId: isHome ? myId : opponent.id,
    awayId: isHome ? opponent.id : myId,
    hg: result.homeGoals,
    ag: result.awayGoals,
  }
  const campaign = resolveMatchday(career.campaign, managerResult, myId, career.seed, career.season, career.world)
  // Every result of the matchday — the manager's included — moves the world.
  const world = applyResults(career.world, campaign.recentResults, 'qualifier')
  const extraNews: NewsItem[] = []
  const history = [...career.history]
  let qualifiedForWorldCup = career.qualifiedForWorldCup
  let reputation = career.reputation
  let lastCampaignPosition = career.lastCampaignPosition
  let playoffPending = career.playoffPending
  if (campaign.complete) {
    // The campaign concludes at the end of cycle year 3 — the verdict stands
    // until the World Cup next summer. (A fresh campaign starts in year 2.)
    qualifiedForWorldCup = campaign.qualifiedIds.includes(myId)
    reputation = clampRep(career.reputation + (qualifiedForWorldCup ? 6 : -10))
    lastCampaignPosition = campaign.standings.findIndex((st) => st.nationId === myId) + 1
    if (!qualifiedForWorldCup && lastCampaignPosition === 3) {
      playoffPending = true
      extraNews.push(mkStoreNews(`po-lifeline-${career.season}`, career, 'PLAYOFF', 0.95,
        `Third place — but not dead. One lifeline remains: the Intercontinental Playoff next spring. One match. Winner goes to the World Cup.`))
    }
    extraNews.push(qualificationNews(campaign, myId, career.year, career.week))
    history.push({
      season: career.season,
      type: qualifiedForWorldCup ? 'QUALIFIED' : 'MISSED',
      text: qualifiedForWorldCup
        ? `${ALL_NATIONS_BY_ID[myId].name} qualify for the World Cup`
        : `${ALL_NATIONS_BY_ID[myId].name} miss out on the World Cup`,
      nationId: myId,
      managerMoment: true,
    })
  }

  const mine = isHome ? result.homeGoals : result.awayGoals
  const theirs = isHome ? result.awayGoals : result.homeGoals
  const headline = matchHeadline(result, isHome, career.year, career.week)
  const next: Career = {
    ...career,
    players,
    campaign,
    world,
    history,
    record: updateRecord(career.record, mine, theirs),
    reputation,
    lastCampaignPosition,
    playoffPending,
    h2h: updateH2h(career.h2h, opponent.id, mine, theirs),
    qualifiedForWorldCup,
    playedFixtures: [...career.playedFixtures, key],
    coaches: career.coaches.map((c) => ({ ...c, targetedLookUsed: false })),
    news: [headline, ...extraNews, ...aftermathNews, ...career.news].slice(0, 60),
  }
  return { next, result }
}

// A window friendly: low stakes for the world, high value for YOU — exact reads
// on everyone in camp, a stage for the kids, and the warmest way to court an
// uncommitted dual national.
function resolveFriendly(career: Career): { next: Career; result: MatchResult } | null {
  const window = windowAtWeek(career.week)
  if (!window) return null
  const key = fixtureKey(career.season, window.id)
  if (career.playedFixtures.includes(key)) return null

  const fx = friendlyFixture(career, window.id, career.season)
  const opponent = ALL_NATIONS_BY_ID[fx.opponentId]
  const isHome = fx.home
  const managerTeam = buildManagerTeam(career, isHome)
  const opponentTeam = buildOpponentTeam(opponent, career.seed, !isHome, career.season, ratingOf(career.world, opponent.id))
  const home = isHome ? managerTeam : opponentTeam
  const away = isHome ? opponentTeam : managerTeam
  const seed = deriveSeed(career.seed, career.season, hashStr(window.id + opponent.id), 0xf1e)
  const result = simulateMatch(home, away, seed)

  const { players, aftermathNews } = applySquadAfterMatch(career, result, isHome, false)

  const myId = career.managerNationId
  const world = applyResults(
    career.world,
    [{ homeId: isHome ? myId : opponent.id, awayId: isHome ? opponent.id : myId, hg: result.homeGoals, ag: result.awayGoals }],
    'friendly',
  )

  const mine = isHome ? result.homeGoals : result.awayGoals
  const theirs = isHome ? result.awayGoals : result.homeGoals
  const headline = matchHeadline(result, isHome, career.year, career.week, 'a friendly')
  const next: Career = {
    ...career,
    players,
    world,
    record: updateRecord(career.record, mine, theirs),
    h2h: updateH2h(career.h2h, opponent.id, mine, theirs),
    playedFixtures: [...career.playedFixtures, key],
    coaches: career.coaches.map((c) => ({ ...c, targetedLookUsed: false })),
    news: [headline, ...aftermathNews, ...career.news].slice(0, 60),
  }
  return { next, result }
}

// One match for a place at the World Cup. No second chances, no second leg —
// a draw goes straight to penalties.
function resolvePlayoff(career: Career): { next: Career; result: MatchResult } | null {
  const window = windowAtWeek(career.week)
  if (!window) return null
  const key = fixtureKey(career.season, window.id)
  if (career.playedFixtures.includes(key)) return null

  const fx = playoffFixture(career)
  const opponent = ALL_NATIONS_BY_ID[fx.opponentId]
  const isHome = fx.home
  const managerTeam = buildManagerTeam(career, isHome)
  const opponentTeam = buildOpponentTeam(opponent, career.seed, !isHome, career.season, ratingOf(career.world, opponent.id))
  const home = isHome ? managerTeam : opponentTeam
  const away = isHome ? opponentTeam : managerTeam
  const seed = deriveSeed(career.seed, career.season, hashStr(opponent.id), 0x910)
  const result = simulateMatch(home, away, seed)

  const { players, aftermathNews } = applySquadAfterMatch(career, result, isHome, true)

  const mine = isHome ? result.homeGoals : result.awayGoals
  const theirs = isHome ? result.awayGoals : result.homeGoals
  // Level after ninety? Penalties decide who boards the plane.
  const dec = mine === theirs
    ? decide(career.managerNationId, opponent.id, mine, theirs,
        ratingOf(career.world, career.managerNationId), ratingOf(career.world, opponent.id), deriveSeed(seed, 7))
    : null
  const through = dec ? dec.winnerId === career.managerNationId : mine > theirs

  const myId = career.managerNationId
  const world = applyResults(career.world, [{
    homeId: isHome ? myId : opponent.id,
    awayId: isHome ? opponent.id : myId,
    hg: result.homeGoals,
    ag: result.awayGoals,
    shootout: !!dec,
    shootoutWinnerId: dec?.winnerId,
  }], 'qualifier')

  const pensText = dec ? ` (${dec.winnerId === myId ? `${Math.max(dec.pensA!, dec.pensB!)}–${Math.min(dec.pensA!, dec.pensB!)}` : `${Math.min(dec.pensA!, dec.pensB!)}–${Math.max(dec.pensA!, dec.pensB!)}`} on penalties)` : ''
  const verdictNews = mkStoreNews(`po-verdict-${career.season}`, career, through ? 'QUALIFIED' : 'ELIMINATED', 1,
    through
      ? `THE LIFELINE HOLDS! ${ALL_NATIONS_BY_ID[myId].name} win the Intercontinental Playoff${pensText} and are going to the World Cup after all.`
      : `Agony. ${ALL_NATIONS_BY_ID[myId].name} lose the Intercontinental Playoff${pensText}. There will be no World Cup. Not this time.`)
  const history = [...career.history, {
    season: career.season,
    type: (through ? 'QUALIFIED' : 'MISSED') as Career['history'][number]['type'],
    text: through
      ? `${ALL_NATIONS_BY_ID[myId].name} qualify for the World Cup via the Intercontinental Playoff`
      : `${ALL_NATIONS_BY_ID[myId].name} lose the Intercontinental Playoff — World Cup missed`,
    nationId: myId,
    managerMoment: true,
  }]

  const headline = matchHeadline(result, isHome, career.year, career.week, 'the Intercontinental Playoff')
  const next: Career = {
    ...career,
    players,
    world,
    history,
    qualifiedForWorldCup: through,
    playoffPending: false,
    reputation: clampRep(career.reputation + (through ? 7 : -7)),
    record: updateRecord(career.record, mine, theirs),
    h2h: updateH2h(career.h2h, opponent.id, mine, theirs),
    playedFixtures: [...career.playedFixtures, key],
    coaches: career.coaches.map((c) => ({ ...c, targetedLookUsed: false })),
    news: [verdictNews, headline, ...aftermathNews, ...career.news].slice(0, 80),
  }
  return { next, result }
}

function resolveTournament(career: Career): { next: Career; result: MatchResult } | null {
  const t = career.tournament
  if (!t || t.champion) return null
  const ms = managerStep(t)
  if (!ms) return null

  const opponent = ALL_NATIONS_BY_ID[ms.opponentId]
  const isHome = ms.home // a/b orientation of the pairing, not the venue
  // Venue: finals are neutral ground unless one side is the World Cup host.
  const iHost = t.kind === 'WORLD_CUP' && t.hostId === career.managerNationId
  const oppHosts = t.kind === 'WORLD_CUP' && t.hostId === opponent.id
  // Suspended players sit this one out: treat them as unavailable at kickoff
  // (the bench steps in), then the ban is served.
  const suspendedSet = new Set(career.suspendedIds)
  const careerForKickoff = suspendedSet.size
    ? { ...career, players: career.players.map((p) => (suspendedSet.has(p.id) ? { ...p, injuredWeeks: Math.max(1, p.injuredWeeks) } : p)) }
    : career
  const managerTeam = buildManagerTeam(careerForKickoff, iHost)
  const opponentTeam = buildOpponentTeam(opponent, career.seed, oppHosts, career.season, ratingOf(career.world, opponent.id))
  const home = isHome ? managerTeam : opponentTeam
  const away = isHome ? opponentTeam : managerTeam
  const seed = deriveSeed(career.seed, t.roundIndex, hashStr(opponent.id), 0xfeed)
  const result = simulateMatch(home, away, seed)

  const { players, aftermathNews } = applySquadAfterMatch(career, result, isHome, true)

  // Discipline desk: my side's cards accumulate across the tournament. Two
  // yellows = banned for the next match; a straight red = the same. Bans just
  // served are cleared.
  const mySide = isHome ? 'home' : 'away'
  let tourneyCards = { ...career.tourneyCards }
  let suspendedIds: string[] = [] // fresh: bans from THIS match only (old ones served today)
  const nextRoundLabel = 'the next match'
  for (const e of result.events) {
    if (e.side !== mySide) continue
    const pName = e.playerName
    if (e.type === 'RED') {
      if (!suspendedIds.includes(e.playerId)) suspendedIds.push(e.playerId)
      aftermathNews.push(mkStoreNews(`red-${e.playerId}-${career.week}`, career, 'SUSPENSION', 0.85,
        `RED CARD: ${pName} was sent off — he is SUSPENDED for ${nextRoundLabel}. The dressing room went quiet.`))
    } else if (e.type === 'YELLOW') {
      tourneyCards[e.playerId] = (tourneyCards[e.playerId] ?? 0) + 1
      if (tourneyCards[e.playerId] === 2) {
        if (!suspendedIds.includes(e.playerId)) suspendedIds.push(e.playerId)
        tourneyCards[e.playerId] = 0 // slate wiped after the ban
        aftermathNews.push(mkStoreNews(`accum-${e.playerId}-${career.week}`, career, 'SUSPENSION', 0.8,
          `${pName} picks up his second booking of the tournament — SUSPENDED for ${nextRoundLabel}. Reshuffle time.`))
      } else if (tourneyCards[e.playerId] === 1) {
        aftermathNews.push(mkStoreNews(`yellow-${e.playerId}-${career.week}`, career, 'BOOKING', 0.4,
          `${pName} goes into the book — one more yellow this tournament and he misses a match.`))
      }
    }
  }

  // Group games can end level; knockout ties are SETTLED — thirty minutes of
  // extra time on tired legs, then a kick-by-kick shootout if it must be.
  let settled = result
  if (ms.phase === 'KO' && result.homeGoals === result.awayGoals) {
    settled = settleKnockout(home, away, result, deriveSeed(seed, 7))
  }
  const result2 = settled
  const winnerSide = settled.shootout ? settled.shootout.winner : settled.homeGoals > settled.awayGoals ? 'home' : settled.homeGoals < settled.awayGoals ? 'away' : 'home'
  const homeNationId = isHome ? career.managerNationId : opponent.id
  const awayNationId = isHome ? opponent.id : career.managerNationId
  const tieResult: TieResult =
    ms.phase === 'GROUP'
      ? { aGoals: isHome ? result.homeGoals : result.awayGoals, bGoals: isHome ? result.awayGoals : result.homeGoals, winnerId: '', pens: false }
      : {
          aGoals: settled.homeGoals,
          bGoals: settled.awayGoals,
          winnerId: winnerSide === 'home' ? homeNationId : awayNationId,
          pens: !!settled.shootout,
          pensA: settled.shootout?.homePens,
          pensB: settled.shootout?.awayPens,
        }

  const mine = isHome ? result2.homeGoals : result2.awayGoals
  const theirs = isHome ? result2.awayGoals : result2.homeGoals
  // Tournament football grinds: everyone who played loses a little edge, so a
  // manager who never rotates arrives at the final on fumes.
  const playersTired = players.map((p) =>
    (isHome ? result2.ratingsHome : result2.ratingsAway).some((r) => r.playerId === p.id)
      ? { ...p, form: Math.max(20, p.form - 2) }
      : p,
  )
  const next = stepTournament(
    { ...career, players: playersTired, tourneyCards, suspendedIds, record: updateRecord(career.record, mine, theirs), h2h: updateH2h(career.h2h, opponent.id, mine, theirs) },
    tieResult,
  )
  // The manager's own match also gets a headline.
  const context = settled.shootout
    ? `the ${t.name} — ${settled.shootout.homePens}–${settled.shootout.awayPens} on penalties`
    : settled.extraTime
      ? `the ${t.name} after extra time`
      : `the ${t.name}`
  const headline = matchHeadline(result2, isHome, career.year, career.week, context)
  return { next: { ...next, news: [headline, ...aftermathNews, ...next.news].slice(0, 80) }, result: result2 }
}

// Resolve the current finals round (manager result applied if given, rest
// simmed), then surface champion / elimination news and bank any trophy.
// Finals ties hit the world ratings hardest — this is where eras shift.
function stepTournament(career: Career, managerResult: TieResult | null): Career {
  const t = career.tournament!
  const wasGroups = inGroupStage(t)
  const { t: newT, results } = resolveTournamentRound(t, managerResult, career.seed, career.season, career.world)
  const world = applyResults(career.world, results, 'finals')
  const news: NewsItem[] = []
  const history = [...career.history]
  let trophies = career.trophies
  let reputation = career.reputation
  let lastWcOutcome = career.lastWcOutcome
  const koRounds = totalRounds(newT.groups ? 8 : newT.field.length)
  const koIndex = t.roundIndex - groupStepCount(t)
  const rName = wasGroups ? `Group stage` : roundName(newT.kind, koIndex, koRounds)

  // Drama desk: shocks and the holders going out always make the front page.
  const holders = [...career.history].reverse().find((h) => h.type === 'WORLD_CUP')?.nationId
  let shocks = 0
  for (const r of results) {
    const decisive = r.shootout ? r.shootoutWinnerId : r.hg > r.ag ? r.homeId : r.hg < r.ag ? r.awayId : null
    if (!decisive) continue
    const loserId = decisive === r.homeId ? r.awayId : r.homeId
    if (loserId === career.managerNationId || decisive === career.managerNationId) continue
    if (wasGroups) continue // group games churn; the table tells the story
    const upset = ratingOf(career.world, decisive) < ratingOf(career.world, loserId) - 6
    if (newT.kind === 'WORLD_CUP' && holders && loserId === holders) {
      news.push(mkStoreNews(`holders-out-${career.season}`, career, 'SHOCK', 0.8,
        `The holders are OUT: ${ALL_NATIONS_BY_ID[loserId].name} fall to ${ALL_NATIONS_BY_ID[decisive].name} in the ${rName}${r.shootout ? ' on penalties' : ''}.`))
    } else if (upset && shocks < 2) {
      shocks++
      news.push(mkStoreNews(`shock-${career.season}-${t.roundIndex}-${shocks}`, career, 'SHOCK', 0.65,
        `Shock in the ${rName}: ${ALL_NATIONS_BY_ID[decisive].name} dump out ${ALL_NATIONS_BY_ID[loserId].name}.`))
    }
  }

  // Group-stage storytelling: where you stand, and what the last matchday needs.
  if (wasGroups && newT.inField && newT.groups) {
    const gi = newT.groups.findIndex((g) => g.teams.includes(career.managerNationId))
    const standings = newT.groups[gi].standings
    const pos = standings.findIndex((st) => st.nationId === career.managerNationId)
    if (newT.groupMatchday === 2 && !newT.eliminated) {
      const me = standings[pos]
      const third = standings[2]
      const secure = pos <= 1 && me.pts - third.pts >= 4
      news.push(mkStoreNews(`gs-scenario-${career.season}`, career, 'GROUP_STAGE', 0.85,
        secure
          ? `One matchday left and you're THROUGH — ${ordinalPos(pos + 1)} in Group ${'ABCD'[gi]} with daylight below. Rotate? Rest legs? Your call.`
          : pos <= 1
            ? `Top-two going into the final matchday, but it's tight in Group ${'ABCD'[gi]}. Win and you're safe. Slip, and the mathematics get cruel.`
            : `You're ${ordinalPos(pos + 1)} in Group ${'ABCD'[gi]} with one game left. Win big — and pray someone does you a favor.`))
    }
    if (newT.groupMatchday >= 3) {
      news.push(mkStoreNews(`gs-verdict-${career.season}`, career, 'GROUP_STAGE', newT.eliminated ? 0.95 : 0.9,
        newT.eliminated
          ? `It's over. ${ALL_NATIONS_BY_ID[career.managerNationId].name} finish ${ordinalPos(pos + 1)} in Group ${'ABCD'[gi]} and are OUT of the ${newT.name} at the group stage. The inquest begins.`
          : `${ALL_NATIONS_BY_ID[career.managerNationId].name} are through to the quarter-finals${pos === 0 ? ' as group winners' : ' in second place'}. Now it's knockout football.`))
      if (newT.kind === 'WORLD_CUP' && newT.eliminated) lastWcOutcome = 'R16'
    }
  }

  if (newT.champion) {
    const champ = ALL_NATIONS_BY_ID[newT.champion]
    const won = newT.champion === career.managerNationId
    const finalRound = newT.rounds[newT.rounds.length - 1]
    const finalTie = finalRound?.[0]
    const runnerUpId = finalTie ? (finalTie.winnerId === finalTie.aId ? finalTie.bId : finalTie.aId) : null
    const potm = playerOfTheTournament(career, newT.champion)
    news.push({
      id: `champ-${newT.kind}-${career.season}`,
      year: career.year,
      week: career.week,
      type: newT.kind === 'WORLD_CUP' ? 'WORLD_CUP' : 'CONTINENTAL',
      magnitude: 1,
      text: won
        ? `CHAMPIONS! ${champ.name} have won the ${newT.name}${newT.hostId === newT.champion ? ' ON HOME SOIL' : ''}. Scenes that will never be forgotten. ${potm.name} is named Player of the Tournament.`
        : `${champ.name} are crowned ${newT.name} champions. ${potm.name} takes Player of the Tournament.`,
    })
    if (won) trophies = [...trophies, { kind: newT.kind, name: newT.name, season: career.season } as Trophy]
    if (won) reputation = clampRep(career.reputation + (newT.kind === 'WORLD_CUP' ? 25 : 12))
    // Your Golden Boot: who carried the goals through this tournament?
    if (newT.inField) {
      const boot = career.players
        .map((p) => ({ p, g: p.intlGoals - (goalsAtTournamentStart[p.id] ?? p.intlGoals) }))
        .sort((a, b) => b.g - a.g)[0]
      if (boot && boot.g >= 2) {
        news.push(mkStoreNews(`boot-${newT.kind}-${career.season}`, career, 'GOLDEN_BOOT', 0.7,
          `⚽ Your boots of the summer: ${boot.p.name} finished the ${newT.name} with ${boot.g} goals.`))
      }
    }
    if (newT.kind === 'WORLD_CUP' && newT.inField) {
      lastWcOutcome = won ? 'WON' : career.managerNationId === runnerUpId ? 'FINAL' : lastWcOutcome
    }
    history.push({
      season: career.season,
      type: newT.kind === 'WORLD_CUP' ? 'WORLD_CUP' : 'CONTINENTAL',
      text: `${champ.name} win the ${newT.name}${runnerUpId ? ` (beat ${ALL_NATIONS_BY_ID[runnerUpId].name}${finalTie?.pens ? ` ${finalTie.pensA}–${finalTie.pensB} pens` : ` ${finalTie?.aGoals}–${finalTie?.bGoals}`} in the final)` : ''}${newT.hostId === newT.champion ? ' — as hosts' : ''} · ${potm.name} Player of the Tournament`,
      nationId: newT.champion,
      managerMoment: won,
    })
  } else if (newT.eliminated && !t.eliminated && !wasGroups) {
    if (newT.kind === 'WORLD_CUP') {
      const fromEnd = koRounds - 1 - koIndex
      lastWcOutcome = fromEnd === 0 ? 'FINAL' : fromEnd === 1 ? 'SEMI' : 'QUARTER'
    }
    news.push({
      id: `out-${newT.kind}-${career.season}-${t.roundIndex}`,
      year: career.year,
      week: career.week,
      type: 'KNOCKED_OUT',
      magnitude: 0.8,
      text: `${ALL_NATIONS_BY_ID[career.managerNationId].name} are out of the ${newT.name} at the ${rName} stage. The dream ends here — for now.`,
    })
  }

  return { ...career, tournament: newT, world, trophies, history, reputation, lastWcOutcome, news: [...news, ...career.news].slice(0, 80) }
}

function ordinalPos(n: number): string {
  return ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`
}

// Module-scope snapshot of squad goals when a finals tournament starts, so the
// Golden Boot can be tallied at its end. Transient by design (recomputed if the
// app reloads mid-tournament, the award just skips — acceptable).
let goalsAtTournamentStart: Record<string, number> = {}

// Calendar-driven tournament lifecycle: create the summer finals at its deadline,
// and auto-resolve rounds the manager isn't playing (eliminated or didn't enter).
function progressTournament(career: Career): Career {
  let c = career
  const slot = tournamentForYear(c.year)
  if (slot && c.week === TOURNAMENT_DEADLINE_WEEK && !c.tournament) {
    const include = slot === 'WORLD_CUP' ? worldCupInclusion(c) : true
    const t = createTournament(slot, c.managerNationId, c.seed, c.season, include, c.world, c.wcHostId)
    goalsAtTournamentStart = Object.fromEntries(c.players.map((p) => [p.id, p.intlGoals]))
    c = { ...c, tourneyCards: {}, suspendedIds: [], tournament: t, lastWcOutcome: slot === 'WORLD_CUP' && !t.inField ? 'MISSED' : c.lastWcOutcome, news: [tournamentDrawNews(t, c), ...c.news].slice(0, 80) }
  }

  const t = c.tournament
  if (t && !t.champion && stepWeeks(t)[t.roundIndex] === c.week && !managerStep(t)) {
    c = stepTournament(c, null) // a step the manager isn't playing — sim it
  }
  return c
}

function worldCupInclusion(career: Career): boolean {
  if (career.wcHostId === career.managerNationId) return true // hosts don't qualify
  return career.qualifiedForWorldCup
}

function tournamentDrawNews(t: Tournament, career: Career): NewsItem {
  const me = ALL_NATIONS_BY_ID[career.managerNationId].name
  let text: string
  if (!t.inField) {
    text = `The ${t.name} draw is made. ${me} aren't there — one to watch from home.`
  } else if (t.groups) {
    const gi = t.groups.findIndex((g) => g.teams.includes(career.managerNationId))
    const others = t.groups[gi].teams.filter((id) => id !== career.managerNationId).map((id) => ALL_NATIONS_BY_ID[id].name)
    const avg = t.groups[gi].teams.reduce((s2, id) => s2 + ratingOf(career.world, id), 0) / 4
    const toughest = t.groups.every((g) => g.teams.reduce((s3, id) => s3 + ratingOf(career.world, id), 0) / 4 <= avg + 0.01)
    text = `The ${t.name} draw: ${me} land in Group ${'ABCD'[gi]} with ${others.join(', ')}.${toughest ? " The press are already calling it the GROUP OF DEATH." : ''}${t.hostId === career.managerNationId ? ' And every match at home.' : ''}`
  } else {
    const ms = managerStep(t)
    text = ms
      ? `The ${t.name} is here! ${me} open against ${ALL_NATIONS_BY_ID[ms.opponentId].name} in the ${ms.label}.`
      : `The ${t.name} is here.`
  }
  return { id: `draw-${t.kind}-${career.season}`, year: career.year, week: career.week, type: 'DRAW', magnitude: 0.85, text }
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
  // Late drama deserves its own sentence in the record.
  let drama = ''
  if (Math.abs(mine - theirs) === 1) {
    const decisiveSide = mine > theirs ? (managerIsHome ? result.scorersHome : result.scorersAway) : (managerIsHome ? result.scorersAway : result.scorersHome)
    const last = decisiveSide.reduce((m, sc) => Math.max(m, sc.minute), 0)
    if (last >= 88) drama = mine > theirs ? ` Won at the death — ${last}'.` : ` Heartbreak in the ${last}th minute.`
  }
  return {
    id: `match-${myName}-${oppName}-${result.homeGoals}${result.awayGoals}-${year}${week}`,
    week,
    year,
    type: context === 'qualifying' ? 'QUALIFIER' : 'TOURNAMENT',
    magnitude: 0.6,
    text: `${myName} ${verb} ${oppName} ${result.homeGoals}–${result.awayGoals} in ${context}.${drama}${motm}`,
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

