import { useMemo } from 'react'
import { useGame } from '@/state/store'
import { FORMATIONS } from '@/data/formations'
import { InCareerHeader } from '../components/InCareerHeader'
import { FormationPitch } from '../components/FormationPitch'

export function SquadScreen() {
  const career = useGame((s) => s.career)!
  const setFormation = useGame((s) => s.setFormation)
  const swapLineupSlots = useGame((s) => s.swapLineupSlots)

  const playersById = useMemo(
    () => Object.fromEntries(career.players.map((p) => [p.id, p])),
    [career.players],
  )

  return (
    <div className="screen">
      <InCareerHeader title="Squad" sub={`${career.formation} · drag to reposition`} />

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

        <FormationPitch
          formationId={career.formation}
          lineup={career.lineup}
          playersById={playersById}
          onSwap={swapLineupSlots}
        />

        <div className="faint center" style={{ fontSize: 13 }}>
          Drag a player onto another to swap positions. Tap one, then another, to swap by tapping.
        </div>
      </div>
    </div>
  )
}
