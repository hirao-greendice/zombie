import type { Door, Room } from './types'

/** 平面図上の点 + 高さ */
export type PlanVec = [x: number, y: number, h: number]

const STEPS = 12
/** 扉側に残す平らな床の奥行き */
const LANDING = 1

type Seg = (a: [number, number, number], b: [number, number, number]) => void

/**
 * 1本の階段(幅 ua〜ub、v を va → vb へ、高さ ha → hb まで steps 段)。
 * 裏側も上面を1段ぶん奥・下へずらした段々にして、裏返しても上れる見た目にする
 */
function steppedFlight(seg: Seg, ua: number, ub: number, va: number, vb: number, ha: number, hb: number, steps: number) {
  const v = (k: number) => va + ((vb - va) * k) / steps
  const h = (k: number) => ha + ((hb - ha) * k) / steps
  for (const u of [ua, ub]) {
    for (let k = 0; k < steps; k++) {
      seg([u, v(k), h(k)], [u, v(k), h(k + 1)]) // 蹴上げ
      seg([u, v(k), h(k + 1)], [u, v(k + 1), h(k + 1)]) // 踏み面
      if (k > 0) seg([u, v(k + 1), h(k - 1)], [u, v(k + 1), h(k)]) // 裏の蹴上げ
      if (k + 2 <= steps) seg([u, v(k + 1), h(k)], [u, v(k + 2), h(k)]) // 裏の踏み面
    }
    seg([u, va, ha], [u, v(1), ha]) // 上り始めの底
    seg([u, vb, h(steps - 1)], [u, vb, hb]) // 上りきった端
  }
  for (let k = 0; k < steps; k++) {
    seg([ua, v(k), h(k + 1)], [ub, v(k), h(k + 1)]) // 段鼻
    if (k + 1 < steps) seg([ua, v(k + 1), h(k)], [ub, v(k + 1), h(k)]) // 裏の段鼻
  }
}

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

  steppedFlight(seg, uMin, uMax, va, vb, 0, rise, STEPS)
  seg([uMin, vb, rise], [uMax, vb, rise])

  return segs
}

/**
 * 階段室の中に U 字(折り返し)階段の線分を作る。
 * 長手方向に2列に分け、扉に近い列を扉側から奥へ上り、奥の踊り場で折り返して
 * もう一方の列で扉側へ戻りながら rise の高さまで上る。
 */
export function uTurnStairs(room: Room, doors: Door[], rise: number): [PlanVec, PlanVec][] {
  const xs = room.poly.map((p) => p[0])
  const ys = room.poly.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]

  const vertical = y1 - y0 >= x1 - x0
  const toPlan = (u: number, v: number, h: number): PlanVec => (vertical ? [u, v, h] : [v, u, h])
  const [uMin, uMax, vMin, vMax] = vertical ? [x0, x1, y0, y1] : [y0, y1, x0, x1]

  const onEdge = (x: number, y: number) =>
    (x === x0 || x === x1 || y === y0 || y === y1) && x >= x0 && x <= x1 && y >= y0 && y <= y1
  const door = doors.find(({ a, b }) => onEdge(...a) && onEdge(...b))
  const [du, dv] = door
    ? vertical
      ? [(door.a[0] + door.b[0]) / 2, (door.a[1] + door.b[1]) / 2]
      : [(door.a[1] + door.b[1]) / 2, (door.a[0] + door.b[0]) / 2]
    : [uMax, vMin]

  // 扉に近い列から上り始め、反対の列で戻ってくる
  const uMid = (uMin + uMax) / 2
  const firstLane: [number, number] = du >= uMid ? [uMid, uMax] : [uMin, uMid]
  const secondLane: [number, number] = du >= uMid ? [uMin, uMid] : [uMid, uMax]
  const dir = dv - vMin <= vMax - dv ? 1 : -1
  const vEnd = dir === 1 ? vMax : vMin
  const flightNear = (dir === 1 ? vMin : vMax) + dir * LANDING
  const flightFar = vEnd - dir * LANDING

  const segs: [PlanVec, PlanVec][] = []
  const seg = (a: [number, number, number], b: [number, number, number]) => segs.push([toPlan(...a), toPlan(...b)])

  const flight = ([ua, ub]: [number, number], va: number, vb: number, ha: number, hb: number) =>
    steppedFlight(seg, ua, ub, va, vb, ha, hb, STEPS / 2)

  const half = rise / 2
  flight(firstLane, flightNear, flightFar, 0, half)
  flight(secondLane, flightFar, flightNear, half, rise)

  // 踊り場と、それを支える柱
  const corners: [number, number][] = [[uMin, flightFar], [uMax, flightFar], [uMax, vEnd], [uMin, vEnd]]
  corners.forEach(([u, vv], i) => {
    const [nu, nv] = corners[(i + 1) % corners.length]
    seg([u, vv, half], [nu, nv, half])
    seg([u, vv, 0], [u, vv, half])
  })

  return segs
}
