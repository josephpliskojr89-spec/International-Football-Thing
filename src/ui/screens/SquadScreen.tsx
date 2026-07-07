import { useMemo, useState } from 'react'
import { useGame } from '@/state/store'
import { FORMATIONS, FORMATIONS_BY_ID, roleLabel } from '@/data/formations'
import type { Career, Player } from '@/engine/types'
import { InCareerHeader } from '../components/InCareerHeader'
import { FormationPitch } from '../components/FormationPitch'
import { displayOverall, displayPotential, formColor, freshnessColor, positionColor, topRatedIds } from '../display'
import { STYLES, STYLE_LABELS, STYLE_DESC } from '@/data/tactics'

type Tab = 'squad' | 'pitch' | 'tactics'

export function SquadScreen() {
  const career = useGame((s) => s.career)!
  const setFormation = useGame((s) => s.setFormation)
  const swapLineupSlots = useGame((s) => s.swapLineupSlots)
  const swapWithBench = useGame((s) => s.swapWithBench)
  const setStyle = useGame((s) => s.setStyle)
  const setFocalPoint = useGame((s) => s.setFocalPoint)
  const go = useGame((s) => s.go)
  const [tab, setTab] = useState<Tab>('squad')
  // Tap-to-substitute on the Squad tab: pick an XI slot, then a sub (or the
  // reverse) — works even when the 26 is locked, because the XI is always yours.
  const [pickSlot, setPickSlot] = useState<string | null>(null)
  const [pickBench, setPickBench] = useState<string | null>(null)

  const tapXI = (slotId: string) => {
    if (pickBench) {
      swapWithBench(slotId, pickBench)
      setPickBench(null)
      setPickSlot(null)
    } else {
      setPickSlot(pickSlot === slotId ? null : slotId)
    }
  }
  const tapBench = (playerId: string) => {
    if (pickSlot) {
      swapWithBench(pickSlot, playerId)
      setPickSlot(null)
      setPickBench(null)
    } else {
      setPickBench(pickBench === playerId ? null : playerId)
    }
  }

  const playersById = useMemo(
    () => Object.fromEntries(career.players.map((p) => [p.id, p])),
    [career.players],
  )
  // Star the three best players in the registered squad.
  const stars = useMemo(
    () => topRatedIds(career.players, career.registeredSquad, 3),
    [career.players, career.registeredSquad],
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
          <button className={tab === 'tactics' ? 'on' : ''} onClick={() => setTab('tactics')}>
            Tactics
          </button>
        </div>
      </div>

      <div className="screen__body">
        {tab === 'tactics' ? (
          <TacticsTab
            career={career}
            playersById={playersById}
            stars={stars}
            setFormation={setFormation}
            setStyle={setStyle}
            setFocalPoint={setFocalPoint}
          />
        ) : tab === 'squad' ? (
          <>
            <div className="sectionhdr">Starting XI</div>
            {formation.slots.map((slot) => {
              const p = playersById[career.lineup[slot.id] ?? '']
              return (
                <SquadRow
                  key={slot.id}
                  role={roleLabel(slot.id)}
                  player={p}
                  star={!!p && stars.has(p.id)}
                  selected={pickSlot === slot.id}
                  onClick={() => tapXI(slot.id)}
                />
              )
            })}

            <div className="sectionhdr">Substitutes</div>
            {career.bench
              .map((id) => playersById[id])
              .filter(Boolean)
              .map((p) => (
                <SquadRow
                  key={p.id}
                  role={p.position}
                  player={p}
                  star={stars.has(p.id)}
                  selected={pickBench === p.id}
                  onClick={() => tapBench(p.id)}
                />
              ))}
            <div className="faint center" style={{ fontSize: 12, marginTop: 6 }}>
              Tap a starter, then a sub (or the reverse), to swap them — even after the 26 is locked.
            </div>

            <button className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => go('squad-select')}>
              Manage 26-man Squad
            </button>
            <div className="faint center" style={{ fontSize: 12, marginTop: 6 }}>
              Edit your XI on the Formation tab; choose your 26 with Manage Squad.
            </div>
          </>
        ) : (
          <>
            <FormationPitch
              formationId={career.formation}
              lineup={career.lineup}
              playersById={playersById}
              starIds={stars}
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

// The Tactics tab: formation, match style, and a focal point to play through.
// Three tappable choices, no sliders, all persisted and feeding the engine.
function TacticsTab({
  career,
  playersById,
  stars,
  setFormation,
  setStyle,
  setFocalPoint,
}: {
  career: Career
  playersById: Record<string, Player>
  stars: Set<string>
  setFormation: (id: string) => void
  setStyle: (s: (typeof STYLES)[number]) => void
  setFocalPoint: (id: string | null) => void
}) {
  const c = career
  const formation = FORMATIONS_BY_ID[c.formation]
  const xi = formation.slots
    .map((slot) => ({ slot, p: playersById[c.lineup[slot.id] ?? ''] }))
    .filter((x) => x.p)

  return (
    <>
      <div className="card" style={{ padding: 12 }}>
        <div className="field-label">Formation</div>
        <div className="chiprow">
          {FORMATIONS.map((f) => (
            <button
              key={f.id}
              className={`chip ${c.formation === f.id ? 'chip--on' : ''}`}
              onClick={() => setFormation(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="field-label">Style</div>
        <div className="chiprow">
          {STYLES.map((s) => (
            <button key={s} className={`chip ${c.tactics.style === s ? 'chip--on' : ''}`} onClick={() => setStyle(s)}>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          {STYLE_DESC[c.tactics.style]}
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="field-label">Play through (focal point)</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Funnel chances through one player. Lifts the attack when he's on song — and stings when he isn't.
        </div>
        <button
          className={`prow ${!c.tactics.focalPointId ? 'prow--selected' : ''}`}
          style={{ marginBottom: 8 }}
          onClick={() => setFocalPoint(null)}
        >
          <span className="prow__pos" style={{ background: 'var(--line)' }}>—</span>
          <span className="prow__main">
            <span className="prow__name">Even — no focal point</span>
            <span className="prow__sub">Spread the play</span>
          </span>
        </button>
        {xi.map(({ slot, p }) => (
          <button
            key={slot.id}
            className={`prow ${c.tactics.focalPointId === p!.id ? 'prow--selected' : ''}`}
            style={{ marginBottom: 8 }}
            onClick={() => setFocalPoint(p!.id)}
          >
            <span className="prow__pos" style={{ background: positionColor(p!.position) }}>
              {roleLabel(slot.id)}
            </span>
            <span className="prow__main">
              <span className="prow__name">
                {stars.has(p!.id) && <span className="star-top">★ </span>}
                {p!.name}
              </span>
              <span className="prow__sub">{p!.age} · {p!.club}</span>
            </span>
            <span className="prow__ovr">{displayOverall(p!)}</span>
          </button>
        ))}
      </div>
    </>
  )
}

// A squad list row: a fixed role chip on the left, the player on the right.
function SquadRow({
  role,
  player,
  star,
  selected,
  onClick,
}: {
  role: string
  player: Player | undefined
  star?: boolean
  selected?: boolean
  onClick?: () => void
}) {
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
    <div
      className={`prow ${selected ? 'prow--selected' : ''}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <span className="prow__pos" style={{ background: positionColor(player.position) }}>
        {role}
      </span>
      <span className="prow__main">
        <span className="prow__name">
          {star && <span className="star-top">★ </span>}
          {player.name}
        </span>
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
