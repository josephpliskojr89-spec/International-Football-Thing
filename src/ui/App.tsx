import { useEffect } from 'react'
import { useGame } from '@/state/store'
import { TitleScreen } from './screens/TitleScreen'
import { NewGameScreen } from './screens/NewGameScreen'
import { ScheduleScreen } from './screens/ScheduleScreen'
import { SquadScreen } from './screens/SquadScreen'
import { PoolScreen } from './screens/PoolScreen'
import { DualNationalsScreen } from './screens/DualNationalsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SaveScreen } from './screens/SaveScreen'
import { MatchScreen } from './screens/MatchScreen'
import { ScoutingScreen } from './screens/ScoutingScreen'
import { SquadSelectionScreen } from './screens/SquadSelectionScreen'
import { StandingsScreen } from './screens/StandingsScreen'

export function App() {
  const route = useGame((s) => s.route)
  const career = useGame((s) => s.career)
  const hydrate = useGame((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Routes that require an active career fall back to the title screen.
  // (title / new-game / settings are reachable without one.)
  const allowedWithoutCareer = route === 'title' || route === 'new-game' || route === 'settings'
  if (!allowedWithoutCareer && !career) {
    return <TitleScreen />
  }

  switch (route) {
    case 'title':
      return <TitleScreen />
    case 'new-game':
      return <NewGameScreen />
    case 'schedule':
      return <ScheduleScreen />
    case 'squad':
      return <SquadScreen />
    case 'pool':
      return <PoolScreen />
    case 'dual-nationals':
      return <DualNationalsScreen />
    case 'settings':
      return <SettingsScreen />
    case 'save':
      return <SaveScreen />
    case 'match':
      return <MatchScreen />
    case 'scouting':
      return <ScoutingScreen />
    case 'squad-select':
      return <SquadSelectionScreen />
    case 'standings':
      return <StandingsScreen />
    default:
      return <TitleScreen />
  }
}
