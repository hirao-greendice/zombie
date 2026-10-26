import { useState } from 'react'
import { Stage } from './components/Stage'
import { DevOverlay } from './components/DevOverlay'
import { MapScreen } from './components/MapScreen'
import { CommsScreen } from './components/CommsScreen'
import { TabBar, type TabId } from './components/TabBar'
import { GmPanel } from './components/GmPanel'
import { useComms } from './comms/useComms'

export function App() {
  const [tab, setTab] = useState<TabId>(() => (new URLSearchParams(location.search).get('tab') === 'comms' ? 'comms' : 'map'))
  const comms = useComms()

  // 両方の画面を常に置いておき、表示だけ切り替える(マップの視点や入力途中の文字を保つため)
  return (
    <>
      <Stage>
        <div className={`tab-page ${tab === 'map' ? '' : 'is-hidden'}`}>
          <MapScreen active={tab === 'map'} />
        </div>
        <div className={`tab-page ${tab === 'comms' ? '' : 'is-hidden'}`}>
          <CommsScreen comms={comms} active={tab === 'comms'} />
        </div>
        <TabBar tab={tab} onChange={setTab} badges={{ comms: tab !== 'comms' && comms.hasNew }} />
      </Stage>
      <GmPanel comms={comms} />
      <DevOverlay />
    </>
  )
}
