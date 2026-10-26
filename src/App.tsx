import { useEffect, useState } from 'react'
import { Stage } from './components/Stage'
import { DevOverlay } from './components/DevOverlay'
import { MapScreen } from './components/MapScreen'
import { CommsScreen } from './components/CommsScreen'
import { TabBar, type TabId } from './components/TabBar'
import { GmPanel } from './components/GmPanel'
import { useComms } from './comms/useComms'
import { useSim } from './sim/useSim'
import { EAST_WING } from './map/eastWing'
import type { StairType } from './map/types'

const params = new URLSearchParams(location.search)
/** ?sim= の指示を送ったか(開発モードで初期化が2回走っても1回だけ送る) */
let initialOrderSent = false

export function App() {
  const [tab, setTab] = useState<TabId>(() => (params.get('tab') === 'comms' ? 'comms' : 'map'))
  const [stairType, setStairType] = useState<StairType>(() => (params.get('stairs') === 'uturn' ? 'uturn' : 'straight'))
  const comms = useComms()
  const sim = useSim(EAST_WING, stairType)

  /** 指示を送る: ログに残し、仲間を動かして返事を受け取る */
  const sendOrder = (text: string) => {
    if (!text.trim()) return
    comms.send(text)
    comms.receive(sim.exec(text))
  }

  // ?sim=⬅️⬆️ で、開いた直後にその指示を送る(確認用)
  useEffect(() => {
    const order = params.get('sim')
    if (!order || initialOrderSent) return
    initialOrderSent = true
    sendOrder(order)
  }, [])

  // 両方の画面を常に置いておき、表示だけ切り替える(マップの視点や入力途中の文字を保つため)
  return (
    <>
      <Stage>
        <div className={`tab-page ${tab === 'map' ? '' : 'is-hidden'}`}>
          <MapScreen
            building={EAST_WING}
            active={tab === 'map'}
            stairType={stairType}
            onStairTypeChange={setStairType}
            ally={sim.view}
            onSend={sendOrder}
            onResetAlly={sim.reset}
            onReplay={sim.replay}
          />
        </div>
        <div className={`tab-page ${tab === 'comms' ? '' : 'is-hidden'}`}>
          <CommsScreen comms={comms} onSend={sendOrder} active={tab === 'comms'} />
        </div>
        <TabBar tab={tab} onChange={setTab} badges={{ comms: tab !== 'comms' && comms.hasNew }} />
      </Stage>
      <GmPanel comms={comms} onResetAlly={sim.reset} />
      <DevOverlay />
    </>
  )
}
