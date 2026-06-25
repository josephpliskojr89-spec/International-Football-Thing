import { useMemo, useState } from 'react'
import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { windowAtWeek } from '@/data/windows'
import { currentFixture } from '@/engine/fixtures'
import { STYLE_LABELS } from '@/data/tactics'
import type { MatchResult } from '@/engine/match'

export function MatchScreen() {
  const career = useGame((s) => s.career)!
  const go = useGame((s) => s.go)
  const playScheduledMatch = useGame((s) => s.playScheduledMatch)

  const window = windowAtWeek(career.week)
  const fixture = useMemo(() => currentFixture(career), [career])

  const focal = career.tactics.focalPointId
    ? career.players.find((p) => p.id === career.tactics.focalPointId)
    : null
  const [result, setResult] = useState<MatchResult | null>(null)

  if (!window || !fixture) {
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

  const isHome = fixture.home
  const me = ALL_NATIONS_BY_ID[career.managerNationId]
  const opp = ALL_NATIONS_BY_ID[fixture.opponentId]

  if (result) {
    return <MatchResultView result={result} managerIsHome={isHome} onDone={() => go('schedule')} />
  }

  const kickOff = () => setResult(playScheduledMatch())

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={() => go('schedule')}>
          ‹
        </button>
        <div>
          <div className="topbar__title">{window.label}</div>
          <div className="topbar__sub">{isHome ? 'Home' : 'Away'} · {career.formation}</div>
        </div>
      </div>

      <div className="screen__body">
        <div className="card center" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>FIXTURE</div>
          <div style={{ fontSize: 22, fontWeight: 900, margin: '6px 0' }}>
            {isHome ? me.name : opp.name} v {isHome ? opp.name : me.name}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            World Cup Qualifier · {opp.name} ({opp.nationRating}) play {opp.tacticalIdentity}
          </div>
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

function MatchResultView({
  result,
  managerIsHome,
  onDone,
}: {
  result: MatchResult
  managerIsHome: boolean
  onDone: () => void
}) {
  const mine = managerIsHome ? result.homeGoals : result.awayGoals
  const theirs = managerIsHome ? result.awayGoals : result.homeGoals
  const verdict = mine > theirs ? 'WIN' : mine < theirs ? 'LOSS' : 'DRAW'
  const verdictColor = mine > theirs ? 'var(--good)' : mine < theirs ? 'var(--bad)' : 'var(--warn)'

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

        <StatBar label="Possession" home={result.possessionHome} away={100 - result.possessionHome} unit="%" />
        <StatBar
          label="Expected Goals (xG)"
          home={result.xgHome}
          away={result.xgAway}
          unit=""
          ratio={result.xgHome / (result.xgHome + result.xgAway)}
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

function ratingColor(r: number): string {
  if (r >= 8) return 'var(--gold)'
  if (r >= 7) return 'var(--good)'
  if (r >= 6) return 'var(--ok)'
  return 'var(--warn)'
}
