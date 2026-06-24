import { useMemo, useState } from 'react'
import { useGame } from '@/state/store'
import type { Player, Position } from '@/engine/types'
import { InCareerHeader } from '../components/InCareerHeader'
import { PlayerRow } from '../components/PlayerRow'

const GROUPS: { pos: Position; label: string }[] = [
  { pos: 'GK', label: 'Goalkeepers' },
  { pos: 'DF', label: 'Defenders' },
  { pos: 'MF', label: 'Midfielders' },
  { pos: 'FW', label: 'Forwards' },
]

export function PoolScreen() {
  const career = useGame((s) => s.career)!
  const [filter, setFilter] = useState<'all' | Position>('all')

  const sorted = useMemo(
    () => [...career.players].sort((a, b) => b.knownOverall - a.knownOverall),
    [career.players],
  )

  return (
    <div className="screen">
      <InCareerHeader title="Player Pool" sub={`${career.players.length} players`} />

      <div style={{ padding: '0 var(--pad)' }}>
        <div className="segmented">
          {(['all', 'GK', 'DF', 'MF', 'FW'] as const).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="screen__body">
        {filter === 'all' ? (
          GROUPS.map((g) => {
            const list = sorted.filter((p) => p.position === g.pos)
            if (!list.length) return null
            return (
              <div key={g.pos}>
                <div className="sectionhdr">{g.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((p) => (
                    <PlayerRow key={p.id} p={p} />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted
              .filter((p: Player) => p.position === filter)
              .map((p) => (
                <PlayerRow key={p.id} p={p} />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
