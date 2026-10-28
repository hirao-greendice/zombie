import type { Floor, Pt } from './types'

/** 線分を1マス単位の断片にして加える。'h,x,y' = y の線上の x〜x+1、'v,x,y' = x の線上の y〜y+1 */
function addEdge(pieces: Set<string>, [x1, y1]: Pt, [x2, y2]: Pt) {
  if (y1 === y2) for (let x = Math.min(x1, x2); x < Math.max(x1, x2); x++) pieces.add(`h,${x},${y1}`)
  else for (let y = Math.min(y1, y2); y < Math.max(y1, y2); y++) pieces.add(`v,${x1},${y}`)
}

/** 鉄格子を1マス単位の断片で返す */
export function barPieces(floor: Floor): Set<string> {
  const pieces = new Set<string>()
  floor.bars?.forEach(([a, b]) => addEdge(pieces, a, b))
  return pieces
}

/**
 * 通れない辺(壁 + 鉄格子)を、開口部を除いて1マス単位の断片で返す(座標は整数前提)。
 * 'h,x,y' = y の線上の x〜x+1、'v,x,y' = x の線上の y〜y+1
 */
export function wallPieces(floor: Floor, width: number, depth: number): Set<string> {
  const pieces = barPieces(floor)
  const addPoly = (poly: Pt[]) => poly.forEach((p, i) => addEdge(pieces, p, poly[(i + 1) % poly.length]))

  addPoly([[0, 0], [width, 0], [width, depth], [0, depth]])
  floor.rooms.forEach((r) => addPoly(r.poly))
  floor.walls?.forEach(([a, b]) => addEdge(pieces, a, b))
  floor.doors.forEach(({ a, b }) =>
    pieces.delete(a[1] === b[1] ? `h,${Math.min(a[0], b[0])},${a[1]}` : `v,${a[0]},${Math.min(a[1], b[1])}`),
  )
  return pieces
}

/** 1マス単位の断片を、一直線につながるものごとに線分へまとめ直す */
export function mergePieces(pieces: Set<string>): [Pt, Pt][] {
  const lines = new Map<string, number[]>()
  for (const key of pieces) {
    const [dir, x, y] = key.split(',')
    const lineKey = dir === 'h' ? `h,${y}` : `v,${x}`
    const list = lines.get(lineKey) ?? []
    list.push(Number(dir === 'h' ? x : y))
    lines.set(lineKey, list)
  }
  const segments: [Pt, Pt][] = []
  for (const [lineKey, starts] of lines) {
    const [dir, c] = lineKey.split(',')
    const at = Number(c)
    starts.sort((p, q) => p - q)
    let runStart = starts[0]
    for (let i = 0; i < starts.length; i++) {
      if (i === starts.length - 1 || starts[i + 1] !== starts[i] + 1) {
        const runEnd = starts[i] + 1
        segments.push(dir === 'h' ? [[runStart, at], [runEnd, at]] : [[at, runStart], [at, runEnd]])
        runStart = starts[i + 1]
      }
    }
  }
  return segments
}

/** 部屋の外周・建物の外壁・間仕切りから、開口部と鉄格子を除いた壁の線分を作る */
export function computeWalls(floor: Floor, width: number, depth: number): [Pt, Pt][] {
  const pieces = wallPieces(floor, width, depth)
  for (const p of barPieces(floor)) pieces.delete(p)
  return mergePieces(pieces)
}
