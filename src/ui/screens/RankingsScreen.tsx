import { useMemo } from 'react'
import { useGame } from '@/state/store'
import { worldRanking } from '@/engine/world'
import { WORLD_CUP_SIZE } from '@/engine/tournament'
import { CONFEDERATION_NAMES } from '@/data/nations'
import { InCareerHeader } from '../components/InCareerHeader'

// The world ranking, live from the dynamic ratings. This is the scoreboard of
// eras: results everywhere move it, and it drives seedings, qualifying draws
// and tournament fields — so the movement arrows are your world actually
// changing, not decoration.
export function RankingsScreen() {
  const career = useGame((s) => s.career)!
  const ranked = useMemo(() => worldRanking(career.world), [career.world])
  const myRank = ranked.find((r) => r.nation.id === career.managerNationId)

  return (
    <div className="screen">
      <InCareerHeader
        title="World Rankings"
        sub={myRank ? `You are ${ordinal(myRank.rank)} in the world` : undefined}
      />

      <div className="screen__body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="standrow standrow--rank standrow--head">
            <span className="stand__pos">#</span>
            <span className="stand__team">Nation</span>
            <span className="stand__num">Conf</span>
            <span className="stand__num">Rtg</span>
            <span className="stand__num">+/-</span>
          </div>
          {ranked.map((r) => {
            const isMe = r.nation.id === career.managerNationId
            return (
              <div
                key={r.nation.id}
                className={`standrow standrow--rank ${isMe ? 'standrow--me' : ''}`}
                style={r.rank === WORLD_CUP_SIZE ? { borderBottom: '2px dashed var(--warn)' } : undefined}
              >
                <span className="stand__pos">{r.rank}</span>
                <span className="stand__team" style={{ opacity: r.nation.isPlayable ? 1 : 0.65 }}>
                  {r.nation.name}
                </span>
                <span className="stand__num faint" style={{ fontSize: 11 }}>
                  {r.nation.confederation}
                </span>
                <span className="stand__num">{Math.round(r.rating)}</span>
                <span
                  className="stand__num"
                  style={{
                    color: r.movement > 0 ? 'var(--good)' : r.movement < 0 ? 'var(--bad)' : 'var(--text-faint)',
                  }}
                >
                  {r.movement > 0 ? `▲${r.movement}` : r.movement < 0 ? `▼${-r.movement}` : '—'}
                </span>
              </div>
            )
          })}
        </div>
        <div className="faint" style={{ fontSize: 12 }}>
          Movement is since the start of the season. The top {WORLD_CUP_SIZE} make the World Cup
          field; rankings also shape qualifying draws and finals seedings. Confederations:{' '}
          {Object.entries(CONFEDERATION_NAMES)
            .map(([k, v]) => `${k} = ${v}`)
            .join(' · ')}
          .
        </div>
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
