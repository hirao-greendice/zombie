import { useState } from 'react'
import { MapView } from '../map/MapView'
import { EAST_WING } from '../map/eastWing'
import type { StairType } from '../map/types'

// 平面図の印の意味が決まったらここを書き換える
const LEGEND = [
  { cls: 'legend-zombie', text: 'ゾンビ(通行不可)' },
  { cls: 'legend-arrival', text: '到着地点(下の階から)' },
  { cls: 'legend-gem neutral', text: '黒丸マーカー' },
  { cls: 'legend-gem info', text: '青丸マーカー' },
  { cls: 'legend-box danger', text: '赤四角マーカー' },
  { cls: 'legend-door', text: '出入口' },
  { cls: 'legend-fill key', text: '番号付きの部屋' },
  { cls: 'legend-fill info', text: '階段 / EV' },
]

/** active: 表示中のタブかどうか(非表示中は 3D の描画を止める) */
export function MapScreen({ active }: { active: boolean }) {
  const building = EAST_WING
  // ?floor=2F のように URL で初期表示の階を指定できる(確認用)
  const [activeFloor, setActiveFloor] = useState<number | null>(() => {
    const i = building.floors.findIndex((f) => f.id === new URLSearchParams(location.search).get('floor'))
    return i < 0 ? null : i
  })
  const [autoRotate, setAutoRotate] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [exploded, setExploded] = useState(() => new URLSearchParams(location.search).get('stack') === null)
  const [stairType, setStairType] = useState<StairType>(() =>
    new URLSearchParams(location.search).get('stairs') === 'uturn' ? 'uturn' : 'straight',
  )

  const floor = activeFloor === null ? null : building.floors[activeFloor]
  const shown = floor ? [floor] : building.floors
  const zombieCount = shown.reduce((n, f) => n + f.markers.filter((m) => m.kind === 'zombie').length, 0)

  return (
    <div className="screen layout layout--map">
      <header className="screen-header">
        <div className="map-title">
          <span className="map-title-main">{building.name}</span>
          <span className="map-title-sub">// 3D FACILITY MAP</span>
        </div>
      </header>

      <div className="layout-main hud-frame">
        <MapView
          building={building}
          activeFloor={activeFloor}
          autoRotate={autoRotate}
          resetKey={resetKey}
          exploded={exploded}
          stairType={stairType}
          paused={!active}
        />
        <div className="map-viewport-caption">
          {floor ? `FLOOR ${floor.id}` : 'ALL FLOORS'} &nbsp;/&nbsp; DRAG: ROTATE &nbsp;/&nbsp; PINCH: ZOOM
        </div>
      </div>

      <aside className="map-panel">
        <div className="panel-heading">FLOOR SELECT</div>
        <div className="floor-buttons">
          {[...building.floors.keys()].reverse().map((i) => (
            <button
              key={i}
              className={`floor-btn ${activeFloor === i ? 'is-active' : ''}`}
              onClick={() => setActiveFloor(activeFloor === i ? null : i)}
            >
              {building.floors[i].id}
            </button>
          ))}
          <button className={`floor-btn floor-btn--all ${activeFloor === null ? 'is-active' : ''}`} onClick={() => setActiveFloor(null)}>
            ALL
          </button>
        </div>

        <div className="panel-heading">STATUS</div>
        <dl className="panel-stats">
          <dt>FLOOR</dt>
          <dd>{floor ? floor.id : `1F - ${building.floors.length}F`}</dd>
          <dt>ROOMS</dt>
          <dd>{shown.reduce((n, f) => n + f.rooms.length, 0)}</dd>
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
          <button className="panel-btn" onClick={() => setStairType(stairType === 'straight' ? 'uturn' : 'straight')}>
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
