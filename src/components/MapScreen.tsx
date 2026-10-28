import { useState, type CSSProperties } from 'react'
import { MapView } from '../map/MapView'
import type { StairType } from '../map/types'
import { BUILDINGS_IN, WINGS, WINGS_IN, type WingId, type WingView } from '../map/wings'
import type { AllyView } from '../sim/useSim'
import { SimPanel } from './SimPanel'
import { floorColorCss } from '../map/floorColors'

// 平面図の印の意味が決まったらここを書き換える
const LEGEND = [
  { cls: 'legend-ally', text: '仲間(シミュレーション)' },
  { cls: 'legend-zombie', text: 'ゾンビ(通行不可)' },
  { cls: 'legend-arrival', text: '到着地点(下の階から)' },
  { cls: 'legend-gem neutral', text: '黒丸マーカー' },
  { cls: 'legend-gem info', text: '青丸マーカー' },
  { cls: 'legend-box danger', text: '赤四角マーカー' },
  { cls: 'legend-door', text: '出入口' },
  { cls: 'legend-bars', text: '鉄格子(通行不可)' },
  { cls: 'legend-fill key', text: '番号付きの部屋' },
  { cls: 'legend-fill info', text: '階段 / EV' },
]

interface Props {
  /** 表示中の棟(both = 両方を並べる) */
  view: WingView
  onViewChange(view: WingView): void
  /** 指示を送る相手の棟 */
  target: WingId
  onTargetChange(target: WingId): void
  /** 表示中のタブかどうか(非表示中は 3D の描画を止める) */
  active: boolean
  stairType: StairType
  onStairTypeChange(type: StairType): void
  /** 表示している棟の仲間(左から順) */
  allies: AllyView[]
  onSend(text: string): void
  onResetAlly(): void
  onReplay(): void
  onLoadDemo(): void
}

const VIEWS: { id: WingView; label: string }[] = [
  { id: 'west', label: WINGS.west.label },
  { id: 'east', label: WINGS.east.label },
  { id: 'both', label: 'BOTH' },
]

export function MapScreen({ view, onViewChange, target, onTargetChange, active, stairType, onStairTypeChange, allies, onSend, onResetAlly, onReplay, onLoadDemo }: Props) {
  const buildings = BUILDINGS_IN[view]
  // 階のボタンは最初の棟の階で作る(どの棟も同じ階の並び)
  const building = buildings[0]
  // 階ごとの表示 ON/OFF。?floor=2F,3F のように URL で初期表示の階を指定できる(確認用)
  const [shownFloors, setShownFloors] = useState<boolean[]>(() => {
    const ids = new URLSearchParams(location.search).get('floor')?.split(',')
    const fromUrl = building.floors.map((f) => !!ids?.includes(f.id))
    return fromUrl.some(Boolean) ? fromUrl : building.floors.map(() => true)
  })
  /** 階の ON/OFF を切り替える(最後の1つは消せない) */
  const toggleFloor = (i: number) =>
    setShownFloors((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v))
      return next.some(Boolean) ? next : prev
    })
  const allShown = shownFloors.every(Boolean)
  const [autoRotate, setAutoRotate] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [exploded, setExploded] = useState(() => new URLSearchParams(location.search).get('stack') === null)
  const [showTrail, setShowTrail] = useState(true)

  const shown = building.floors.filter((_, i) => shownFloors[i])
  /** 表示している棟すべての、表示している階 */
  const shownAll = buildings.flatMap((b) => b.floors.filter((_, i) => shownFloors[i]))
  const zombieCount = shownAll.reduce((n, f) => n + f.markers.filter((m) => m.kind === 'zombie').length, 0)

  return (
    <div className="screen layout layout--map">
      <header className="screen-header">
        <div className="map-title">
          <span className="map-title-main">{buildings.map((b) => b.name).join(' + ')}</span>
          <span className="map-title-sub">// 3D FACILITY MAP</span>
        </div>
      </header>

      <div className="layout-main map-main">
        <div className="map-viewport hud-frame">
          <MapView
            buildings={buildings}
            shownFloors={shownFloors}
            autoRotate={autoRotate}
            resetKey={resetKey}
            exploded={exploded}
            stairType={stairType}
            paused={!active}
            allies={allies}
            followAlly={WINGS_IN[view].indexOf(target)}
            showTrail={showTrail}
            // 1つの階だけ表示しているときに仲間が別の階へ移ったら、その階に切り替える
            onAllyFloorChange={(f) =>
              setShownFloors((prev) => (prev.filter(Boolean).length === 1 && !prev[f] ? prev.map((_, j) => j === f) : prev))
            }
          />
          <div className="map-viewport-caption">
            {allShown ? 'ALL FLOORS' : `FLOOR ${shown.map((f) => f.id).join(' + ')}`} &nbsp;/&nbsp; DRAG: ROTATE &nbsp;/&nbsp; PINCH: ZOOM
          </div>
        </div>
        <SimPanel
          onSend={onSend}
          onResetAlly={onResetAlly}
          onReplay={onReplay}
          onLoadDemo={onLoadDemo}
          showTrail={showTrail}
          onShowTrailChange={setShowTrail}
        />
      </div>

      <aside className="map-panel">
        <div className="panel-heading">WING</div>
        <div className="floor-buttons floor-buttons--wing">
          {VIEWS.map((v) => (
            <button key={v.id} className={`floor-btn floor-btn--wing ${view === v.id ? 'is-active' : ''}`} onClick={() => onViewChange(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        {view === 'both' && (
          <div className="target-buttons">
            <span>ORDERS TO</span>
            {WINGS_IN.both.map((id) => (
              <button key={id} className={`panel-btn ${target === id ? 'is-active' : ''}`} onClick={() => onTargetChange(id)}>
                {WINGS[id].label}
              </button>
            ))}
          </div>
        )}

        <div className="panel-heading">FLOORS (ON / OFF)</div>
        <div className="floor-buttons">
          {[...building.floors.keys()].reverse().map((i) => (
            <button
              key={i}
              className={`floor-btn ${shownFloors[i] ? 'is-active' : ''}`}
              style={{ '--floor-color': floorColorCss(i) } as CSSProperties}
              onClick={() => toggleFloor(i)}
            >
              {building.floors[i].id}
            </button>
          ))}
          <button
            className={`floor-btn floor-btn--all ${allShown ? 'is-active' : ''}`}
            onClick={() => setShownFloors(building.floors.map(() => true))}
          >
            ALL
          </button>
        </div>

        <div className="panel-heading">STATUS</div>
        <dl className="panel-stats">
          <dt>FLOOR</dt>
          <dd>
            {building.floors.map((f, i) =>
              shownFloors[i] ? (
                <span key={f.id} style={{ color: floorColorCss(i), marginLeft: 12 }}>
                  {f.id}
                </span>
              ) : null,
            )}
          </dd>
          <dt>ROOMS</dt>
          <dd>{shownAll.reduce((n, f) => n + f.rooms.length, 0)}</dd>
          <dt>HOSTILES</dt>
          <dd className="danger">{zombieCount}</dd>
        </dl>

        <div className="panel-heading">LEGEND</div>
        <ul className="panel-legend">
          {LEGEND.map((l) => (
            <li key={l.text}>
              <i className={l.cls} />
              {l.text}
            </li>
          ))}
        </ul>

        <div className="panel-actions">
          <button className="panel-btn" onClick={() => onStairTypeChange(stairType === 'straight' ? 'uturn' : 'straight')}>
            <small>STAIRS</small>
            {stairType === 'straight' ? 'STRAIGHT' : 'U-TURN'}
          </button>
          <button className={`panel-btn ${exploded ? '' : 'is-active'}`} onClick={() => setExploded(!exploded)}>
            <small>FLOORS</small>
            {exploded ? 'SPLIT' : 'STACKED'}
          </button>
          <button className={`panel-btn ${autoRotate ? 'is-active' : ''}`} onClick={() => setAutoRotate(!autoRotate)}>
            <small>ROTATE</small>
            {autoRotate ? 'AUTO' : 'OFF'}
          </button>
          <button className="panel-btn" onClick={() => setResetKey(resetKey + 1)}>
            <small>VIEW</small>
            RESET
          </button>
        </div>
      </aside>
    </div>
  )
}
