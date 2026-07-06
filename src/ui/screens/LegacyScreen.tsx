import { useGame } from '@/state/store'
import { NATIONS_BY_ID } from '@/data/nations'
import { displayYear } from '@/data/windows'
import { reputationLabel } from '@/engine/manager'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { InCareerHeader } from '../components/InCareerHeader'
import type { HistoryEntry } from '@/engine/types'

// The Legacy screen: your honours, your record, your legends — and the World
// Football Almanac, the alternate history this save has written. Read it top
// to bottom after a long career and it should feel like a Wikipedia page from
// another timeline.
export function LegacyScreen() {
  const career = useGame((s) => s.career)!
  const go = useGame((s) => s.go)
  const nation = NATIONS_BY_ID[career.managerNationId]
  const rec = career.record
  const winPct = rec.p > 0 ? Math.round((rec.w / rec.p) * 100) : 0

  // Almanac: newest season first, grouped.
  const bySeason = new Map<number, HistoryEntry[]>()
  for (const h of career.history) {
    const arr = bySeason.get(h.season) ?? []
    arr.push(h)
    bySeason.set(h.season, arr)
  }
  const seasons = [...bySeason.keys()].sort((a, b) => b - a)

  // All-time World Cup titles in THIS save's timeline — dynasties made visible.
  const titleCounts = new Map<string, number>()
  for (const h of career.history) {
    if (h.type === 'WORLD_CUP' && h.nationId) titleCounts.set(h.nationId, (titleCounts.get(h.nationId) ?? 0) + 1)
  }
  const wcTitles = [...titleCounts.entries()].sort((a, b) => b[1] - a[1])

  // Current record chasers.
  const capLeaders = [...career.players].sort((a, b) => b.caps - a.caps).slice(0, 3).filter((p) => p.caps > 0)
  const goalLeaders = [...career.players].sort((a, b) => b.intlGoals - a.intlGoals).slice(0, 3).filter((p) => p.intlGoals > 0)

  return (
    <div className="screen">
      <InCareerHeader title="Legacy" sub={`${career.managerName} · ${nation.name}`} />

      <div className="screen__body">
        <div className="card">
          <div className="field-label">Standing</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 4 }}>
            <span>Reputation</span>
            <span>{reputationLabel(career.reputation)}</span>
          </div>
          {career.objective && (
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              The board demands: “{career.objective.text}”
            </div>
          )}
        </div>

        <div className="card">
          <div className="field-label">Managerial record</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums', fontWeight: 700, marginTop: 4 }}>
            <span>P {rec.p}</span>
            <span style={{ color: 'var(--good)' }}>W {rec.w}</span>
            <span style={{ color: 'var(--warn)' }}>D {rec.d}</span>
            <span style={{ color: 'var(--bad)' }}>L {rec.l}</span>
            <span>{winPct}% won</span>
          </div>
          <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>
            Goals {rec.gf}–{rec.ga} · {career.season - 1 === 0 ? 'First season' : `${career.season} seasons`} in charge
          </div>
        </div>

        <div className="card">
          <div className="field-label">Honours</div>
          {career.trophies.length === 0 ? (
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              The cabinet is empty. That's not a criticism — it's a challenge.
            </div>
          ) : (
            career.trophies.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, fontWeight: 800 }}>
                <span style={{ fontSize: 20 }}>{t.kind === 'WORLD_CUP' ? '🏆' : '🥇'}</span>
                <span>{t.name}</span>
                <span className="spacer" />
                <span className="muted">{displayYear(t.season)}</span>
              </div>
            ))
          )}
        </div>

        {(capLeaders.length > 0 || goalLeaders.length > 0) && (
          <div className="card">
            <div className="field-label">Record chasers</div>
            {capLeaders.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4 }}>
                <span>{p.name}</span>
                <span className="muted">{p.caps} caps</span>
              </div>
            ))}
            {goalLeaders.map((p) => (
              <div key={`g-${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4 }}>
                <span>{p.name}</span>
                <span className="muted">{p.intlGoals} goals</span>
              </div>
            ))}
          </div>
        )}

        {career.legends.length > 0 && (
          <div className="card">
            <div className="field-label">Pantheon</div>
            {[...career.legends].reverse().map((l, i) => (
              <div key={i} style={{ marginTop: 6 }}>
                <div style={{ fontWeight: 800 }}>
                  {l.name} <span className="faint" style={{ fontWeight: 400 }}>{l.position}</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {l.caps} caps · {l.goals} goals · retired {displayYear(l.retiredSeason)}
                </div>
              </div>
            ))}
          </div>
        )}

        {wcTitles.length > 0 && (
          <div className="card">
            <div className="field-label">World Cup roll of honour</div>
            {wcTitles.map(([id, n]) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4, fontWeight: id === career.managerNationId ? 800 : 400 }}>
                <span>{ALL_NATIONS_BY_ID[id]?.name ?? id}{id === career.managerNationId ? ' ★' : ''}</span>
                <span className="muted">{'🏆'.repeat(Math.min(n, 6))}{n > 6 ? ` ×${n}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        <div className="sectionhdr">The Almanac</div>
        {seasons.length === 0 && (
          <div className="card muted" style={{ fontSize: 14 }}>
            History gets written in the summers. Play on.
          </div>
        )}
        {seasons.map((s) => (
          <div className="card" key={s} style={{ padding: '10px 14px' }}>
            <div className="field-label">{displayYear(s)}</div>
            {bySeason.get(s)!.map((h, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13.5,
                  marginTop: 5,
                  lineHeight: 1.45,
                  fontWeight: h.managerMoment ? 800 : 400,
                  color: h.managerMoment ? 'var(--gold, #e7c66a)' : undefined,
                }}
              >
                {icon(h)} {h.text}
              </div>
            ))}
          </div>
        ))}

        <button className="btn btn--block" onClick={() => go('final-whistle')} style={{ marginTop: 4 }}>
          🎬 The Final Whistle — read your career as a story
        </button>
      </div>
    </div>
  )
}

function icon(h: HistoryEntry): string {
  switch (h.type) {
    case 'WORLD_CUP': return '🏆'
    case 'CONTINENTAL':
    case 'FOREIGN_CONTINENTAL': return '🥇'
    case 'QUALIFIED': return '✅'
    case 'MISSED': return '❌'
    case 'POTY': return '👑'
    case 'LEGEND': return '🎖️'
    case 'HOST': return '🏟️'
    default: return '·'
  }
}
