import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { roundName, totalRounds } from '@/engine/tournament'
import type { TournamentGroup } from '@/engine/types'
import { InCareerHeader } from '../components/InCareerHeader'
import type { Tie } from '@/engine/types'

export function BracketScreen() {
  const career = useGame((s) => s.career)!
  const t = career.tournament

  if (!t) {
    return (
      <div className="screen">
        <InCareerHeader title="Finals" />
        <div className="screen__body">
          <div className="card center muted">There's no finals tournament right now.</div>
        </div>
      </div>
    )
  }

  const rounds = totalRounds(t.groups ? 8 : t.field.length)
  const me = career.managerNationId
  const champ = t.champion ? ALL_NATIONS_BY_ID[t.champion] : null

  return (
    <div className="screen">
      <InCareerHeader title={t.name} sub={t.inField ? 'You have qualified' : 'Watching from home'} />

      <div className="screen__body">
        {champ && (
          <div className="card center" style={{ padding: 18 }}>
            <div style={{ fontSize: 30 }}>🏆</div>
            <div className="muted" style={{ fontSize: 12, letterSpacing: 1, marginTop: 4 }}>CHAMPIONS</div>
            <div style={{ fontSize: 22, fontWeight: 900, margin: '4px 0' }}>{champ.name}</div>
            {t.champion === me && (
              <div className="deadline-open" style={{ fontWeight: 800 }}>You did it. Glory.</div>
            )}
          </div>
        )}

        {t.groups && t.groups.map((g, gi) => <GroupCard key={gi} g={g} gi={gi} me={me} />)}

        {t.rounds.map((round, ri) => (
          <div key={ri}>
            <div className="sectionhdr">{roundName(t.kind, ri, rounds)}</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {round.map((tie, i) => (
                <TieRow key={i} tie={tie} me={me} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupCard({ g, gi, me }: { g: TournamentGroup; gi: number; me: string }) {
  return (
    <div>
      <div className="sectionhdr">Group {'ABCD'[gi]}</div>
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
        {g.standings.map((st, i) => {
          const isMe = st.nationId === me
          return (
            <div key={st.nationId} className={`standrow ${isMe ? 'standrow--me' : ''}`} style={i === 1 ? { borderBottom: '2px dashed var(--warn)' } : undefined}>
              <span className="stand__pos">{i + 1}</span>
              <span className="stand__team">{ALL_NATIONS_BY_ID[st.nationId]?.name ?? st.nationId}</span>
              <span className="stand__num">{st.p}</span>
              <span className="stand__num">{st.w}</span>
              <span className="stand__num">{st.d}</span>
              <span className="stand__num">{st.l}</span>
              <span className="stand__num">{st.gf - st.ga > 0 ? '+' : ''}{st.gf - st.ga}</span>
              <span className="stand__num stand__pts">{st.pts}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TieRow({ tie, me }: { tie: Tie; me: string }) {
  const a = ALL_NATIONS_BY_ID[tie.aId]
  const b = ALL_NATIONS_BY_ID[tie.bId]
  const played = tie.winnerId !== null
  const aWon = tie.winnerId === tie.aId
  const bWon = tie.winnerId === tie.bId

  const side = (id: string, name: string, won: boolean, goals: number | null) => {
    const isMe = id === me
    return (
      <div
        className="tierow__side"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
          fontWeight: won ? 800 : 500,
          opacity: played && !won ? 0.55 : 1,
          background: isMe ? 'var(--accent-dim, rgba(255,255,255,0.05))' : undefined,
        }}
      >
        <span>
          {won && played ? '▶ ' : ''}
          {name ?? id}
          {isMe ? ' (you)' : ''}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{goals ?? '–'}</span>
      </div>
    )
  }

  return (
    <div className="tierow" style={{ borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
      {side(tie.aId, a?.name, aWon, tie.aGoals)}
      {side(tie.bId, b?.name, bWon, tie.bGoals)}
      {tie.pens && (
        <div className="faint" style={{ fontSize: 11, padding: '2px 12px 6px' }}>
          {tie.pensA !== undefined ? `${tie.pensA}–${tie.pensB} on penalties` : 'decided on penalties'}
        </div>
      )}
    </div>
  )
}
