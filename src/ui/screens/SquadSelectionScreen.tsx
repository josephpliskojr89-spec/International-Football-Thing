import { useMemo } from 'react'
import { useGame } from '@/state/store'
import type { Player, Position } from '@/engine/types'
import { SQUAD_SIZE, squadValidity, isSquadLocked } from '@/engine/fixtures'
import { InCareerHeader } from '../components/InCareerHeader'
import { displayOverall, displayPotential, formColor, freshnessColor, positionColor } from '../display'

const GROUPS: { pos: Position; label: string }[] = [
  { pos: 'GK', label: 'Goalkeepers' },
  { pos: 'DF', label: 'Defenders' },
  { pos: 'MF', label: 'Midfielders' },
  { pos: 'FW', label: 'Forwards' },
]

export function SquadSelectionScreen() {
  const career = useGame((s) => s.career)!
  const setSquad = useGame((s) => s.setSquad)
  const go = useGame((s) => s.go)

  const locked = isSquadLocked(career)
  const selected = useMemo(() => new Set(career.registeredSquad), [career.registeredSquad])
  const validity = useMemo(
    () => squadValidity(career.players, career.registeredSquad),
    [career.players, career.registeredSquad],
  )

  const sorted = useMemo(
    () => [...career.players].sort((a, b) => b.knownOverall - a.knownOverall),
    [career.players],
  )

  const full = career.registeredSquad.length >= SQUAD_SIZE

  const toggle = (p: Player) => {
    if (locked) return
    if (selected.has(p.id)) {
      setSquad(career.registeredSquad.filter((id) => id !== p.id))
    } else if (!full) {
      setSquad([...career.registeredSquad, p.id])
    }
  }

  return (
    <div className="screen">
      <InCareerHeader title="Select Squad" sub={`${career.registeredSquad.length}/${SQUAD_SIZE} called up`} />

      <div style={{ padding: '0 var(--pad)' }}>
        <div className={`card ${validity.valid ? '' : ''}`} style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', fontWeight: 800 }}>
            <span>GK {validity.counts.GK}</span>
            <span>DF {validity.counts.DF}</span>
            <span>MF {validity.counts.MF}</span>
            <span>FW {validity.counts.FW}</span>
            <span style={{ color: full ? 'var(--gold)' : 'var(--accent)' }}>
              {career.registeredSquad.length}/{SQUAD_SIZE}
            </span>
          </div>
          {locked ? (
            <div style={{ color: 'var(--bad)', fontSize: 13, marginTop: 8, fontWeight: 700 }}>
              🔒 Registration closed — the squad is locked for this window.
            </div>
          ) : validity.reasons.length > 0 ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {validity.reasons.join(' · ')}
            </div>
          ) : (
            <div style={{ color: 'var(--good)', fontSize: 12, marginTop: 8 }}>Squad is valid ✓</div>
          )}
        </div>
      </div>

      <div className="screen__body">
        {GROUPS.map((g) => {
          const list = sorted.filter((p) => p.position === g.pos)
          if (!list.length) return null
          return (
            <div key={g.pos}>
              <div className="sectionhdr">{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.map((p) => {
                  const on = selected.has(p.id)
                  const disabled = locked || (!on && full)
                  const pot = displayPotential(p)
                  return (
                    <button
                      key={p.id}
                      className="prow"
                      style={{ opacity: disabled && !on ? 0.45 : 1 }}
                      onClick={() => toggle(p)}
                    >
                      <span
                        className="selcheck"
                        style={{
                          background: on ? 'var(--good)' : 'transparent',
                          borderColor: on ? 'var(--good)' : 'var(--line)',
                        }}
                      >
                        {on ? '✓' : ''}
                      </span>
                      <span className="prow__pos" style={{ background: positionColor(p.position) }}>
                        {p.position}
                      </span>
                      <span className="prow__main">
                        <span className="prow__name">{p.name}</span>
                        <span className="prow__sub">
                          {p.age} · {p.club}
                          {pot !== '?' && <span style={{ color: 'var(--gold)' }}> · {pot}</span>}
                        </span>
                      </span>
                      <span className="prow__meta">
                        <span className="prow__ovr">{displayOverall(p)}</span>
                        <span className="prow__dots">
                          <i className="dot" style={{ background: formColor(p.form) }} />
                          <i className="dot" style={{ background: freshnessColor(p.freshness) }} />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => go('squad')}>
          Done · View Squad
        </button>
      </div>
    </div>
  )
}
