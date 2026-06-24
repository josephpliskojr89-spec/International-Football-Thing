import { useRef, useState } from 'react'
import type { Player } from '@/engine/types'
import { FORMATIONS_BY_ID } from '@/data/formations'
import { positionColor, displayOverall } from '../display'

// Drag-to-position formation board. Pointer events make it work identically for
// touch (one thumb) and mouse. Drag a token onto another slot to swap; a simple
// tap selects a slot, and tapping a second slot swaps — both paths supported so
// it's forgiving one-handed.
export function FormationPitch({
  formationId,
  lineup,
  playersById,
  onSwap,
}: {
  formationId: string
  lineup: Record<string, string | null>
  playersById: Record<string, Player>
  onSwap: (slotA: string, slotB: string) => void
}) {
  const formation = FORMATIONS_BY_ID[formationId]
  const pitchRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const startPt = useRef<{ x: number; y: number } | null>(null)

  const slotAt = (clientX: number, clientY: number): string | null => {
    const rect = pitchRef.current?.getBoundingClientRect()
    if (!rect) return null
    let best: string | null = null
    let bestDist = Infinity
    for (const slot of formation.slots) {
      const sx = rect.left + (slot.x / 100) * rect.width
      const sy = rect.top + ((100 - slot.y) / 100) * rect.height
      const d = Math.hypot(clientX - sx, clientY - sy)
      if (d < bestDist) {
        bestDist = d
        best = slot.id
      }
    }
    // only count as a hit if reasonably close to a token
    return bestDist <= 46 ? best : null
  }

  const onPointerDown = (e: React.PointerEvent, slotId: string) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDragging(slotId)
    startPt.current = { x: e.clientX, y: e.clientY }
    setGhost({ x: e.clientX, y: e.clientY })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    setGhost({ x: e.clientX, y: e.clientY })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return
    const moved =
      startPt.current &&
      Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y) > 10

    const target = slotAt(e.clientX, e.clientY)

    if (moved && target && target !== dragging) {
      onSwap(dragging, target)
      setSelected(null)
    } else if (!moved) {
      // treat as a tap: selection-based swap
      if (selected && selected !== dragging) {
        onSwap(selected, dragging)
        setSelected(null)
      } else {
        setSelected(selected === dragging ? null : dragging)
      }
    }
    setDragging(null)
    setGhost(null)
    startPt.current = null
  }

  const ghostPlayer = dragging ? playersById[lineup[dragging] ?? ''] : null

  return (
    <div
      className="pitch"
      ref={pitchRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="pitch__stripes" />
      <div className="pitch__line pitch__center" />
      <div className="pitch__line pitch__circle" />
      <div className="pitch__line pitch__box pitch__box--top" />
      <div className="pitch__line pitch__box pitch__box--bottom" />

      {formation.slots.map((slot) => {
        const pid = lineup[slot.id]
        const player = pid ? playersById[pid] : null
        const cls = [
          'slot',
          dragging === slot.id ? 'slot--dragging' : '',
          selected === slot.id ? 'slot--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={slot.id}
            className={cls}
            style={{ left: `${slot.x}%`, top: `${100 - slot.y}%` }}
            onPointerDown={(e) => onPointerDown(e, slot.id)}
          >
            <div
              className={`slot__token ${player ? '' : 'slot__token--empty'}`}
              style={player ? { background: positionColor(player.position) } : undefined}
            >
              {player ? displayOverall(player) : slot.position}
            </div>
            <div className="slot__name">{player ? lastName(player.name) : slot.id}</div>
          </div>
        )
      })}

      {ghost && ghostPlayer && (
        <div
          className="slot__token"
          style={{
            position: 'fixed',
            left: ghost.x,
            top: ghost.y,
            transform: 'translate(-50%, -50%) scale(1.1)',
            background: positionColor(ghostPlayer.position),
            pointerEvents: 'none',
            zIndex: 40,
            opacity: 0.9,
          }}
        >
          {displayOverall(ghostPlayer)}
        </div>
      )}
    </div>
  )
}

function lastName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? parts[parts.length - 1] : name
}
