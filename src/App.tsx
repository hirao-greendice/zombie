import { Stage } from './components/Stage'
import { DevOverlay } from './components/DevOverlay'
import { MapScreen } from './components/MapScreen'

export function App() {
  return (
    <>
      <Stage>
        <MapScreen />
      </Stage>
      <DevOverlay />
    </>
  )
}
