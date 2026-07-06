import { useMemo } from 'react'
import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { displayYear } from '@/data/windows'
import { worldCupDivergence } from '@/engine/counterfactual'
import { InCareerHeader } from '../components/InCareerHeader'

// The Road Not Taken: the deterministic engine re-runs the ENTIRE timeline
// without you in it, and lays the two histories side by side. This screen
// answers the question every long save quietly asks: did I matter?
export function GhostScreen() {
  const career = useGame((s) => s.career)!
  const rows = useMemo(() => worldCupDivergence(career), [career])
  const decided = rows.filter((r) => r.yours !== null)
  const changed = decided.filter((r) => r.yours !== r.ghost)

  return (
    <div className="screen">
      <InCareerHeader title="The Road Not Taken" sub="The world where you never took the job" />

      <div className="screen__body">
        <div className="card center" style={{ padding: 18 }}>
          <div style={{ fontSize: 30 }}>👻</div>
          <div style={{ fontSize: 15, marginTop: 8, lineHeight: 1.55 }}>
            Somewhere, there is a world where you never picked up the phone. Same nations, same
            talent, same seed of history — just no you. The engine has simulated it.
          </div>
          {decided.length > 0 && (
            <div style={{ fontWeight: 900, fontSize: 17, marginTop: 12 }}>
              {changed.length === 0
                ? 'So far, both worlds crowned the same champions. Keep pushing.'
                : `${changed.length} of ${decided.length} World Cup${decided.length === 1 ? ' has' : 's have'} a different name on the trophy because you exist.`}
            </div>
          )}
        </div>

        {rows.length === 0 && (
          <div className="card center muted">
            The first World Cup of your timeline hasn't been played yet. Come back when history has
            had a chance to fork.
          </div>
        )}

        {rows.slice().reverse().map((r) => {
          const yoursName = r.yours ? ALL_NATIONS_BY_ID[r.yours]?.name : '—'
          const ghostName = ALL_NATIONS_BY_ID[r.ghost!]?.name ?? r.ghost
          const diverged = r.yours !== null && r.yours !== r.ghost
          return (
            <div className="card" key={r.season} style={{ padding: '12px 14px' }}>
              <div className="field-label">World Cup {displayYear(r.season)}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'stretch' }}>
                <div style={{ flex: 1 }}>
                  <div className="faint" style={{ fontSize: 11, letterSpacing: 1 }}>YOUR WORLD</div>
                  <div style={{ fontWeight: 800, marginTop: 2, color: r.isYou ? 'var(--gold, #e7c66a)' : undefined }}>
                    {r.isYou ? `🏆 ${yoursName} (YOU)` : yoursName ?? '—'}
                  </div>
                </div>
                <div style={{ width: 1, background: 'var(--line, rgba(255,255,255,0.1))' }} />
                <div style={{ flex: 1, opacity: 0.75 }}>
                  <div className="faint" style={{ fontSize: 11, letterSpacing: 1 }}>WITHOUT YOU</div>
                  <div style={{ fontWeight: 800, marginTop: 2 }}>👻 {ghostName}</div>
                </div>
              </div>
              {diverged && (
                <div className="deadline-open" style={{ fontSize: 12, marginTop: 8 }}>
                  {r.isYou
                    ? `In the other world, ${ghostName} lift this trophy. You took it from them.`
                    : `History forked here — the ripples of your matches reached this final.`}
                </div>
              )}
              {!diverged && r.yours !== null && (
                <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                  Same champion in both worlds. Some rivers find the sea regardless.
                </div>
              )}
            </div>
          )
        })}

        <div className="faint center" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          The ghost world runs on the same deterministic engine — every result reproducible, none of
          them yours.
        </div>
      </div>
    </div>
  )
}
