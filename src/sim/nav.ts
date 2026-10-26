import { wallPieces } from '../map/walls'
import type { Building, Floor, StairType } from '../map/types'

// シミュレーション用に、平面図を「1マス = 1区画」の通れる/通れないに置き換えたもの

export type Dir = 'n' | 's' | 'w' | 'e'

/** ⬆️ = 平面図の上 = 北 */
export const DIRS: Record<Dir, { dx: number; dy: number; name: string; opposite: Dir }> = {
  n: { dx: 0, dy: -1, name: '北', opposite: 's' },
  s: { dx: 0, dy: 1, name: '南', opposite: 'n' },
  w: { dx: -1, dy: 0, name: '西', opposite: 'e' },
  e: { dx: 1, dy: 0, name: '東', opposite: 'w' },
}

/** マス(左上の座標) */
export interface Cell {
  x: number
  y: number
}

export interface StairsInfo {
  rect: [x0: number, y0: number, x1: number, y1: number]
  /** 階段室の中で、扉に接しているマス(上り始める場所) */
  entry: Cell
}

export interface NavFloor {
  id: string
  walls: Set<string>
  zombies: Set<string>
  stairs: StairsInfo | null
  /** 下の階から上ってきたときに出るマス(階段の形ごと) */
  arrival: Partial<Record<StairType, Cell>>
}

export interface Nav {
  width: number
  depth: number
  floors: NavFloor[]
}

export const cellKey = (c: Cell) => `${c.x},${c.y}`
const toCell = ([x, y]: [number, number]): Cell => ({ x: Math.floor(x), y: Math.floor(y) })

function stairsOf(floor: Floor): StairsInfo | null {
  const room = floor.rooms.find((r) => r.kind === 'stairs')
  if (!room) return null
  const xs = room.poly.map((p) => p[0])
  const ys = room.poly.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const onEdge = (x: number, y: number) =>
    (x === x0 || x === x1 || y === y0 || y === y1) && x >= x0 && x <= x1 && y >= y0 && y <= y1
  const door = floor.doors.find(({ a, b }) => onEdge(...a) && onEdge(...b))
  let entry: Cell = { x: x0, y: y0 }
  if (door) {
    if (door.a[0] === door.b[0]) {
      const x = door.a[0]
      entry = { x: x === x1 ? x - 1 : x, y: Math.min(door.a[1], door.b[1]) }
    } else {
      const y = door.a[1]
      entry = { x: Math.min(door.a[0], door.b[0]), y: y === y1 ? y - 1 : y }
    }
  }
  return { rect: [x0, y0, x1, y1], entry }
}

export function buildNav(building: Building): Nav {
  return {
    width: building.width,
    depth: building.depth,
    floors: building.floors.map((f) => {
      const arrival: Partial<Record<StairType, Cell>> = {}
      for (const m of f.markers) {
        if (m.kind !== 'arrival') continue
        if (m.onlyFor) arrival[m.onlyFor] = toCell(m.at)
        else arrival.straight = arrival.uturn = toCell(m.at)
      }
      return {
        id: f.id,
        walls: wallPieces(f, building.width, building.depth),
        zombies: new Set(f.markers.filter((m) => m.kind === 'zombie').map((m) => cellKey(toCell(m.at)))),
        stairs: stairsOf(f),
        arrival,
      }
    }),
  }
}

export const inStairs = (s: StairsInfo | null, c: Cell) =>
  !!s && c.x >= s.rect[0] && c.x < s.rect[2] && c.y >= s.rect[1] && c.y < s.rect[3]

/** 隣のマスへ動けるか */
export function stepResult(nav: Nav, nf: NavFloor, c: Cell, dir: Dir, stairType: StairType): 'ok' | 'wall' | 'zombie' {
  const { dx, dy } = DIRS[dir]
  const next = { x: c.x + dx, y: c.y + dy }
  if (next.x < 0 || next.y < 0 || next.x >= nav.width || next.y >= nav.depth) return 'wall'
  const edge =
    dx === 1 ? `v,${c.x + 1},${c.y}` : dx === -1 ? `v,${c.x},${c.y}` : dy === 1 ? `h,${c.x},${c.y + 1}` : `h,${c.x},${c.y}`
  if (nf.walls.has(edge)) return 'wall'
  // 直階段: 上ってきた降り口(階段室の奥)と、上りの階段がある側は階段でへだてられている
  const arr = nf.arrival.straight
  if (stairType === 'straight' && arr && dy !== 0 && inStairs(nf.stairs, c) && inStairs(nf.stairs, next)) {
    if ((c.y === arr.y) !== (next.y === arr.y)) return 'wall'
  }
  if (nf.zombies.has(cellKey(next))) return 'zombie'
  return 'ok'
}
