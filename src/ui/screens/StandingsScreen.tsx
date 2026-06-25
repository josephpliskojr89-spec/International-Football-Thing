import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { InCareerHeader } from '../components/InCareerHeader'

export function StandingsScreen() {
  const career = useGame((s) => s.career)!
  const camp = career.campaign
  const played = camp.matchdayIndex
  const total = camp.matchdays.length

  return (
    <div className="screen">
      <InCareerHeader title="Qualifying Group" sub={`Matchday ${Math.min(played + 1, total)} of ${total}`} />

      <div className="screen__body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="standrow standrow--head">
            <span className="stand__pos">#</span>
            <span className="stand__team">Team</span>
            <span className="stand__num">P</span>
            <span className="stand__num">W</span>
            <span className="stand__num">D</span>
            <span className="stand__num">L</span>
            <span className="stand__num">GD</span>
            <span className="stand__num stand__pts">Pts</span>
          </div>
          {camp.standings.map((s, i) => {
            const isMe = s.nationId === career.managerNationId
            const qualifies = i < camp.qualifyCount
            const nation = ALL_NATIONS_BY_ID[s.nationId]
            return (
              <div key={s.nationId} className={`standrow ${isMe ? 'standrow--me' : ''}`}>
                <span className="stand__pos">
                  <span className={`stand__dot ${qualifies ? 'q' : ''}`} />
                  {i + 1}
                </span>
                <span className="stand__team">{nation?.name ?? s.nationId}</span>
                <span className="stand__num">{s.p}</span>
                <span className="stand__num">{s.w}</span>
                <span className="stand__num">{s.d}</span>
                <span className="stand__num">{s.l}</span>
                <span className="stand__num">{s.gf - s.ga > 0 ? '+' : ''}{s.gf - s.ga}</span>
                <span className="stand__num stand__pts">{s.pts}</span>
              </div>
            )
          })}
        </div>
        <div className="faint" style={{ fontSize: 12 }}>
          <span className="stand__dot q" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Top{' '}
          {camp.qualifyCount} qualify for the World Cup.
        </div>

        {camp.recentResults.length > 0 && (
          <>
            <div className="sectionhdr">Latest results</div>
            {camp.recentResults.map((r, i) => (
              <div key={i} className="prow" style={{ cursor: 'default' }}>
                <span className="prow__main">
                  <span className="prow__name" style={{ fontWeight: 600 }}>
                    {ALL_NATIONS_BY_ID[r.homeId]?.name} {r.hg}–{r.ag} {ALL_NATIONS_BY_ID[r.awayId]?.name}
                  </span>
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
