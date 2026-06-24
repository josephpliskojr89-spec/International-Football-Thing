import { useMemo, useState } from 'react'
import { useGame } from '@/state/store'
import { NATIONS, NATIONS_BY_ID } from '@/data/nations'
import { defaultStyleForApproach } from '@/engine/matchSetup'
import type { PlayStyle } from '@/engine/types'
import type { MatchResult } from '@/engine/match'

const STYLES: PlayStyle[] = ['Balanced', 'Possession', 'Counter', 'Direct', 'HighPress']

export function MatchScreen() {
  const career = useGame((s) => s.career)!
  const go = useGame((s) => s.go)
  const playExhibition = useGame((s) => s.playExhibition)

  const opponents = useMemo(
    () => NATIONS.filter((n) => n.id !== career.managerNationId).sort((a, b) => b.nationRating - a.nationRating),
    [career.managerNationId],
  )

  const [opponentId, setOpponentId] = useState<string | null>(null)
  const [style, setStyle] = useState<PlayStyle>(defaultStyleForApproach(career.style.approach))
  const [home, setHome] = useState(true)
  const [result, setResult] = useState<MatchResult | null>(null)

  const kickOff = () => {
    if (!opponentId) return
    setResult(playExhibition(opponentId, style, home))
  }

  if (result) {
    return <MatchResultView result={result} managerIsHome={home} onDone={() => go('schedule')} />
  }

  const me = NATIONS_BY_ID[career.managerNationId]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={() => go('schedule')} aria-label="Back">
          ‹
        </button>
        <div>
          <div className="topbar__title">Friendly</div>
          <div className="topbar__sub">{me.name} · {career.formation}</div>
        </div>
      </div>

      <div className="screen__body">
        <div className="sectionhdr">Opponent</div>
        <div className="nation-grid">
          {opponents.map((n) => (
            <button
              key={n.id}
              className={`nation-card ${opponentId === n.id ? 'on' : ''}`}
              onClick={() => setOpponentId(n.id)}
            >
              <div className="nation-card__name">{n.name}</div>
              <div className="nation-card__sub">
                Rating {n.nationRating} · {n.tacticalIdentity}
              </div>
            </button>
          ))}
        </div>

        <div className="sectionhdr">Your match plan</div>
        <div className="card">
          <div className="field-label">Style</div>
          <div className="chiprow">
            {STYLES.map((s) => (
              <button key={s} className={`chip ${style === s ? 'chip--on' : ''}`} onClick={() => setStyle(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="field-label" style={{ marginTop: 12 }}>
            Venue
          </div>
          <div className="segmented">
            <button className={home ? 'on' : ''} onClick={() => setHome(true)}>
              Home
            </button>
            <button className={!home ? 'on' : ''} onClick={() => setHome(false)}>
              Away
            </button>
          </div>
          <div className="faint" style={{ fontSize: 13, marginTop: 10 }}>
            Selecting your XI? Edit it on the Squad screen — this match uses your current lineup.
          </div>
        </div>
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        <button className="btn btn--primary btn--lg btn--block" disabled={!opponentId} onClick={kickOff}>
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
          <summary style={{ fontWeight: 700 }}>Player ratings — {managerIsHome ? result.homeName : result.awayName}</summary>
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
