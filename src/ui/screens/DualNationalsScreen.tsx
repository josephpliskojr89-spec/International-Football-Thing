import { useMemo } from 'react'
import { useGame } from '@/state/store'
import { NATIONS_BY_ID } from '@/data/nations'
import { InCareerHeader } from '../components/InCareerHeader'
import { PlayerRow } from '../components/PlayerRow'

export function DualNationalsScreen() {
  const career = useGame((s) => s.career)!

  // Players eligible for more than one nation and not yet cap-tied — the
  // courting targets. (Probe / friendly / competitive call-up actions arrive
  // with the eligibility milestone.)
  const duals = useMemo(
    () =>
      career.players
        .filter((p) => p.eligibleNations.length > 1 && p.eligibilityState !== 'CAP_TIED')
        .sort((a, b) => b.knownOverall - a.knownOverall),
    [career.players],
  )

  return (
    <div className="screen">
      <InCareerHeader title="Dual Nationals" sub={`${duals.length} uncommitted`} />

      <div className="screen__body">
        {duals.length === 0 && (
          <div className="card center muted">
            No uncommitted dual-nationals in view right now. Keep scouting — they surface through the
            feed.
          </div>
        )}

        {duals.map((p) => {
          const others = p.eligibleNations
            .filter((id) => id !== career.managerNationId)
            .map((id) => NATIONS_BY_ID[id]?.name ?? id)
          return (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <PlayerRow p={p} />
              <div className="faint" style={{ fontSize: 12, paddingLeft: 12 }}>
                Also eligible for {others.join(', ') || '—'} · status {p.eligibilityState}
              </div>
            </div>
          )
        })}

        <div className="faint center" style={{ fontSize: 12, marginTop: 6 }}>
          Courting, friendly call-ups and the rival-nation clock come online in a later update.
        </div>
      </div>
    </div>
  )
}
