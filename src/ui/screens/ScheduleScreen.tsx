import { useState } from 'react'
import { useGame } from '@/state/store'
import { NATIONS_BY_ID } from '@/data/nations'
import { windowAtWeek, fixtureKey } from '@/data/windows'
import { effectiveUpcoming } from '@/engine/fixtures'
import { MenuSheet } from '../components/MenuSheet'

export function ScheduleScreen() {
  const career = useGame((s) => s.career)!
  const advanceWeek = useGame((s) => s.advanceWeek)
  const go = useGame((s) => s.go)
  const [menuOpen, setMenuOpen] = useState(false)

  const nation = NATIONS_BY_ID[career.managerNationId]

  // A match to play THIS week?
  const matchWindow = windowAtWeek(career.week)
  const matchPending =
    matchWindow && !career.playedFixtures.includes(fixtureKey(career.season, matchWindow.id))

  // The upcoming window (for the next-window card + deadline), accounting for a
  // match already played this week.
  const upcoming = effectiveUpcoming(career)
  const upOpp = NATIONS_BY_ID[upcoming.fixture.opponentId]
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
            <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>MATCH WEEK · {matchWindow!.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 26 }}>⚽</span>
              <div>
                <div style={{ fontWeight: 800 }}>Play your match</div>
                <div className="muted" style={{ fontSize: 13 }}>Tap to take charge</div>
              </div>
              <div className="spacer" />
              <span className="faint">›</span>
            </div>
          </button>
        ) : (
          <div className="card windowcard">
            <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>NEXT WINDOW</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>{upcoming.window.label}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              vs {upOpp.name} · {upcoming.fixture.home ? 'Home' : 'Away'} · in {upcoming.weeksAway} week
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
            <button
              className="btn btn--block"
              style={{ marginTop: 10, background: locked ? 'var(--card)' : undefined }}
              onClick={() => go('squad-select')}
            >
              {locked ? 'View Locked Squad' : 'Select Squad'}
            </button>
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
          </div>
        ))}
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        {matchPending ? (
          <button className="btn btn--primary btn--lg btn--block" onClick={() => go('match')}>
            Play Match ›
          </button>
        ) : (
          <button className="btn btn--primary btn--lg btn--block" onClick={advanceWeek}>
            Advance Week ›
          </button>
        )}
      </div>

      {menuOpen && <MenuSheet onClose={() => setMenuOpen(false)} />}
    </div>
  )
}
