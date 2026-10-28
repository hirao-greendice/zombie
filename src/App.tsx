import { useEffect, useState } from 'react'
import { Stage } from './components/Stage'
import { DevOverlay } from './components/DevOverlay'
import { MapScreen } from './components/MapScreen'
import { CommsScreen } from './components/CommsScreen'
import { TabBar, type TabId } from './components/TabBar'
import { GmPanel } from './components/GmPanel'
import { useComms } from './comms/useComms'
import { useSim } from './sim/useSim'
import { WINGS, WINGS_IN, type WingId, type WingView } from './map/wings'
import type { StairType } from './map/types'

const params = new URLSearchParams(location.search)
/** ?sim= の指示を送ったか(開発モードで初期化が2回走っても1回だけ送る) */
let initialOrderSent = false
/** ?wing=west / east / both で最初に表示する棟 */
const initialView: WingView = (['west', 'east', 'both'] as const).find((v) => v === params.get('wing')) ?? 'east'

export function App() {
  const [tab, setTab] = useState<TabId>(() => (params.get('tab') === 'comms' ? 'comms' : 'map'))
  const [stairType, setStairType] = useState<StairType>(() => (params.get('stairs') === 'uturn' ? 'uturn' : 'straight'))
  const [view, setView] = useState<WingView>(initialView)
  /** 指示を送る相手(どの棟の仲間か)。両方の棟を表示しているときは別に選ぶ */
  const [target, setTarget] = useState<WingId>(initialView === 'west' ? 'west' : 'east')
  const comms = useComms()
  // 仲間は棟ごとに1人ずつ。表示を切り替えても、それぞれの位置や軌跡は残る
  const sims = {
    west: useSim(WINGS.west.building, stairType),
    east: useSim(WINGS.east.building, stairType),
  }
  const sim = sims[target]
  const shownWings = WINGS_IN[view]

  const changeView = (v: WingView) => {
    setView(v)
    if (v !== 'both') setTarget(v)
  }

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
            view={view}
            onViewChange={changeView}
            target={target}
            onTargetChange={setTarget}
            active={tab === 'map'}
            stairType={stairType}
            onStairTypeChange={setStairType}
            allies={shownWings.map((id) => sims[id].view)}
            onSend={sendOrder}
            onResetAlly={sim.reset}
            // リプレイとデモは、表示している棟の仲間みんな
            onReplay={() => shownWings.forEach((id) => sims[id].replay())}
            onLoadDemo={() => shownWings.forEach((id) => sims[id].loadDemo())}
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
