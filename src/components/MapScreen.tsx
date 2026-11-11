import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { FLAT_SECONDS, MapView, TOWER_SECONDS, WING_SECONDS } from '../map/MapView'
import type { StairType } from '../map/types'
import { BUILDINGS_IN, WINGS, WINGS_IN, type WingId, type WingView } from '../map/wings'
import type { Sim } from '../sim/useSim'
import { OrderBar } from './OrderBar'
import { floorColorCss } from '../map/floorColors'
import { FlatOverlay, overlayCell, overlayFrame, type DropTarget } from '../plan/FlatOverlay'
import { BombIcon } from '../plan/BombIcon'
import { draftSummary, emptyDraft, undoStroke, type Bomb } from '../plan/draft'
import type { Plans } from '../plan/usePlans'

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
  sims: Record<WingId, Sim>
  plans: Plans
  /** 描いた道順を送る */
  onSendPlan(): void
}

const VIEWS: { id: WingView; label: string }[] = [
  { id: 'west', label: '西棟' },
  { id: 'east', label: '東棟' },
  { id: 'both', label: '両方' },
]

const params = new URLSearchParams(location.search)
/** 3D には両方の棟をいつも置いておき、表示する棟だけ切り替える(作り直さないので、なめらかに切り替わる) */
const ALL_WINGS = WINGS_IN.both
const ALL_BUILDINGS = BUILDINGS_IN.both

/** ドラッグ中の爆弾。from = 置いてある爆弾を動かしているとき */
interface BombDrag {
  from: { wing: WingId; id: number } | null
  /** 画面(Stage)上の位置 */
  x: number
  y: number
  over: DropTarget | null
}

export function MapScreen({ view, onViewChange, target, onTargetChange, active, stairType, sims, plans, onSendPlan }: Props) {
  const buildings = BUILDINGS_IN[view]
  const wingIds = WINGS_IN[view]
  // 階のボタンは最初の棟の階で作る(どの棟も同じ階の並び)
  const building = buildings[0]
  // 階ごとの表示 ON/OFF。?floor=2F,3F のように URL で初期表示の階を指定できる(確認用)
  const [shownFloors, setShownFloors] = useState<boolean[]>(() => {
    const ids = params.get('floor')?.split(',')
    const fromUrl = building.floors.map((f) => !!ids?.includes(f.id))
    if (fromUrl.some(Boolean)) return fromUrl
    // 平面から始めるときは 1F だけ
    return building.floors.map((_, i) => params.get('view') !== 'plan' || i === 0)
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
    // 平面に切り替えたときは、まず線を描く階だけにする(階のボタンで重ねられる)
    if (next === '2d') setShownFloors((prev) => prev.map((_, j) => j === flatFloor))
    setMorphing(true)
    clearTimeout(morphTimer.current)
    morphTimer.current = window.setTimeout(() => setMorphing(false), FLAT_SECONDS * 1000)
  }
  /** 棟の切り替えの最中(平面では、描画レイヤーを隠して 3D が新しい位置へ寄るのを見せる) */
  const [switching, setSwitching] = useState(false)
  const switchTimer = useRef(0)
  const changeView = (next: WingView) => {
    if (next === view) return
    onViewChange(next)
    setSwitching(true)
    clearTimeout(switchTimer.current)
    switchTimer.current = window.setTimeout(() => setSwitching(false), WING_SECONDS * 1000)
  }
  const canDraw = mode === '2d' && !morphing && !switching

  /** 本来の塔(東棟を回して西棟の上に載せる)。立体で見る。?tower で塔から始める */
  const [tower, setTower] = useState(() => params.has('tower'))
  const towerTimer = useRef(0)
  const toggleTower = () => {
    clearTimeout(towerTimer.current)
    if (tower) return setTower(false)
    // 塔は両方の棟・全部の階を立体で見る
    setMode('3d')
    changeView('both')
    setShownFloors(building.floors.map(() => true))
    setTower(true)
  }
  /** 平面へ: 塔なら、先に東棟を隣へ戻してから平面にする */
  const toPlan = () => {
    if (!tower) return setMode('2d')
    setTower(false)
    clearTimeout(towerTimer.current)
    towerTimer.current = window.setTimeout(() => setMode('2d'), TOWER_SECONDS * 1000)
  }

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
  /** true: 階を離して表示 / false: 実際の建物どおり重ねる。?stack で重ねた状態から始める */
  const [exploded, setExploded] = useState(() => params.get('stack') === null)

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

  const floorIds = { west: WINGS.west.building.floors.map((f) => f.id), east: WINGS.east.building.floors.map((f) => f.id) }
  const draftCells = wingIds.reduce((n, w) => n + draftSummary(plans.drafts[w].points, floorIds[w]).cells, 0)

  return (
    <div className="screen layout layout--map" ref={screenRef}>
      <div className="layout-main map-main">
        <div className="map-viewport hud-frame" ref={viewportRef}>
          <div className="map-3d">
            <MapView
              buildings={ALL_BUILDINGS}
              shownWings={ALL_WINGS.map((w) => wingIds.includes(w))}
              shownFloors={shownFloors}
              autoRotate={autoRotate}
              resetKey={resetKey}
              exploded={exploded}
              tower={tower}
              stairType={stairType}
              flat={mode === '2d'}
              flatFloor={flatFloor}
              flatFrame={measureFlatFrame}
              paused={!active}
              allies={ALL_WINGS.map((id) => sims[id].view)}
              followAlly={ALL_WINGS.indexOf(target)}
              showTrail
              // 1つの階だけ表示しているときに仲間が別の階へ移ったら、その階に切り替える
              onAllyFloorChange={(f) =>
                setShownFloors((prev) => (prev.filter(Boolean).length === 1 && !prev[f] ? prev.map((_, j) => j === f) : prev))
              }
            />
          </div>
          {/* 線・爆弾を描く透明なレイヤー。変形のあいだも見えない状態で置いておき、3D がこの位置・大きさに合わせて平面になる */}
          {mode === '2d' && (
            <div className={`plan-layer ${switching ? 'is-switching' : canDraw ? '' : 'is-arriving'}`}>
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
      </div>

      <aside className="map-side">
        <div className="seg seg--mode">
          <button className={mode === '2d' ? 'is-active' : ''} onClick={toPlan}>
            平面
          </button>
          <button className={mode === '3d' ? 'is-active' : ''} onClick={() => setMode('3d')}>
            立体
          </button>
        </div>

        <button className={`side-btn tower-btn ${tower ? 'is-active' : ''}`} onClick={toggleTower}>
          {tower ? '塔から戻す' : '本来の塔'}
        </button>

        {/* 塔のあいだは、棟と階の切り替えはしない */}
        <div className={`side-label ${tower ? 'is-off' : ''}`}>棟</div>
        <div className={`seg ${tower ? 'is-off' : ''}`}>
          {VIEWS.map((v) => (
            <button key={v.id} className={view === v.id ? 'is-active' : ''} onClick={() => changeView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>

        <div className={`side-label ${tower ? 'is-off' : ''}`}>階</div>
        <div className={`seg seg--floors ${tower ? 'is-off' : ''}`}>
          {[...building.floors.keys()].map((i) => (
            <button
              key={i}
              className={shownFloors[i] ? 'is-active' : ''}
              style={{ '--floor-color': floorColorCss(i) } as CSSProperties}
              onClick={() => toggleFloor(i)}
            >
              {building.floors[i].id}
            </button>
          ))}
          <button className={allShown ? 'is-active' : ''} onClick={() => setShownFloors(building.floors.map(() => true))}>
            全
          </button>
        </div>

        {mode === '3d' && (
          <div className="side-row">
            {/* 塔はいつも重ねて表示するので、塔のあいだは切り替えない */}
            <button className={`side-btn side-btn--wide ${!exploded ? 'is-active' : ''} ${tower ? 'is-off' : ''}`} onClick={() => setExploded(!exploded)}>
              階を重ねる
            </button>
            <button className={`side-btn ${autoRotate ? 'is-active' : ''}`} onClick={() => setAutoRotate(!autoRotate)}>
              自動回転
            </button>
            <button className="side-btn" onClick={() => setResetKey(resetKey + 1)}>
              視点を戻す
            </button>
          </div>
        )}

        <OrderBar
          planMode={canDraw}
          onBombDown={(e) => startBombDrag(e, null)}
          draftCells={draftCells}
          canUndo={plans.drafts[target].strokes.length > 0}
          onUndo={() => plans.updateDraft(target, undoStroke)}
          onClear={() => wingIds.forEach((w) => plans.updateDraft(w, (d) => emptyDraft(d.points[0])))}
          onSend={onSendPlan}
        />
      </aside>

      {drag && (
        <div className={`bomb-drag ${drag.over ? 'is-over' : ''}`} style={{ left: drag.x, top: drag.y }}>
          <BombIcon px={84} />
        </div>
      )}
    </div>
  )
}
