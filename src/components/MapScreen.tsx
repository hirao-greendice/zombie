import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { FLAT_SECONDS, MapView } from '../map/MapView'
import type { StairType } from '../map/types'
import { BUILDINGS_IN, WINGS, WINGS_IN, type WingId, type WingView } from '../map/wings'
import type { Sim } from '../sim/useSim'
import { OrderBar } from './OrderBar'
import { floorColorCss } from '../map/floorColors'
import { FlatOverlay, overlayCell, overlayFrame, type DropTarget } from '../plan/FlatOverlay'
import { BombIcon } from '../plan/BombIcon'
import { draftSummary, emptyDraft, undoStroke, type Bomb } from '../plan/draft'
import type { Plans } from '../plan/usePlans'

// 平面図の印の意味が決まったらここを書き換える
const LEGEND = [
  { cls: 'legend-ally', text: '仲間' },
  { cls: 'legend-route', text: '描いた道順(送信前)' },
  { cls: 'legend-bomb', text: '爆弾(仲間が通ると設置)' },
  { cls: 'legend-zombie', text: 'ゾンビ(通行不可)' },
  { cls: 'legend-arrival', text: '到着地点(下の階から)' },
  { cls: 'legend-gem neutral', text: '黒丸 / 青丸マーカー' },
  { cls: 'legend-box danger', text: '赤四角マーカー' },
  { cls: 'legend-bars', text: '鉄格子(通行不可)' },
  { cls: 'legend-fill key', text: '番号付きの部屋' },
  { cls: 'legend-fill info', text: '階段 / EV' },
]

interface Props {
  /** 表示中の棟(both = 両方を並べる) */
  view: WingView
  onViewChange(view: WingView): void
  /** 3D で追いかける仲間 / 「1つ戻す」の対象の棟(最後に線を描いた棟) */
  target: WingId
  onTargetChange(target: WingId): void
  /** 表示中のタブかどうか(非表示中は描画を止める) */
  active: boolean
  stairType: StairType
  onStairTypeChange(type: StairType): void
  sims: Record<WingId, Sim>
  plans: Plans
  /** 描いた道順を送る */
  onSendPlan(): void
  onReplay(): void
  onLoadDemo(): void
}

const VIEWS: { id: WingView; label: string }[] = [
  { id: 'west', label: WINGS.west.label },
  { id: 'east', label: WINGS.east.label },
  { id: 'both', label: 'BOTH' },
]

const params = new URLSearchParams(location.search)

/** ドラッグ中の爆弾。from = 置いてある爆弾を動かしているとき */
interface BombDrag {
  from: { wing: WingId; id: number } | null
  /** 画面(Stage)上の位置 */
  x: number
  y: number
  over: DropTarget | null
}

export function MapScreen({ view, onViewChange, target, onTargetChange, active, stairType, onStairTypeChange, sims, plans, onSendPlan, onReplay, onLoadDemo }: Props) {
  const buildings = BUILDINGS_IN[view]
  const wingIds = WINGS_IN[view]
  // 階のボタンは最初の棟の階で作る(どの棟も同じ階の並び)
  const building = buildings[0]
  // 階ごとの表示 ON/OFF。?floor=2F,3F のように URL で初期表示の階を指定できる(確認用)
  const [shownFloors, setShownFloors] = useState<boolean[]>(() => {
    const ids = params.get('floor')?.split(',')
    const fromUrl = building.floors.map((f) => !!ids?.includes(f.id))
    return fromUrl.some(Boolean) ? fromUrl : building.floors.map(() => true)
  })
  /** 階の ON/OFF を切り替える(最後の1つは消せない)。立体でも平面でも同じ */
  const toggleFloor = (i: number) =>
    setShownFloors((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v))
      return next.some(Boolean) ? next : prev
    })
  const allShown = shownFloors.every(Boolean)
  /** 2D = 平面に変形して線を描く / 3D = 立体で見比べる。?view=plan で平面から始める(確認用) */
  const [mode, setModeRaw] = useState<'2d' | '3d'>(() => (params.get('view') === 'plan' ? '2d' : '3d'))
  /** 立体 ⇄ 平面の変形の最中(このあいだは線を描けない) */
  const [morphing, setMorphing] = useState(false)
  const morphTimer = useRef(0)
  const setMode = (next: '2d' | '3d') => {
    if (next === mode) return
    setModeRaw(next)
    setMorphing(true)
    clearTimeout(morphTimer.current)
    morphTimer.current = window.setTimeout(() => setMorphing(false), FLAT_SECONDS * 1000)
  }
  const canDraw = mode === '2d' && !morphing

  /**
   * 平面で線を描く階。線の先(描いていなければ仲間)の階が表示されていればその階、なければ表示している一番上の階。
   * 表示の切り替えは立体と同じ FLOORS のボタンで行い、ここは自動で決まる
   */
  const draftEnd = plans.drafts[target].points[plans.drafts[target].points.length - 1]
  const shownIdx = [...shownFloors.keys()].filter((i) => shownFloors[i])
  const flatFloor = shownFloors[draftEnd.floor] ? draftEnd.floor : shownIdx[shownIdx.length - 1]
  /** その階を表示する(1つの階だけ表示していたら、その階に切り替える。立体で仲間が階を移ったときと同じ) */
  const showFloor = (f: number) =>
    setShownFloors((prev) => (prev[f] ? prev : prev.filter(Boolean).length === 1 ? prev.map((_, j) => j === f) : prev.map((v, j) => v || j === f)))

  /** 描画レイヤー(SVG)の位置と大きさ。3D はこれにぴったり重なるように平面へ変形する */
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureFlatFrame = () => (viewportRef.current ? overlayFrame(viewportRef.current) : null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [exploded, setExploded] = useState(() => params.get('stack') === null)
  const [showTrail, setShowTrail] = useState(true)

  // --- 爆弾のドラッグ&ドロップ(指でもマウスでも動くように pointer イベントで自前で行う) ---
  const screenRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<BombDrag | null>(null)
  /** 画面上の位置 → Stage の座標と、その下にある平面図のマス */
  const locate = (clientX: number, clientY: number) => {
    const el = screenRef.current!
    const rect = el.getBoundingClientRect()
    const scale = rect.width / el.offsetWidth
    const svg = document.elementFromPoint(clientX, clientY)?.closest<SVGSVGElement>('svg[data-plan]')
    const cell = svg && overlayCell(svg, clientX, clientY)
    // 爆弾は線を描いている階に置く
    const over: DropTarget | null = cell ? { ...cell, floor: flatFloor } : null
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale, over }
  }
  const startBombDrag = (e: ReactPointerEvent, from: BombDrag['from']) => {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ from, ...locate(e.clientX, e.clientY) })
    const move = (ev: PointerEvent) => setDrag((d) => d && { ...d, ...locate(ev.clientX, ev.clientY) })
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      const { over } = locate(ev.clientX, ev.clientY)
      setDrag(null)
      if (ev.type === 'pointercancel') return
      const at = over && { floor: over.floor, x: over.x, y: over.y }
      if (!from) {
        if (over && at) plans.placeBomb(over.wing, at)
      } else if (over && at) plans.moveBomb(from.wing, from.id, over.wing, at)
      // 平面図の外へ持っていったら取り消し
      else plans.removeBomb(from.wing, from.id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const shownAll = buildings.flatMap((b) => b.floors.filter((_, i) => shownFloors[i]))
  const shownIds = shownIdx.map((i) => building.floors[i].id)
  const zombieCount = shownAll.reduce((n, f) => n + f.markers.filter((m) => m.kind === 'zombie').length, 0)
  const floorIds = { west: WINGS.west.building.floors.map((f) => f.id), east: WINGS.east.building.floors.map((f) => f.id) }
  const draftCells = wingIds.reduce((n, w) => n + draftSummary(plans.drafts[w].points, floorIds[w]).cells, 0)
  const bombsOf = (w: WingId) => plans.bombs[w]
  const planted = wingIds.reduce((n, w) => n + bombsOf(w).filter((b) => b.plantedAt !== null).length, 0)
  const placed = wingIds.reduce((n, w) => n + bombsOf(w).length, 0)

  return (
    <div className="screen layout layout--map" ref={screenRef}>
      <header className="screen-header">
        <div className="map-title">
          <span className="map-title-main">{buildings.map((b) => b.name).join(' + ')}</span>
          <span className="map-title-sub">// {mode === '2d' ? 'FLOOR PLAN' : '3D FACILITY MAP'}</span>
        </div>
        <div className="view-switch" role="tablist">
          <button className={mode === '2d' ? 'is-active' : ''} onClick={() => setMode('2d')}>
            平面<small>PLAN</small>
          </button>
          <button className={mode === '3d' ? 'is-active' : ''} onClick={() => setMode('3d')}>
            立体<small>3D</small>
          </button>
        </div>
      </header>

      <div className="layout-main map-main">
        <div className="map-viewport hud-frame" ref={viewportRef}>
          <div className="map-3d">
            <MapView
              buildings={buildings}
              shownFloors={shownFloors}
              autoRotate={autoRotate}
              resetKey={resetKey}
              exploded={exploded}
              stairType={stairType}
              flat={mode === '2d'}
              flatFloor={flatFloor}
              flatFrame={measureFlatFrame}
              paused={!active}
              allies={wingIds.map((id) => sims[id].view)}
              followAlly={wingIds.indexOf(target)}
              showTrail={showTrail}
              // 1つの階だけ表示しているときに仲間が別の階へ移ったら、その階に切り替える
              onAllyFloorChange={(f) =>
                setShownFloors((prev) => (prev.filter(Boolean).length === 1 && !prev[f] ? prev.map((_, j) => j === f) : prev))
              }
            />
            <div className="map-viewport-caption">
              {mode === '2d'
                ? `${allShown ? 'ALL FLOORS' : `FLOOR ${shownIds.join(' + ')}`}  /  線を描く階: ${building.floors[flatFloor]?.id}`
                : `${allShown ? 'ALL FLOORS' : `FLOOR ${shownAll.map((f) => f.id).join(' + ')}`}  /  DRAG: ROTATE  /  PINCH: ZOOM`}
            </div>
          </div>
          {/* 線・爆弾を描く透明なレイヤー。変形のあいだも見えない状態で置いておき、3D がこの位置・大きさに合わせて平面になる */}
          {mode === '2d' && (
            <div className={`plan-layer ${canDraw ? '' : 'is-arriving'}`}>
              <FlatOverlay
                wings={wingIds}
                stairType={stairType}
                sims={sims}
                plans={plans}
                paused={!active}
                focus={flatFloor}
                onFocusChange={showFloor}
                shownFloors={shownFloors}
                dropTarget={drag?.over ?? null}
                target={target}
                onTarget={onTargetChange}
                onBombDown={(wing: WingId, b: Bomb, e) => startBombDrag(e, { wing, id: b.id })}
              />
            </div>
          )}
        </div>
        <OrderBar
          planMode={canDraw}
          onBombDown={(e) => startBombDrag(e, null)}
          draftCells={draftCells}
          canUndo={plans.drafts[target].strokes.length > 0}
          onUndo={() => plans.updateDraft(target, undoStroke)}
          onClear={() => wingIds.forEach((w) => plans.updateDraft(w, (d) => emptyDraft(d.points[0])))}
          onSend={onSendPlan}
          onReplay={onReplay}
          onResetAlly={() => wingIds.forEach((w) => plans.reset(w))}
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

        <div className="panel-heading">FLOORS (ON / OFF)</div>
        <div className="floor-buttons floor-buttons--floors">
          {[...building.floors.keys()].map((i) => (
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
          {wingIds.map((w) => {
            const pos = sims[w].view.pos
            return [
              <dt key={`${w}-t`}>{WINGS[w].label} ALLY</dt>,
              <dd key={`${w}-d`} style={{ color: floorColorCss(pos.floor) }}>
                {pos.roof ? 'ROOF' : WINGS[w].building.floors[pos.floor].id}
              </dd>,
            ]
          })}
          <dt>BOMBS SET</dt>
          <dd className="warn">
            {planted} / {placed}
          </dd>
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
          {mode === '3d' && (
            <>
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
            </>
          )}
        </div>
      </aside>

      {drag && (
        <div className={`bomb-drag ${drag.over ? 'is-over' : ''}`} style={{ left: drag.x, top: drag.y }}>
          <BombIcon px={84} />
        </div>
      )}
    </div>
  )
}
