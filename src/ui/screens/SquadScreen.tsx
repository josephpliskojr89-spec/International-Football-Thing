import { useMemo, useState } from 'react'
import { useGame } from '@/state/store'
import { FORMATIONS, FORMATIONS_BY_ID, roleLabel } from '@/data/formations'
import type { Player } from '@/engine/types'
import { InCareerHeader } from '../components/InCareerHeader'
import { FormationPitch } from '../components/FormationPitch'
import { displayOverall, displayPotential, formColor, freshnessColor, positionColor } from '../display'

type Tab = 'squad' | 'pitch'

export function SquadScreen() {
  const career = useGame((s) => s.career)!
  const setFormation = useGame((s) => s.setFormation)
  const swapLineupSlots = useGame((s) => s.swapLineupSlots)
  const [tab, setTab] = useState<Tab>('squad')

  const playersById = useMemo(
    () => Object.fromEntries(career.players.map((p) => [p.id, p])),
    [career.players],
  )

  const formation = FORMATIONS_BY_ID[career.formation]

  return (
    <div className="screen">
      <InCareerHeader title="Squad" sub={`${career.formation} · ${career.players.length} in pool`} />

      <div style={{ padding: '0 var(--pad)' }}>
        <div className="segmented">
          <button className={tab === 'squad' ? 'on' : ''} onClick={() => setTab('squad')}>
            Squad
          </button>
          <button className={tab === 'pitch' ? 'on' : ''} onClick={() => setTab('pitch')}>
            Formation
          </button>
        </div>
      </div>

      <div className="screen__body">
        <div className="card" style={{ padding: 10 }}>
          <div className="field-label" style={{ paddingLeft: 4 }}>
            Formation
          </div>
          <div className="chiprow">
            {FORMATIONS.map((f) => (
              <button
                key={f.id}
                className={`chip ${career.formation === f.id ? 'chip--on' : ''}`}
                onClick={() => setFormation(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'squad' ? (
          <>
            <div className="sectionhdr">Starting XI</div>
            {formation.slots.map((slot) => {
              const p = playersById[career.lineup[slot.id] ?? '']
              return <SquadRow key={slot.id} role={roleLabel(slot.id)} player={p} />
            })}

            <div className="sectionhdr">Substitutes</div>
            {career.bench
              .map((id) => playersById[id])
              .filter(Boolean)
              .map((p) => (
                <SquadRow key={p.id} role={p.position} player={p} />
              ))}

            <div className="faint center" style={{ fontSize: 12, marginTop: 6 }}>
              Edit your XI on the Formation tab. Full window squad selection is coming.
            </div>
          </>
        ) : (
          <>
            <FormationPitch
              formationId={career.formation}
              lineup={career.lineup}
              playersById={playersById}
              onSwap={swapLineupSlots}
            />
            <div className="faint center" style={{ fontSize: 13 }}>
              Drag a player onto another to swap. Tap one, then another, to swap by tapping.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// A squad list row: a fixed role chip on the left, the player on the right.
function SquadRow({ role, player }: { role: string; player: Player | undefined }) {
  if (!player) {
    return (
      <div className="prow" style={{ cursor: 'default', opacity: 0.6 }}>
        <span className="prow__pos" style={{ background: 'var(--line)' }}>
          {role}
        </span>
        <span className="prow__main">
          <span className="prow__name faint">Empty</span>
        </span>
      </div>
    )
  }
  const pot = displayPotential(player)
  return (
    <div className="prow" style={{ cursor: 'default' }}>
      <span className="prow__pos" style={{ background: positionColor(player.position) }}>
        {role}
      </span>
      <span className="prow__main">
        <span className="prow__name">{player.name}</span>
        <span className="prow__sub">
          {player.age} · {player.club}
          {pot !== '?' && <span style={{ color: 'var(--gold)' }}> · {pot}</span>}
        </span>
      </span>
      <span className="prow__meta">
        <span className="prow__ovr">{displayOverall(player)}</span>
        <span className="prow__dots">
          <i className="dot" style={{ background: formColor(player.form) }} title="form" />
          <i className="dot" style={{ background: freshnessColor(player.freshness) }} title="confidence" />
        </span>
      </span>
    </div>
  )
}
