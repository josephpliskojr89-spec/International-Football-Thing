import { useState } from 'react'
import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID, NATIONS_BY_ID } from '@/data/nations'
import { effectiveUpcoming, currentMatch } from '@/engine/fixtures'
import { MenuSheet } from '../components/MenuSheet'

export function ScheduleScreen() {
  const career = useGame((s) => s.career)!
  const advanceWeek = useGame((s) => s.advanceWeek)
  const advanceToNextEvent = useGame((s) => s.advanceToNextEvent)
  const go = useGame((s) => s.go)
  const sendScout = useGame((s) => s.sendScout)
  const [menuOpen, setMenuOpen] = useState(false)

  const scoutsLeft = career.coaches.filter((c) => !c.targetedLookUsed).length

  const nation = NATIONS_BY_ID[career.managerNationId]

  // A match to play THIS week (qualifier OR a finals knockout tie)?
  const match = currentMatch(career)
  const matchPending = !!match
  const isTournamentMatch = match?.type === 'TOURNAMENT'

  // An active summer finals tournament (running but not yet over), even on a week
  // the manager isn't playing (eliminated / watching / between rounds).
  const tournament = career.tournament && !career.tournament.champion ? career.tournament : null

  // The upcoming window (for the next-window card + deadline), accounting for a
  // match already played this week.
  const upcoming = effectiveUpcoming(career)
  const upOpp = upcoming.fixture ? ALL_NATIONS_BY_ID[upcoming.fixture.opponentId] : null
  const locked = upcoming.locked
  const weeksToDeadline = upcoming.nextYear
    ? null
    : Math.max(0, upcoming.window.deadlineWeek - career.week)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={() => setMenuOpen(true)} aria-label="Menu">
          ☰
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="topbar__title">{nation.name}</div>
          <div className="topbar__sub">
            {career.managerName} · Yr {career.year} · Season {career.season}
          </div>
        </div>
        <div className="spacer" />
        <div className="center">
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>WEEK</div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{career.week}</div>
        </div>
      </div>

      <div className="screen__body">
        {matchPending ? (
          <button className="card windowcard" onClick={() => go('match')} style={{ textAlign: 'left' }}>
            <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
              {isTournamentMatch ? `${match!.label.toUpperCase()} · ${match!.round}` : `MATCH WEEK · ${match!.label}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 26 }}>{isTournamentMatch ? '🏆' : '⚽'}</span>
              <div>
                <div style={{ fontWeight: 800 }}>
                  {isTournamentMatch ? `vs ${ALL_NATIONS_BY_ID[match!.opponentId].name}` : 'Play your match'}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>Tap to take charge</div>
              </div>
              <div className="spacer" />
              <span className="faint">›</span>
            </div>
          </button>
        ) : tournament ? (
          <button className="card windowcard" onClick={() => go('bracket')} style={{ textAlign: 'left' }}>
            <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>{tournament.name.toUpperCase()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 26 }}>🏆</span>
              <div>
                <div style={{ fontWeight: 800 }}>
                  {tournament.eliminated ? 'You are out — follow the bracket' : 'Finals are underway'}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>Tap to view the bracket</div>
              </div>
              <div className="spacer" />
              <span className="faint">›</span>
            </div>
          </button>
        ) : (
          <div className="card windowcard">
            <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
              {upcoming.fixture?.competitive === false ? 'NEXT FRIENDLY' : 'NEXT QUALIFIER'} · {upcoming.window.label}
            </div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>
              {upOpp ? `vs ${upOpp.name}` : upcoming.fixture?.competitive === false ? 'Friendly' : 'Qualifying'}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {upcoming.fixture ? `${upcoming.fixture.home ? 'Home' : 'Away'} · ` : ''}in {upcoming.weeksAway} week
              {upcoming.weeksAway === 1 ? '' : 's'}
            </div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              {locked ? (
                <span className="deadline-locked">🔒 Squad locked for this window</span>
              ) : weeksToDeadline === 0 ? (
                <span className="deadline-locked">Registration closes this week</span>
              ) : (
                <span className="deadline-open">
                  Registration open · {weeksToDeadline} week{weeksToDeadline === 1 ? '' : 's'} to deadline
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                className="btn btn--block"
                style={{ background: locked ? 'var(--card)' : undefined }}
                onClick={() => go('squad-select')}
              >
                {locked ? 'View Squad' : 'Select Squad'}
              </button>
              <button className="btn btn--block" onClick={() => go('standings')}>
                Standings
              </button>
            </div>
          </div>
        )}

        <div className="sectionhdr">News Feed</div>
        {career.news.length === 0 && (
          <div className="newscard">
            <div className="newscard__text muted">A quiet week. Advance to see what develops.</div>
          </div>
        )}
        {career.news.map((item) => (
          <div className="newscard" key={item.id}>
            <div className="newscard__meta">
              Yr{item.year} · Wk{item.week} · {item.type.replace(/_/g, ' ')}
            </div>
            <div className="newscard__text">{item.text}</div>
            {item.action === 'SEND_SCOUT' && item.subjectId && (
              <button
                className="btn newsaction"
                disabled={scoutsLeft === 0}
                onClick={() => sendScout(item.id, item.subjectId!)}
              >
                {scoutsLeft === 0 ? '🔍 No scouts available' : `🔍 Send a scout (${scoutsLeft} left)`}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        {career.sackedFrom ? (
          <button className="btn btn--primary btn--lg btn--block" onClick={() => go('offers')}>
            You've been sacked — choose your next chapter ›
          </button>
        ) : matchPending ? (
          <button className="btn btn--primary btn--lg btn--block" onClick={() => go('match')}>
            Play Match ›
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--lg" style={{ flex: 1 }} onClick={advanceWeek}>
              +1 Week
            </button>
            <button className="btn btn--primary btn--lg" style={{ flex: 2 }} onClick={advanceToNextEvent}>
              ⏩ To next event
            </button>
          </div>
        )}
      </div>

      {menuOpen && <MenuSheet onClose={() => setMenuOpen(false)} />}
    </div>
  )
}
