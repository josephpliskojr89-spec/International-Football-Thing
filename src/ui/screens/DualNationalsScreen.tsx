import { useMemo } from 'react'
import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { InCareerHeader } from '../components/InCareerHeader'
import { PlayerRow } from '../components/PlayerRow'
import type { Player } from '@/engine/types'

// The recruitment battleground. Every uncommitted dual national is a race
// against his other country: court him with staff visits, warm him up in
// friendlies, and cap-tie him in a competitive match before he declares for
// the rival. The lean readout is your intel — a feeling, never a number.
export function DualNationalsScreen() {
  const career = useGame((s) => s.career)!
  const courtPlayer = useGame((s) => s.courtPlayer)

  const scoutsLeft = career.coaches.filter((c) => !c.targetedLookUsed).length

  const { open, lost } = useMemo(() => {
    const duals = career.players.filter((p) => p.eligibleNations.length > 1)
    return {
      open: duals
        .filter((p) => p.eligibilityState !== 'CAP_TIED' && p.eligibilityState !== 'LOST')
        .sort((a, b) => b.knownOverall - a.knownOverall),
      lost: duals.filter((p) => p.eligibilityState === 'LOST'),
    }
  }, [career.players])

  return (
    <div className="screen">
      <InCareerHeader title="Dual Nationals" sub={`${open.length} undecided · races you can still win`} />

      <div className="screen__body">
        {open.length === 0 && (
          <div className="card center muted">
            No undecided dual-nationals right now. New ones surface with each youth intake — watch the feed.
          </div>
        )}

        {open.map((p) => {
          const rivalId = p.eligibleNations.find((id) => id !== career.managerNationId)
          const rival = rivalId ? ALL_NATIONS_BY_ID[rivalId] : null
          const verdict = leanVerdict(p, career.managerNationId, rivalId)
          return (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
              <PlayerRow p={p} />
              <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="faint">Also wanted by {rival?.name ?? '—'} ·</span>
                <span style={{ fontWeight: 700, color: verdict.color }}>{verdict.text}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  disabled={scoutsLeft === 0}
                  onClick={() => courtPlayer(p.id)}
                  style={{ flex: 1 }}
                >
                  {scoutsLeft === 0 ? 'No staff visits left' : `🤝 Court him (${scoutsLeft} visits left)`}
                </button>
              </div>
              <div className="faint" style={{ fontSize: 11.5 }}>
                A friendly cap warms him. A competitive cap ties him forever.
              </div>
            </div>
          )
        })}

        {lost.length > 0 && (
          <>
            <div className="sectionhdr">The ones that got away</div>
            {lost.map((p) => (
              <div key={p.id} className="card" style={{ opacity: 0.6, padding: '10px 12px' }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="faint" style={{ fontSize: 12.5 }}>
                  Declared for {p.tiedNation ? ALL_NATIONS_BY_ID[p.tiedNation]?.name : 'the rival'}. Gone for good.
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// Your staff's read on where his heart is — deliberately fuzzy.
function leanVerdict(p: Player, myId: string, rivalId?: string): { text: string; color: string } {
  const mine = p.leans[myId] ?? 50
  const theirs = rivalId ? (p.leans[rivalId] ?? 50) : 50
  const diff = mine - theirs
  if (diff >= 18) return { text: 'His heart is with you', color: 'var(--good)' }
  if (diff >= 0) return { text: 'Torn — winnable', color: 'var(--warn)' }
  if (diff >= -15) return { text: 'Drifting away', color: 'var(--warn)' }
  return { text: 'Nearly gone — act NOW', color: 'var(--bad)' }
}
