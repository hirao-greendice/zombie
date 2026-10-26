import type { Door, Room } from './types'

/** 平面図上の点 + 高さ */
export type PlanVec = [x: number, y: number, h: number]

const STEPS = 12
/** 手すりの高さ(rise に対する割合) */
const RAIL_RATIO = 0.25
/** 扉側に残す平らな床の奥行き */
const LANDING = 1

/**
 * 階段室の中に直階段(一直線に上る階段)の線分を作る。
 * 長手方向に、扉に近い端から反対の端へ向かって、部屋の幅いっぱいで rise の高さまで上る。
 */
export function straightStairs(room: Room, doors: Door[], rise: number): [PlanVec, PlanVec][] {
  const xs = room.poly.map((p) => p[0])
  const ys = room.poly.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]

  // u = 短手(幅)、v = 長手(上っていく方向)
  const vertical = y1 - y0 >= x1 - x0
  const toPlan = (u: number, v: number, h: number): PlanVec => (vertical ? [u, v, h] : [v, u, h])
  const [uMin, uMax, vMin, vMax] = vertical ? [x0, x1, y0, y1] : [y0, y1, x0, x1]

  // 階段室に接している扉の位置から、上り始める端を決める
  const onEdge = (x: number, y: number) =>
    (x === x0 || x === x1 || y === y0 || y === y1) && x >= x0 && x <= x1 && y >= y0 && y <= y1
  const door = doors.find(({ a, b }) => onEdge(...a) && onEdge(...b))
  const dv = door ? (vertical ? (door.a[1] + door.b[1]) / 2 : (door.a[0] + door.b[0]) / 2) : vMin
  const dir = dv - vMin <= vMax - dv ? 1 : -1
  const va = (dir === 1 ? vMin : vMax) + dir * LANDING
  const vb = dir === 1 ? vMax : vMin

  const segs: [PlanVec, PlanVec][] = []
  const seg = (a: [number, number, number], b: [number, number, number]) => segs.push([toPlan(...a), toPlan(...b)])

  const v = (k: number) => va + ((vb - va) * k) / STEPS
  const h = (k: number) => (rise * k) / STEPS
  for (const u of [uMin, uMax]) {
    for (let k = 0; k < STEPS; k++) {
      seg([u, v(k), h(k)], [u, v(k), h(k + 1)]) // 蹴上げ
      seg([u, v(k), h(k + 1)], [u, v(k + 1), h(k + 1)]) // 踏み面
    }
    seg([u, va, 0], [u, vb, rise - rise / STEPS]) // 側桁
    seg([u, vb, 0], [u, vb, rise]) // 上り口の縦線
  }
  for (let k = 0; k < STEPS; k++) seg([uMin, v(k), h(k + 1)], [uMax, v(k), h(k + 1)]) // 段鼻
  seg([uMin, vb, rise], [uMax, vb, rise])

  // 手すり(両側)
  const rail = rise * RAIL_RATIO
  for (const u of [uMin, uMax]) {
    seg([u, va, rail], [u, vb, rise + rail])
    seg([u, va, 0], [u, va, rail])
  }

  return segs
}
