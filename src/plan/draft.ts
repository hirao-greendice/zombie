import type { StairType } from '../map/types'
import { inStairs, type Nav } from '../sim/nav'

// 平面図に指でなぞって描く、仲間への道順(まだ送っていない下書き)

/** 道順の1マス(マスの左上の座標) */
export interface PlanPoint {
  floor: number
  x: number
  y: number
}

export interface Draft {
  /** 先頭は仲間の今いるマス。となりどうしは同じ階の隣のマスか、階段での階の移動 */
  points: PlanPoint[]
  /** なぞり始めた位置(points の index)。「1つ戻す」で使う */
  strokes: number[]
}

/** 平面図に置いた爆弾。仲間がそのマスを通ると設置される */
export interface Bomb {
  id: number
  floor: number
  x: number
  y: number
  /** 設置済みなら、軌跡(trail)の何番目の点に着いたときに設置したか */
  plantedAt: number | null
}

export const samePoint = (a: PlanPoint, b: PlanPoint) => a.floor === b.floor && a.x === b.x && a.y === b.y

/** 仲間のいるマスから始まる、空の下書き */
export const emptyDraft = (start: PlanPoint): Draft => ({ points: [start], strokes: [] })

/** 1マス進める。ひとつ前のマスに戻るときは、描いた線を消す(なぞり直し) */
function step(points: PlanPoint[], p: PlanPoint) {
  if (points.length >= 2 && samePoint(points[points.length - 2], p)) points.pop()
  else points.push(p)
}

/** 線の先から、同じ階の to まで縦横にマスを埋めながら伸ばす(指が速く動いて飛んだマスも埋める) */
export function extendDraft(draft: Draft, to: PlanPoint): Draft {
  const points = [...draft.points]
  let last = points[points.length - 1]
  if (last.floor !== to.floor) return draft
  while (last.x !== to.x || last.y !== to.y) {
    const dx = to.x - last.x
    const dy = to.y - last.y
    // 離れている方の向きから先に進む
    const next =
      Math.abs(dx) >= Math.abs(dy)
        ? { ...last, x: last.x + Math.sign(dx) }
        : { ...last, y: last.y + Math.sign(dy) }
    step(points, next)
    last = next
  }
  return points.length === draft.points.length && points.every((p, i) => p === draft.points[i]) ? draft : { ...draft, points }
}

export type StrokeStart = { ok: true; draft: Draft } | { ok: false; reason: string }

/**
 * at からなぞり始める。始められるのは、
 * - 線の先(または仲間)のマスか、その隣
 * - すでに描いた線の上(そこから先を消して描き直す)
 * - 線の先が階段室にあるときの、1つ上か下の階の階段室(階段で階を移る)
 */
export function startStroke(draft: Draft, at: PlanPoint, nav: Nav, stairType: StairType): StrokeStart {
  const last = draft.points[draft.points.length - 1]
  const strokes = [...draft.strokes, draft.points.length]

  if (at.floor === last.floor && Math.abs(at.x - last.x) + Math.abs(at.y - last.y) <= 1) {
    return { ok: true, draft: extendDraft({ ...draft, strokes }, at) }
  }

  if (at.floor !== last.floor) {
    const from = nav.floors[last.floor]
    const to = nav.floors[at.floor]
    if (Math.abs(at.floor - last.floor) === 1 && to?.stairs && inStairs(to.stairs, at)) {
      if (!inStairs(from.stairs, last)) return { ok: false, reason: `先に${from.id}の階段まで線を引いてください` }
      // 上る: 上の階の到着地点へ / 降りる: 下の階の階段の入口へ(シミュレーションと同じ)
      const arrival = at.floor > last.floor ? (to.arrival[stairType] ?? to.stairs.entry) : to.stairs.entry
      const points = [...draft.points, { floor: at.floor, ...arrival }]
      return { ok: true, draft: extendDraft({ points, strokes }, at) }
    }
  }

  // 描いた線の上から描き直す(後ろから探す = 一番最近通ったところ)
  for (let i = draft.points.length - 1; i >= 0; i--) {
    if (samePoint(draft.points[i], at)) {
      return { ok: true, draft: { points: draft.points.slice(0, i + 1), strokes: [...draft.strokes.filter((s) => s <= i), i + 1] } }
    }
  }
  return { ok: false, reason: '仲間(白い丸)か、線の先からなぞってください' }
}

/** 最後のひとなぞりを取り消す */
export function undoStroke(draft: Draft): Draft {
  if (!draft.strokes.length) return draft
  const start = draft.strokes[draft.strokes.length - 1]
  return { points: draft.points.slice(0, Math.max(start, 1)), strokes: draft.strokes.slice(0, -1) }
}

const ARROW = { n: '⬆️', s: '⬇️', w: '⬅️', e: '➡️' }

/** 下書きを、1マスずつの指示(⬆️1 ➡️1 上る …)にする。指示 i を終えると points[i + 1] に着く */
export function draftOrders(points: PlanPoint[]): string[] {
  const orders: string[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a.floor !== b.floor) orders.push(b.floor > a.floor ? '上る' : '降りる')
    else if (b.x > a.x) orders.push(`${ARROW.e}1`)
    else if (b.x < a.x) orders.push(`${ARROW.w}1`)
    else orders.push(b.y > a.y ? `${ARROW.s}1` : `${ARROW.n}1`)
  }
  return orders
}

/** 下書きの長さ(マス数)と、通る階の並び */
export function draftSummary(points: PlanPoint[], floorIds: string[]) {
  let cells = 0
  const floors: number[] = [points[0].floor]
  for (let i = 1; i < points.length; i++) {
    if (points[i].floor === points[i - 1].floor) cells++
    else floors.push(points[i].floor)
  }
  return { cells, floors: floors.map((f) => floorIds[f]).join('→') }
}
