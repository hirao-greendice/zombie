import { useEffect, useState } from 'react'
import { Stage } from './components/Stage'
import { DevOverlay } from './components/DevOverlay'
import { MapScreen } from './components/MapScreen'
import { CommsScreen } from './components/CommsScreen'
import { TabBar, type TabId } from './components/TabBar'
import { GmPanel } from './components/GmPanel'
import { useComms } from './comms/useComms'
import { useSim } from './sim/useSim'
import { usePlans } from './plan/usePlans'
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
  /** 最後に線を描いた棟(3D で追いかける仲間)。片方の棟だけ表示しているときはその棟 */
  const [target, setTarget] = useState<WingId>(initialView === 'west' ? 'west' : 'east')
  const comms = useComms()
  // 仲間は棟ごとに1人ずつ。表示を切り替えても、それぞれの位置や軌跡は残る
  const sims = {
    west: useSim(WINGS.west.building, stairType),
    east: useSim(WINGS.east.building, stairType),
  }
  const plans = usePlans(sims)
  const shownWings = WINGS_IN[view]

  const changeView = (v: WingView) => {
    setView(v)
    if (v !== 'both') setTarget(v)
  }

  /** 平面図に描いた道順を送る: ログに残し、仲間を動かして返事を受け取る */
  const sendPlan = () => {
    const floorIds = { west: WINGS.west.building.floors.map((f) => f.id), east: WINGS.east.building.floors.map((f) => f.id) }
    for (const s of plans.send(floorIds)) {
      const prefix = view === 'both' ? `[${WINGS[s.wing].label}] ` : ''
      comms.send(prefix + s.order)
      comms.receive(prefix + s.reply)
    }
  }

  // ?sim=⬅️⬆️ で、開いた直後にその指示を送る(確認用)
  useEffect(() => {
    const order = params.get('sim')
    if (!order || initialOrderSent) return
    initialOrderSent = true
    comms.send(order)
    comms.receive(sims[target].exec(order).reply)
  }, [])

  // 両方の画面を常に置いておき、表示だけ切り替える(マップの視点や描きかけの線を保つため)
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
            sims={sims}
            plans={plans}
            onSendPlan={sendPlan}
            // リプレイとデモは、表示している棟の仲間みんな
            onReplay={() => shownWings.forEach((id) => sims[id].replay())}
            onLoadDemo={() => shownWings.forEach((id) => sims[id].loadDemo())}
          />
        </div>
        <div className={`tab-page ${tab === 'comms' ? '' : 'is-hidden'}`}>
          <CommsScreen comms={comms} active={tab === 'comms'} />
        </div>
        <TabBar tab={tab} onChange={setTab} badges={{ comms: tab !== 'comms' && comms.hasNew }} />
      </Stage>
      <GmPanel comms={comms} onResetAlly={() => (['west', 'east'] as const).forEach((w) => plans.reset(w))} />
      <DevOverlay />
    </>
  )
}
