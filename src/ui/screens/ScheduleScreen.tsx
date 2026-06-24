import { useState } from 'react'
import { useGame } from '@/state/store'
import { NATIONS_BY_ID } from '@/data/nations'
import { MenuSheet } from '../components/MenuSheet'

export function ScheduleScreen() {
  const career = useGame((s) => s.career)!
  const advanceWeek = useGame((s) => s.advanceWeek)
  const [menuOpen, setMenuOpen] = useState(false)

  const nation = NATIONS_BY_ID[career.managerNationId]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={() => setMenuOpen(true)} aria-label="Menu">
          ☰
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="topbar__title">{nation.name}</div>
          <div className="topbar__sub">
            {career.managerName} · Cycle Year {career.year}
          </div>
        </div>
        <div className="spacer" />
        <div className="center">
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>WEEK</div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{career.week}</div>
        </div>
      </div>

      <div className="screen__body">
        <WeekCard week={career.week} year={career.year} />

        <div className="sectionhdr">News Feed</div>
        {career.news.length === 0 && (
          <div className="newscard">
            <div className="newscard__text muted">A quiet week. Advance to see what develops.</div>
          </div>
        )}
        {career.news.map((item) => (
          <div className="newscard" key={item.id}>
            <div className="newscard__meta">
              Y{item.year} · W{item.week} · {item.type}
            </div>
            <div className="newscard__text">{item.text}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        <button className="btn btn--primary btn--lg btn--block" onClick={advanceWeek}>
          Advance Week ›
        </button>
      </div>

      {menuOpen && <MenuSheet onClose={() => setMenuOpen(false)} />}
    </div>
  )
}

function WeekCard({ week, year }: { week: number; year: number }) {
  // Placeholder schedule context. Real fixtures / window types (competitive,
  // friendly, tournament) and "attend match" land with the calendar milestone.
  const phase = weekPhase(week)
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'grid',
            placeItems: 'center',
            color: '#07111f',
            fontWeight: 900,
            fontSize: 20,
          }}
        >
          W{week}
        </div>
        <div>
          <div style={{ fontWeight: 800 }}>{phase.title}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {phase.sub} · Year {year} of the cycle
          </div>
        </div>
      </div>
    </div>
  )
}

function weekPhase(week: number): { title: string; sub: string } {
  if (week >= 24 && week <= 32) return { title: 'Summer Window', sub: 'Tournament season ahead' }
  if (week % 8 === 0) return { title: 'International Window', sub: 'Squad selection time' }
  return { title: 'Club Season', sub: 'Players developing at their clubs' }
}
