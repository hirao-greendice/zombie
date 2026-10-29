import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Building, StairType } from '../map/types'

import { WING_GAP, WINGS, type WingId } from '../map/wings'
import { inStairs } from '../sim/nav'
import type { Sim } from '../sim/useSim'
import { BombGlyph } from './BombIcon'
import { extendDraft, samePoint, startStroke, type Bomb, type PlanPoint } from './draft'
import type { Plans } from './usePlans'
import { useWalker } from './useWalker'

/** 平面のまわりの余白(マス) */
const PAD = 0.7
/** 階段の中で指を止めてから、上の階へ移るまでの時間(ms)。CSS の .plan-dwell-fill と合わせる */
const DWELL_MS = 700

/** 爆弾をドラッグしているときの、落とす先 */
export interface DropTarget extends PlanPoint {
  wing: WingId
}

/** 棟を左から並べたときの位置(3D の MapView と同じ並べ方) */
function layoutOf(wings: WingId[]) {
  let cursor = 0
  const items = wings.map((wing) => {
    const building = WINGS[wing].building
    const item = { wing, building, ox: cursor }
    cursor += building.width + WING_GAP
    return item
  })
  const width = cursor - WING_GAP
  const depth = Math.max(...items.map((i) => i.building.depth))
  return { items, width, depth }
}

/** 画面上の位置 → 平面のどの棟のどのマスか。棟の外なら null(clamp = 指定の棟の中に収める) */
export function overlayCell(svg: SVGSVGElement, clientX: number, clientY: number, clampTo?: WingId) {
  const m = svg.getScreenCTM()
  if (!m) return null
  const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse())
  const { items } = layoutOf(svg.dataset.wings!.split(',') as WingId[])
  for (const { wing, building, ox } of items) {
    let x = Math.floor(p.x - ox)
    let y = Math.floor(p.y)
    if (clampTo === wing) {
      x = Math.min(Math.max(x, 0), building.width - 1)
      y = Math.min(Math.max(y, 0), building.depth - 1)
    }
    if (x >= 0 && y >= 0 && x < building.width && y < building.depth) return { wing, x, y }
  }
  return null
}

/** 平面に変形した 3D の大きさ(1マスの px)と位置。この SVG にぴったり重なるように 3D が降りてくる */
export function overlayFrame(viewport: HTMLElement) {
  const svg = viewport.querySelector<SVGSVGElement>('svg[data-plan]')
  if (!svg) return null
  const vr = viewport.getBoundingClientRect()
  const r = svg.getBoundingClientRect()
  const { width, depth } = layoutOf(svg.dataset.wings!.split(',') as WingId[])
  // 画面の px → Stage の px(Stage は拡大縮小して表示している)
  const k = viewport.clientWidth / vr.width
  const scale = Math.min(r.width / (width + PAD * 2), r.height / (depth + PAD * 2))
  return {
    cx: (r.left + r.width / 2 - (vr.left + vr.width / 2)) * k,
    cy: (r.top + r.height / 2 - (vr.top + vr.height / 2)) * k,
    scale: scale * k,
  }
}

const ptsAttr = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ')

/** 同じ階で続いている部分ごとに分ける */
function runsOn<T extends { floor: number }>(points: T[], floor: number): T[][] {
  const runs: T[][] = []
  let cur: T[] = []
  for (const p of points) {
    if (p.floor === floor) cur.push(p)
    else if (cur.length) {
      runs.push(cur)
      cur = []
    }
  }
  if (cur.length) runs.push(cur)
  return runs
}

interface Props {
  /** 表示している棟(左から順) */
  wings: WingId[]
  stairType: StairType
  sims: Record<WingId, Sim>
  plans: Plans
  paused: boolean
  /** 線を描く階 */
  focus: number
  /** 線を描く階が変わるとき(その階を表示する) */
  onFocusChange(floor: number): void
  /** 表示している階 */
  shownFloors: boolean[]
  dropTarget: DropTarget | null
  /** 最後に線を描いた棟。線を描く階は、この棟の仲間に合わせて動く */
  target: WingId
  onTarget(wing: WingId): void
  onBombDown(wing: WingId, bomb: Bomb, e: ReactPointerEvent): void
}

/**
 * 平面に変形した 3D マップの上に重ねる、透明な描画レイヤー。
 * 間取りは 3D が描き、ここでは指でなぞった道順・爆弾・指しているマスだけを描く
 */
export function FlatOverlay({ wings, stairType, sims, plans, paused, focus, onFocusChange, shownFloors, dropTarget, target, onTarget, onBombDown }: Props) {
  const walkers = { west: useWalker(sims.west.view, paused), east: useWalker(sims.east.view, paused) }
  const layout = layoutOf(wings)
  const floorCount = layout.items[0].building.floors.length
  const setFocus = (f: number) => onFocusChange(Math.min(Math.max(f, 0), floorCount - 1))

  const [cursor, setCursor] = useState<DropTarget | null>(null)
  const [hint, setHint] = useState<{ text: string; id: number } | null>(null)
  const showHint = (text: string) => setHint({ text, id: Date.now() })
  /** 線を描いている棟 */
  const [drawing, setDrawingState] = useState<WingId | null>(null)
  const drawingRef = useRef<WingId | null>(null)
  const setDrawing = (w: WingId | null) => {
    drawingRef.current = w
    setDrawingState(w)
  }

  useEffect(() => {
    if (!hint) return
    const id = setTimeout(() => setHint(null), 2200)
    return () => clearTimeout(id)
  }, [hint])

  // 仲間が歩いて別の階へ移ったら、線を描く階もついていく(線を描いている途中は動かさない)
  const allyFloor = walkers[target].floor
  const lastAllyFloor = useRef(allyFloor)
  useEffect(() => {
    if (allyFloor === lastAllyFloor.current) return
    lastAllyFloor.current = allyFloor
    if (!drawingRef.current) setFocus(allyFloor)
  }, [allyFloor])

  // --- 階段で指を止めると、上の階へ線が続く ---
  const draftEnd = drawing ? plans.drafts[drawing].points[plans.drafts[drawing].points.length - 1] : null
  /** 上ってきたばかりの点(そこで止まっていても、さらに上へは行かない) */
  const justArrived = useRef<PlanPoint | null>(null)
  let dwellAt: PlanPoint | null = null
  if (drawing && draftEnd && draftEnd.floor === focus && !(justArrived.current && samePoint(justArrived.current, draftEnd))) {
    const nav = sims[drawing].nav
    if (nav.floors[draftEnd.floor + 1]?.stairs && inStairs(nav.floors[draftEnd.floor].stairs, draftEnd)) dwellAt = draftEnd
  }
  const dwellKey = dwellAt ? `${drawing},${dwellAt.floor},${dwellAt.x},${dwellAt.y}` : ''
  useEffect(() => {
    if (!dwellAt || !drawing) return
    const at = dwellAt
    const id = setTimeout(() => {
      const above = sims[drawing].nav.floors[at.floor + 1]
      const arrival = { floor: at.floor + 1, ...(above.arrival[stairType] ?? above.stairs!.entry) }
      justArrived.current = arrival
      plans.updateDraft(drawing, (d) => ({ ...d, points: [...d.points, arrival] }))
      setFocus(arrival.floor)
    }, DWELL_MS)
    return () => clearTimeout(id)
  }, [dwellKey])

  const cellOf = (e: ReactPointerEvent<SVGSVGElement>, clampTo?: WingId): DropTarget | null => {
    const c = overlayCell(e.currentTarget, e.clientX, e.clientY, clampTo)
    return c && { ...c, floor: focus }
  }
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const at = cellOf(e)
    if (!at) return
    setCursor(at)
    const { wing } = at
    const draft = plans.drafts[wing]
    const res = startStroke(draft, at, sims[wing].nav, stairType)
    if (!res.ok) {
      // 線の先が別の階にあるときは、その階に切り替えて知らせる
      const end = draft.points[draft.points.length - 1]
      if (end.floor !== focus) {
        setFocus(end.floor)
        showHint(`線の先は ${WINGS[wing].building.floors[end.floor].id} にあります`)
      } else showHint(res.reason)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    justArrived.current = null
    setDrawing(wing)
    plans.updateDraft(wing, () => res.draft)
    onTarget(wing)
  }
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const wing = drawingRef.current
    const at = cellOf(e, wing ?? undefined)
    setCursor(at)
    if (wing && at?.wing === wing) plans.updateDraft(wing, (draft) => extendDraft(draft, { floor: at.floor, x: at.x, y: at.y }))
  }
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const wing = drawingRef.current
    if (wing) {
      setDrawing(null)
      // 何も描かなかったなぞりは「1つ戻す」の対象にしない
      plans.updateDraft(wing, (d) => (d.strokes[d.strokes.length - 1] === d.points.length ? { ...d, strokes: d.strokes.slice(0, -1) } : d))
    }
    if (e.pointerType !== 'mouse') setCursor(null)
  }

  /** 線を描く階の線や爆弾はくっきり、ほかの表示している階のものは少し薄く(同じ位置で重なっても見分けられるように)、表示していない階は消す */
  const alpha = (floor: number) => (floor === focus ? 1 : shownFloors[floor] ? 0.5 : 0)

  return (
    <div className="flat-overlay">
      <svg
        className="plan-svg"
        data-plan=""
        data-wings={wings.join(',')}
        viewBox={`${-PAD} ${-PAD} ${layout.width + PAD * 2} ${layout.depth + PAD * 2}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => !drawingRef.current && setCursor(null)}
      >
        {layout.items.map(({ wing, building, ox }) => {
          const walker = walkers[wing]
          const bombs = plans.bombs[wing]
          return (
            <g key={wing} transform={`translate(${ox} 0)`}>
              {cursor?.wing === wing && <rect className="plan-cursor" x={cursor.x} y={cursor.y} width={1} height={1} />}
              <DraftLine draft={plans.drafts[wing].points} building={building} alpha={alpha} focus={focus} />
              {bombs.map((b) => {
                const planted = b.plantedAt !== null && walker.done > b.plantedAt
                const here = b.floor === focus
                return (
                  <g
                    key={b.id}
                    className={`plan-bomb ${planted ? 'is-planted' : ''} ${here ? '' : 'is-elsewhere'}`}
                    transform={`translate(${b.x + 0.5} ${b.y + 0.5})`}
                    opacity={alpha(b.floor)}
                    onPointerDown={planted || !here ? undefined : (e) => onBombDown(wing, b, e)}
                  >
                    <rect x={-0.5} y={-0.5} width={1} height={1} className="plan-bomb-cell" />
                    <BombGlyph size={0.95} planted={planted} />
                    {planted && <text y={0.95} className="plan-bomb-label">SET</text>}
                  </g>
                )
              })}
              {dropTarget?.wing === wing && (
                <g className="plan-drop" transform={`translate(${dropTarget.x + 0.5} ${dropTarget.y + 0.5})`}>
                  <rect x={-0.5} y={-0.5} width={1} height={1} />
                </g>
              )}
              {drawing === wing && dwellAt && (
                <g className="plan-dwell" transform={`translate(${dwellAt.x + 0.5} ${dwellAt.y + 0.5})`}>
                  <circle r={0.62} className="plan-dwell-track" />
                  <circle r={0.62} className="plan-dwell-fill" pathLength={1} />
                  <text y={-0.95}>▲ {building.floors[dwellAt.floor + 1]?.id}へ</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      {hint && (
        <div key={hint.id} className="plan-hint">
          {hint.text}
        </div>
      )}
    </div>
  )
}

/** 下書きの道順: 光る線 + 流れる点線 + 先端の矢印。線を描く階では、階を移るところに行き先を出す */
function DraftLine({ draft, building, alpha, focus }: { draft: PlanPoint[]; building: Building; alpha(floor: number): number; focus: number }) {
  if (draft.length < 2) return null
  const c = (p: PlanPoint) => ({ x: p.x + 0.5, y: p.y + 0.5 })
  const last = draft[draft.length - 1]
  return (
    <g className="plan-draft">
      {building.floors.map((_, f) =>
        runsOn(draft, f).map((run, k) => {
          const pts = ptsAttr(run.map(c))
          return (
            <g key={`${f}-${k}`} opacity={alpha(f)}>
              <polyline className="plan-draft-glow" points={pts} />
              <polyline className="plan-draft-line" points={pts} />
              <polyline className="plan-draft-flow" points={pts} />
            </g>
          )
        }),
      )}
      <g opacity={alpha(last.floor)}>
        <DraftHead from={draft[draft.length - 2]} to={last} />
      </g>
      {draft.map((p, i) => {
        if (p.floor !== focus) return null
        const next = draft[i + 1]
        const prev = draft[i - 1]
        if (next && next.floor !== p.floor) {
          return (
            <text key={`to${i}`} className="plan-draft-badge" x={p.x + 0.5} y={p.y + 1.25}>
              {next.floor > p.floor ? '▲' : '▼'} {building.floors[next.floor].id}へ
            </text>
          )
        }
        if (prev && prev.floor !== p.floor) {
          return (
            <text key={`from${i}`} className="plan-draft-badge" x={p.x + 0.5} y={p.y - 0.35}>
              {building.floors[prev.floor].id}から
            </text>
          )
        }
        return null
      })}
    </g>
  )
}

function DraftHead({ from, to }: { from: PlanPoint; to: PlanPoint }) {
  if (from.floor !== to.floor) {
    return <circle className="plan-draft-head" cx={to.x + 0.5} cy={to.y + 0.5} r={0.22} />
  }
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return (
    <path
      className="plan-draft-head"
      transform={`translate(${to.x + 0.5} ${to.y + 0.5}) rotate(${angle})`}
      d="M0.38 0L-0.12 -0.3L-0.12 0.3Z"
    />
  )
}
