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

/** 縦か横に一直線に並んだ2マスのあいだの道(壁は気にしない。斜めの位置なら null) */
function straightPath(from: Cell, to: Cell): Dir[] | null {
  if (from.x !== to.x && from.y !== to.y) return null
  const dir: Dir = to.x > from.x ? 'e' : to.x < from.x ? 'w' : to.y > from.y ? 's' : 'n'
  return Array(Math.abs(to.x - from.x) + Math.abs(to.y - from.y)).fill(dir)
}

/**
 * デモ用の指示の列: 各階で平面図の道順(route)をたどり、上の階があれば階段の入口まで歩いて上る、を繰り返す。
 * 道順の曲がり角どうしはまっすぐ歩く。今いる場所と道順の始まり、道順の終わりと階段の入口がずれているときは、
 * そのあいだを最短の道でつなぐ(道順の無い階は階段まで最短で歩くだけ)
 */
export function demoOrders(nav: Nav, start: { floor: number; x: number; y: number }, stairType: StairType): string[] {
  const orders: string[] = []
  let floor = start.floor
  let cell: Cell = { x: start.x, y: start.y }
  while (floor < nav.floors.length) {
    const nf = nav.floors[floor]
    const above = nav.floors[floor + 1]
    const path: Dir[] = []
    /** cell から to まで歩いた道を path に足す。たどり着けなければ false */
    const walkTo = (to: Cell, straight: boolean) => {
      const dirs = (straight && straightPath(cell, to)) || shortestPath(nav, floor, cell, to, stairType)
      if (!dirs) return false
      path.push(...dirs)
      cell = to
      return true
    }
    const followed = nf.route.every((c, i) => walkTo(c, i > 0))
    const climb = followed && !!above && !!nf.stairs && walkTo(nf.stairs.entry, false)
    // 同じ向きが続くところは「⬆️3」のようにまとめる
    for (let i = 0; i < path.length; ) {
      let j = i
      while (j < path.length && path[j] === path[i]) j++
      orders.push(`${ARROW[path[i]]}${j - i}`)
      i = j
    }
    if (!climb || !above) break
    orders.push('上る')
    floor++
    cell = above.arrival[stairType] ?? above.stairs?.entry ?? cell
  }
  return orders
}
