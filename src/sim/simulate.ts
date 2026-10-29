import type { StairType } from '../map/types'
import { DIRS, inStairs, splitArrival, stepResult, type Cell, type Dir, type Nav } from './nav'
import { parseOrders } from './orders'

/** 仲間の今いる場所 */
export interface AllyPos {
  floor: number
  x: number
  y: number
  /** 最上階の階段を上りきって屋上にいる */
  roof?: boolean
}

/** 3D 上で仲間が通る点(平面図座標、h は床からの高さ。rise = 1 で階段を上りきった高さ) */
export interface Waypoint {
  floor: number
  x: number
  y: number
  rise: number
}

export interface SimState {
  pos: AllyPos
  /** 「戻れ」用に、直前の移動を覚えておく */
  last: { dir: Dir; count: number } | null
}

/** 「壁まで進む」ときの上限 */
const MAX_RUN = 30

const center = (floor: number, c: Cell, rise = 0): Waypoint => ({ floor, x: c.x + 0.5, y: c.y + 0.5, rise })

export function initialSim(nav: Nav, start?: { floor: number; at: [number, number] }): SimState {
  if (start) return { pos: { floor: start.floor, x: start.at[0], y: start.at[1] }, last: null }
  const entry = nav.floors[0].stairs?.entry ?? { x: 0, y: 0 }
  return { pos: { floor: 0, ...entry }, last: null }
}

/**
 * 指示を実行して、新しい位置・3D で通る点・仲間からの返事を返す。
 * 状態は書き換えずに新しいものを返す。
 * strict = true のときは、指示どおりに動けなかった(壁・ゾンビ・階段が無い)ところで止まり、残りの指示は実行しない。
 * done = 最後までやりとげた指示の数 / halted = 途中で止まった
 */
export function runOrders(state: SimState, text: string, nav: Nav, stairType: StairType, strict = false) {
  const orders = parseOrders(text)
  if (orders.length === 0) {
    return { state, route: [] as Waypoint[], reply: '指示がわからない。方向(⬆️⬇️⬅️➡️)か「上る」「降りる」で頼む', done: 0, halted: false }
  }

  let { pos, last } = state
  const route: Waypoint[] = []
  const replies: string[] = []

  /** 階段を上りきった地点(階段室の中、高さ rise = 1) */
  const stairTop = (f: number): Waypoint => {
    const s = nav.floors[f].stairs!
    // 上の階の降り口が階段室の奥にあれば、そこへ直接上りきる
    const above = nav.floors[f + 1]
    const split = above && splitArrival(above, stairType)
    if (split) return center(f, split, 1)
    // それ以外は階段の形から決める: 直階段 = 奥の端 / U 字 = 入口の隣の列
    const [x0, y0, x1, y1] = s.rect
    const nearTop = s.entry.y - y0 <= y1 - 1 - s.entry.y
    if (stairType === 'straight') return { floor: f, x: (x0 + x1) / 2, y: nearTop ? y1 - 0.5 : y0 + 0.5, rise: 1 }
    return { floor: f, x: x0 + x1 - (s.entry.x + 0.5), y: s.entry.y + 0.5, rise: 1 }
  }
  /** U 字階段の踊り場(高さ rise = 0.5) */
  const landing = (f: number): Waypoint | null => {
    if (stairType !== 'uturn') return null
    const s = nav.floors[f].stairs!
    const [x0, y0, x1, y1] = s.rect
    const nearTop = s.entry.y - y0 <= y1 - 1 - s.entry.y
    return { floor: f, x: (x0 + x1) / 2, y: nearTop ? y1 - 0.5 : y0 + 0.5, rise: 0.5 }
  }

  /** 指示どおりに動けたら true(数の指定が無いときは、壁まで進めば true) */
  const move = (dir: Dir, count: number | null): boolean => {
    const { dx, dy, name } = DIRS[dir]
    if (pos.roof) {
      replies.push('ここは屋上だ。これ以上は動けない')
      return false
    }
    const nf = nav.floors[pos.floor]
    let cell: Cell = { x: pos.x, y: pos.y }
    let moved = 0
    let stop: 'ok' | 'wall' | 'zombie' = 'ok'
    const limit = count ?? MAX_RUN
    while (moved < limit) {
      stop = stepResult(nav, nf, cell, dir, stairType)
      if (stop !== 'ok') break
      cell = { x: cell.x + dx, y: cell.y + dy }
      moved++
    }
    if (moved > 0) {
      route.push(center(pos.floor, cell))
      pos = { floor: pos.floor, ...cell }
      last = { dir, count: moved }
    }
    if (stop === 'zombie') {
      replies.push(moved > 0 ? `${name}へ${moved}マス進んだ…前方にゾンビ!これ以上は無理だ` : `${name}にゾンビがいる!進めない`)
    } else if (stop === 'wall' && count === null) {
      replies.push(moved > 0 ? `${name}へ${moved}マス進んだ。行き止まりだ` : `${name}は壁だ。進めない`)
    } else if (stop === 'wall') {
      replies.push(moved > 0 ? `${name}へ${moved}マスで壁に当たった` : `${name}は壁だ。進めない`)
    } else {
      replies.push(`${name}へ${moved}マス進んだ`)
    }
    return stop !== 'zombie' && (count === null || moved === count)
  }

  /** 1つの指示を実行する。指示どおりに動けたら true */
  const exec = (order: (typeof orders)[number]): boolean => {
    if (order.kind === 'move') return move(order.dir, order.count)
    if (order.kind === 'back') {
      if (last) return move(DIRS[last.dir].opposite, last.count)
      replies.push('戻る場所がない')
      return false
    }
    if (order.kind === 'wait') {
      replies.push('了解、ここで待機する')
      return true
    }
    if (order.kind === 'up') {
      const nf = nav.floors[pos.floor]
      if (pos.roof) replies.push('もう屋上だ')
      else if (!inStairs(nf.stairs, pos)) replies.push('近くに階段がない。階段室まで誘導してくれ')
      else if (splitArrival(nf, stairType)?.y === pos.y) {
        replies.push('ここは上ってきた階段の降り口だ。上りの階段には扉側から入る必要がある')
      } else {
        const s = nf.stairs!
        route.push(center(pos.floor, s.entry))
        const l = landing(pos.floor)
        if (l) route.push(l)
        const top = stairTop(pos.floor)
        route.push(top)
        const above = pos.floor + 1
        if (above < nav.floors.length) {
          const arrival = nav.floors[above].arrival[stairType] ?? nav.floors[above].stairs?.entry ?? { x: 0, y: 0 }
          route.push(center(above, arrival))
          pos = { floor: above, ...arrival }
          replies.push(`階段を上った。${nav.floors[above].id}に着いた`)
        } else {
          pos = { ...pos, roof: true }
          replies.push('屋上に出た!')
        }
        last = null
        return true
      }
      return false
    }
    // 降りる
    const nf = nav.floors[pos.floor]
    last = null
    if (pos.roof) {
      const s = nf.stairs!
      route.push(center(pos.floor, s.entry))
      pos = { floor: pos.floor, ...s.entry }
      replies.push(`屋上から${nf.id}に降りた`)
      return true
    }
    if (pos.floor === 0) replies.push('これより下の階はない')
    else if (!inStairs(nf.stairs, pos)) replies.push('近くに階段がない。階段室まで誘導してくれ')
    else {
      const below = pos.floor - 1
      const s = nav.floors[below].stairs!
      route.push(stairTop(below))
      const l = landing(below)
      if (l) route.push(l)
      route.push(center(below, s.entry))
      pos = { floor: below, ...s.entry }
      replies.push(`階段を降りた。${nav.floors[below].id}に着いた`)
      return true
    }
    return false
  }

  let done = 0
  let halted = false
  for (const order of orders) {
    if (!exec(order) && strict) {
      halted = true
      break
    }
    done++
  }

  return { state: { pos, last }, route, reply: replies.join(' → '), done, halted }
}
