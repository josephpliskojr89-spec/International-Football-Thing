import { useMemo, useState } from 'react'
import { useGame } from '@/state/store'
import type { Career } from '@/engine/types'
import { InCareerHeader } from '../components/InCareerHeader'
import { freshnessColor, freshnessLabel } from '../display'

// Coverage allocation is the whole scouting game: you have fewer coaches than
// leagues holding your players. Point them where your pool clusters; the rest
// drift fuzzy. Assignment refreshes reads each week (handled in the calendar).
export function ScoutingScreen() {
  const career = useGame((s) => s.career)!
  const assignCoach = useGame((s) => s.assignCoach)
  const [picking, setPicking] = useState<string | null>(null)

  // Leagues where the manager actually has players, with pool counts.
  const leagues = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of career.players) counts.set(p.clubLeague, (counts.get(p.clubLeague) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [career.players])

  const assignedLeagues = new Set(career.coaches.map((c) => c.leagueAssignment).filter(Boolean))
  const coveredCount = career.players.filter((p) => assignedLeagues.has(p.clubLeague)).length
  const coveredPct = Math.round((coveredCount / Math.max(1, career.players.length)) * 100)

  return (
    <div className="screen">
      <InCareerHeader title="Scouting" sub={`${coveredPct}% of your pool covered`} />

      <div className="screen__body">
        <div className="card">
          <div className="muted" style={{ fontSize: 14 }}>
            Each coach keeps your players in one league sharp. You have fewer coaches than leagues —
            point them where your pool clusters and accept blind spots elsewhere.
          </div>
        </div>

        <div className="sectionhdr">Your Coaches</div>
        {career.coaches.map((coach) => {
          const covers = coach.leagueAssignment
            ? career.players.filter((p) => p.clubLeague === coach.leagueAssignment).length
            : 0
          return (
            <button key={coach.id} className="card" style={{ textAlign: 'left' }} onClick={() => setPicking(coach.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🧭</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{coach.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {coach.leagueAssignment
                      ? `${coach.leagueAssignment} · covering ${covers}`
                      : 'Unassigned — covering nobody'}
                  </div>
                </div>
                <span className="faint">change ›</span>
              </div>
            </button>
          )
        })}

        <div className="sectionhdr">Coverage by League</div>
        {leagues.map(([league, count]) => {
          const covered = assignedLeagues.has(league)
          return (
            <div key={league} className="prow" style={{ cursor: 'default' }}>
              <span
                className="prow__pos"
                style={{ background: covered ? 'var(--good)' : 'var(--line)', color: covered ? '#07111f' : 'var(--text-dim)' }}
              >
                {count}
              </span>
              <span className="prow__main">
                <span className="prow__name">{league}</span>
                <span className="prow__sub">{covered ? 'Covered — reads stay sharp' : 'Uncovered — reads drift fuzzy'}</span>
              </span>
            </div>
          )
        })}
      </div>

      {picking && (
        <LeaguePicker
          current={career.coaches.find((c) => c.id === picking)?.leagueAssignment ?? null}
          leagues={leagues}
          career={career}
          onPick={(league) => {
            assignCoach(picking, league)
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}

function LeaguePicker({
  current,
  leagues,
  career,
  onPick,
  onClose,
}: {
  current: string | null
  leagues: [string, number][]
  career: Career
  onPick: (league: string | null) => void
  onClose: () => void
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        <div className="sectionhdr" style={{ marginBottom: 8 }}>
          Assign to league
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leagues.map(([league, count]) => {
            const sample = career.players.filter((p) => p.clubLeague === league)
            const avgFresh = Math.round(sample.reduce((s, p) => s + p.freshness, 0) / Math.max(1, sample.length))
            return (
              <button
                key={league}
                className={`nation-card ${current === league ? 'on' : ''}`}
                style={{ width: '100%' }}
                onClick={() => onPick(league)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="nation-card__name">{league}</span>
                  <span style={{ color: freshnessColor(avgFresh), fontSize: 12, fontWeight: 700 }}>
                    {freshnessLabel(avgFresh)}
                  </span>
                </div>
                <div className="nation-card__sub">{count} of your players</div>
              </button>
            )
          })}
        </div>
        <button className="btn btn--ghost btn--block" style={{ marginTop: 12 }} onClick={() => onPick(null)}>
          Leave unassigned
        </button>
      </div>
    </div>
  )
}
