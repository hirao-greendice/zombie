import type { StairType } from '../map/types'
import { DIRS, cellKey, stepResult, type Cell, type Dir, type Nav } from './nav'

const ARROW: Record<Dir, string> = { n: '⬆️', s: '⬇️', w: '⬅️', e: '➡️' }

/** 同じ階の中で、壁とゾンビを避けた最短の道(向きの列)。たどり着けなければ null */
function shortestPath(nav: Nav, floor: number, from: Cell, to: Cell, stairType: StairType): Dir[] | null {
  const nf = nav.floors[floor]
  const prev = new Map<string, { from: string; dir: Dir }>()
  const seen = new Set([cellKey(from)])
  const queue: Cell[] = [from]
  while (queue.length) {
    const c = queue.shift()!
    if (c.x === to.x && c.y === to.y) {
      const dirs: Dir[] = []
      for (let k = cellKey(c); k !== cellKey(from); k = prev.get(k)!.from) dirs.unshift(prev.get(k)!.dir)
      return dirs
    }
    for (const dir of Object.keys(DIRS) as Dir[]) {
      if (stepResult(nav, nf, c, dir, stairType) !== 'ok') continue
      const next = { x: c.x + DIRS[dir].dx, y: c.y + DIRS[dir].dy }
      if (seen.has(cellKey(next))) continue
      seen.add(cellKey(next))
      prev.set(cellKey(next), { from: cellKey(c), dir })
      queue.push(next)
    }
  }
  return null
}

/**
 * デモ用の指示の列: 各階で階段の入口まで最短で歩いて上の階へ、を屋上まで繰り返す。
 * マップのデータから毎回計算するので、ゾンビや間取りを変えてもそのまま使える
 */
export function demoOrders(nav: Nav, start: { floor: number; x: number; y: number }, stairType: StairType): string[] {
  const orders: string[] = []
  let floor = start.floor
  let cell: Cell = { x: start.x, y: start.y }
  while (floor < nav.floors.length) {
    const stairs = nav.floors[floor].stairs
    if (!stairs) break
    const path = shortestPath(nav, floor, cell, stairs.entry, stairType)
    if (!path) break
    // 同じ向きが続くところは「⬆️3」のようにまとめる
    for (let i = 0; i < path.length; ) {
      let j = i
      while (j < path.length && path[j] === path[i]) j++
      orders.push(`${ARROW[path[i]]}${j - i}`)
      i = j
    }
    orders.push('上る')
    floor++
    const above = nav.floors[floor]
    if (!above) break
    cell = above.arrival[stairType] ?? above.stairs?.entry ?? cell
  }
  return orders
}
