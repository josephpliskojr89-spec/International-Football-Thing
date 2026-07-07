import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { currentMatch } from '@/engine/fixtures'
import { ratingOf, worldRankOf } from '@/engine/world'
import { nationalManagerName } from '@/engine/manager'
import { STYLE_LABELS } from '@/data/tactics'
import type { MatchResult } from '@/engine/match'
import { matchStory } from '@/engine/matchStory'
import { buildTimeline, type TickerEntry } from '@/engine/commentary'
import { styleMatchup } from '@/engine/match'

export function MatchScreen() {
  const career = useGame((s) => s.career)!
  const go = useGame((s) => s.go)
  const playCurrentMatch = useGame((s) => s.playCurrentMatch)

  const match = useMemo(() => currentMatch(career), [career])

  const focal = career.tactics.focalPointId
    ? career.players.find((p) => p.id === career.tactics.focalPointId)
    : null
  const [result, setResult] = useState<MatchResult | null>(null)
  // Capture the played-match venue at kickoff: after playing, `career` advances
  // to the next fixture, so the result view must not re-read the live fixture.
  const [playedHome, setPlayedHome] = useState(false)
  const [playedWeek, setPlayedWeek] = useState(1)
  const [liveDone, setLiveDone] = useState(false)

  // Result FIRST: after kickoff the fixture is consumed (currentMatch goes
  // null), but the full-time screen must still show. Guard order is load-bearing.
  // The match plays LIVE first — a minute a second — then the full-time report.
  if (result && !liveDone) {
    return <LiveMatchView result={result} managerIsHome={playedHome} onDone={() => setLiveDone(true)} />
  }
  if (result) {
    return <MatchResultView result={result} managerIsHome={playedHome} week={playedWeek} onDone={() => go('schedule')} />
  }

  if (!match) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="iconbtn" onClick={() => go('schedule')}>
            ‹
          </button>
          <div className="topbar__title">No match</div>
        </div>
        <div className="screen__body">
          <div className="card center muted">There's no scheduled match this week.</div>
        </div>
      </div>
    )
  }

  const isHome = match.home
  const me = ALL_NATIONS_BY_ID[career.managerNationId]
  const opp = ALL_NATIONS_BY_ID[match.opponentId]
  const isTournament = match.type === 'TOURNAMENT'
  const compLabel = isTournament ? `${match.label} · ${match.round}` : match.label

  const kickOff = () => {
    const r = playCurrentMatch()
    if (r) {
      setPlayedHome(isHome) // captured before career advances
      setPlayedWeek(career.week)
      setLiveDone(false)
      setResult(r)
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={() => go('schedule')}>
          ‹
        </button>
        <div>
          <div className="topbar__title">{isTournament ? match.round : match.label}</div>
          <div className="topbar__sub">
            {isTournament && match.neutral ? 'Neutral venue' : isHome ? 'Home' : 'Away'} · {career.formation}
          </div>
        </div>
      </div>

      <div className="screen__body">
        <div className="card center" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
            {isTournament ? match.label.toUpperCase() : 'FIXTURE'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, margin: '6px 0' }}>
            {isHome ? me.name : opp.name} v {isHome ? opp.name : me.name}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {compLabel} · {opp.name} ({ordinalRank(worldRankOf(career.world, opp.id))} in the world,{' '}
            {Math.round(ratingOf(career.world, opp.id))}) play {opp.tacticalIdentity}
          </div>
          {isTournament && (
            <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
              {match.round.startsWith('Group') ? 'Group stage — a draw is a real result.' : 'Knockout — a draw goes to a penalty shootout.'}
            </div>
          )}
          <DugoutLine career={career} oppId={opp.id} />
          <StyleIntel mine={career.tactics.style} theirs={opp.tacticalIdentity} />
        </div>

        <div className="card">
          <div className="field-label">Your match plan</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 2 }}>
            <span className="muted">Style</span>
            <span>{STYLE_LABELS[career.tactics.style]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}>
            <span className="muted">Play through</span>
            <span>{focal ? focal.name : 'Even — no focal point'}</span>
          </div>
          <div className="faint" style={{ fontSize: 13, marginTop: 10 }}>
            Set your style, focal point and XI on the Squad → Tactics tab.
          </div>
        </div>
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        <button className="btn btn--primary btn--lg btn--block" onClick={kickOff}>
          Kick Off ›
        </button>
      </div>
    </div>
  )
}

// The rival dugout + your duel history vs this nation. Same face for years,
// then one day a new name — and the record carries on regardless.
function DugoutLine({ career, oppId }: { career: import('@/engine/types').Career; oppId: string }) {
  const boss = nationalManagerName(oppId, career.season, career.seed)
  const h = career.h2h[oppId]
  const duel = h
    ? h.w > h.l
      ? ` You lead this duel ${h.w}–${h.l}${h.d ? ` (${h.d} drawn)` : ''}.`
      : h.l > h.w
        ? ` They lead this duel ${h.l}–${h.w}${h.d ? ` (${h.d} drawn)` : ''} — a score to settle.`
        : ` The duel is level at ${h.w}–${h.l}.`
    : ' First meeting on your watch.'
  return (
    <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
      In their dugout: {boss}.{duel}
    </div>
  )
}

// The style wheel, surfaced: your setup vs their known identity.
function StyleIntel({ mine, theirs }: { mine: import('@/engine/types').PlayStyle; theirs: import('@/engine/types').PlayStyle }) {
  const m = styleMatchup(mine, theirs)
  if (m.edge === 0) return null
  return (
    <div style={{ fontSize: 12, marginTop: 4, color: m.edge === 1 ? 'var(--good)' : 'var(--warn)', fontWeight: 600 }}>
      {m.edge === 1 ? '▲' : '⚠'} {m.note}.
    </div>
  )
}

// Watch the match at very high speed: the deterministic result is already
// known to the engine, but YOU live it minute by minute — goals land when they
// landed, the clock runs at ~1 game-minute per real second (faster on demand),
// and a shootout plays out kick by kick.
function LiveMatchView({
  result,
  managerIsHome,
  onDone,
}: {
  result: MatchResult
  managerIsHome: boolean
  onDone: () => void
}) {
  const timeline = useMemo(() => buildTimeline(result), [result])
  const regEntries = useMemo(() => timeline.filter((e) => e.minute <= 120.5), [timeline])
  const penEntries = useMemo(() => timeline.filter((e) => e.minute > 120.5), [timeline])
  const lastRegMinute = regEntries.length ? regEntries[regEntries.length - 1].minute : 90

  const [clock, setClock] = useState(0)
  const [pensShown, setPensShown] = useState(0)
  const [speed, setSpeed] = useState(1) // 1x = 900ms per game-minute
  const feedRef = useRef<HTMLDivElement>(null)

  const finished = clock >= lastRegMinute && pensShown >= penEntries.length

  useEffect(() => {
    if (finished) return
    const msPerMin = 900 / speed
    const id = setInterval(() => {
      setClock((c) => {
        if (c < lastRegMinute) return c + 1
        return c
      })
      if (clock >= lastRegMinute && penEntries.length > 0) {
        setPensShown((n) => Math.min(penEntries.length, n + 1))
      }
    }, clock >= lastRegMinute ? 1300 : msPerMin)
    return () => clearInterval(id)
  }, [speed, clock, lastRegMinute, penEntries.length, finished])

  const shown = [
    ...regEntries.filter((e) => e.minute <= clock),
    ...penEntries.slice(0, pensShown),
  ]
  const latest = shown[shown.length - 1]
  const liveH = latest?.homeScore ?? 0
  const liveA = latest?.awayScore ?? 0
  const livePens = latest?.pens

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 })
  }, [shown.length])

  const displayMinute = Math.min(Math.floor(clock), result.extraTime ? 120 : 90)
  const inPens = clock >= lastRegMinute && penEntries.length > 0

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="topbar__title" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {result.homeName} {liveH}–{liveA} {result.awayName}
            {livePens ? ` (${livePens.home}–${livePens.away} pens)` : ''}
          </div>
          <div className="topbar__sub">{inPens ? 'PENALTY SHOOTOUT' : `${displayMinute}'`} · LIVE</div>
        </div>
        <button
          className="iconbtn"
          onClick={() => setSpeed((sp) => (sp === 1 ? 2 : sp === 2 ? 4 : 1))}
          aria-label="Speed"
          style={{ fontSize: 13, fontWeight: 800 }}
        >
          {speed}×
        </button>
      </div>

      <div className="screen__body" ref={feedRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[...shown].reverse().map((e) => (
          <TickerRow key={`${e.order}`} e={e} managerIsHome={managerIsHome} homeName={result.homeName} />
        ))}
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        {finished ? (
          <button className="btn btn--primary btn--lg btn--block" onClick={onDone}>
            Full-time report ›
          </button>
        ) : (
          <button
            className="btn btn--lg btn--block"
            onClick={() => {
              setClock(lastRegMinute)
              setPensShown(penEntries.length)
            }}
          >
            ⏩ Skip to full time
          </button>
        )}
      </div>
    </div>
  )
}

function TickerRow({ e, managerIsHome, homeName }: { e: TickerEntry; managerIsHome: boolean; homeName: string }) {
  const icon =
    e.kind === 'GOAL' ? '⚽' : e.kind === 'RED' ? '🟥' : e.kind === 'YELLOW' ? '🟨' : e.kind === 'INJURY' ? '🚑'
    : e.kind === 'PEN' ? '🥅' : e.kind === 'HT' || e.kind === 'FT' || e.kind === 'ET' ? '⏱' : e.kind === 'END' ? '🏁' : ''
  const big = e.kind === 'GOAL' || e.kind === 'RED' || e.kind === 'END' || e.kind === 'ET'
  const minuteLabel = e.minute > 120.5 ? 'PENS' : `${Math.floor(e.minute)}'`
  void managerIsHome
  void homeName
  return (
    <div
      className="card"
      style={{
        padding: '8px 12px',
        display: 'flex',
        gap: 10,
        alignItems: 'baseline',
        fontWeight: big ? 800 : 400,
        fontSize: big ? 14.5 : 13.5,
        borderLeft: e.kind === 'GOAL' ? '3px solid var(--good)' : e.kind === 'RED' ? '3px solid var(--bad)' : undefined,
      }}
    >
      <span className="faint" style={{ fontSize: 11, minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>
        {minuteLabel}
      </span>
      <span style={{ flex: 1, lineHeight: 1.45 }}>
        {icon && `${icon} `}
        {e.text}
      </span>
    </div>
  )
}

function MatchResultView({
  result,
  managerIsHome,
  week,
  onDone,
}: {
  result: MatchResult
  managerIsHome: boolean
  week: number
  onDone: () => void
}) {
  const mine = managerIsHome ? result.homeGoals : result.awayGoals
  const theirs = managerIsHome ? result.awayGoals : result.homeGoals
  const wonShootout = result.shootout ? (result.shootout.winner === 'home') === managerIsHome : null
  const verdict =
    wonShootout !== null ? (wonShootout ? 'WIN · PENS' : 'LOSS · PENS') : mine > theirs ? 'WIN' : mine < theirs ? 'LOSS' : 'DRAW'
  const verdictColor =
    wonShootout !== null
      ? wonShootout ? 'var(--good)' : 'var(--bad)'
      : mine > theirs ? 'var(--good)' : mine < theirs ? 'var(--bad)' : 'var(--warn)'

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar__title">Full Time</div>
      </div>
      <div className="screen__body">
        <div className="card scorecard">
          <div className="scorecard__verdict" style={{ color: verdictColor }}>
            {verdict}
          </div>
          <div className="scoreline">
            <div className="scoreline__team">{result.homeName}</div>
            <div className="scoreline__score">
              {result.homeGoals}–{result.awayGoals}
              {result.extraTime && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)' }}>AET</div>}
            </div>
            <div className="scoreline__team">{result.awayName}</div>
          </div>
          <div className="scorers">
            <div className="scorers__col">
              {result.scorersHome.map((s, i) => (
                <div key={i} className="scorers__item">
                  {s.name} {s.minute}'
                </div>
              ))}
            </div>
            <div className="scorers__col scorers__col--right">
              {result.scorersAway.map((s, i) => (
                <div key={i} className="scorers__item">
                  {s.minute}' {s.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {result.shootout && (
          <div className="card">
            <div className="field-label">
              Penalty shootout · {result.shootout.homePens}–{result.shootout.awayPens}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {result.shootout.kicks.map((k, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ opacity: (k.side === 'home') === managerIsHome ? 1 : 0.65 }}>
                    {k.side === 'home' ? result.homeName : result.awayName} · {k.taker}
                  </span>
                  <span>{k.scored ? '⚽' : '❌'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ fontSize: 14, lineHeight: 1.6 }}>
          <div className="field-label">The story of the match</div>
          <div style={{ marginTop: 4 }}>{matchStory(result, managerIsHome, week)}</div>
        </div>

        <StatBar label="Possession" home={result.possessionHome} away={100 - result.possessionHome} unit="%" />
        <StatBar
          label="Expected Goals (xG)"
          home={result.xgHome}
          away={result.xgAway}
          unit=""
          ratio={result.xgHome + result.xgAway > 0 ? result.xgHome / (result.xgHome + result.xgAway) : 0.5}
        />

        {result.motm && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>⭐</span>
            <div>
              <div style={{ fontWeight: 800 }}>{result.motm.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Man of the Match · {result.motm.rating.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        <details className="card">
          <summary style={{ fontWeight: 700 }}>
            Player ratings — {managerIsHome ? result.homeName : result.awayName}
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(managerIsHome ? result.ratingsHome : result.ratingsAway).map((r) => (
              <div key={r.playerId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>
                  {r.name}
                  {r.goals > 0 ? ` ${'⚽'.repeat(r.goals)}` : ''}
                </span>
                <span style={{ fontWeight: 800, color: ratingColor(r.rating) }}>{r.rating.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        <button className="btn btn--primary btn--lg btn--block" onClick={onDone}>
          Continue
        </button>
      </div>
    </div>
  )
}

function StatBar({
  label,
  home,
  away,
  unit,
  ratio,
}: {
  label: string
  home: number
  away: number
  unit: string
  ratio?: number
}) {
  const pct = ratio !== undefined ? ratio * 100 : home
  return (
    <div className="card statbar">
      <div className="statbar__head">
        <span>
          {home}
          {unit}
        </span>
        <span className="muted">{label}</span>
        <span>
          {away}
          {unit}
        </span>
      </div>
      <div className="statbar__track">
        <div className="statbar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ordinalRank(n: number): string {
  if (n <= 0) return 'unranked'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function ratingColor(r: number): string {
  if (r >= 8) return 'var(--gold)'
  if (r >= 7) return 'var(--good)'
  if (r >= 6) return 'var(--ok)'
  return 'var(--warn)'
}
