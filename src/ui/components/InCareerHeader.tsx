import { useGame } from '@/state/store'
import { NATIONS_BY_ID } from '@/data/nations'

// Shared header for in-career sub-screens. The menu icon always returns to the
// schedule/feed hub (per the core-loop flow); a back arrow is optional.
export function InCareerHeader({ title, sub }: { title: string; sub?: string }) {
  const go = useGame((s) => s.go)
  const career = useGame((s) => s.career)
  const nation = career ? NATIONS_BY_ID[career.managerNationId] : null

  return (
    <div className="topbar">
      <button className="iconbtn" onClick={() => go('schedule')} aria-label="Home">
        ⌂
      </button>
      <div style={{ minWidth: 0 }}>
        <div className="topbar__title">{title}</div>
        <div className="topbar__sub">{sub ?? nation?.name}</div>
      </div>
    </div>
  )
}
