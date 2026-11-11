import type { Door, Pt } from './types'

// 平面図をグリッドで書き写すときの道具

/** 長方形の部屋の外周 */
export const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
]

/**
 * 扉の開き方。開き戸は「吊り元の端 + 開く向き」の2文字(n/s/w/e)、引き戸は 'slide'。
 * 縦の扉: 'nw' = 北の端が吊り元で西へ開く / 横の扉: 'en' = 東の端が吊り元で北へ開く
 */
type VSwing = 'nw' | 'ne' | 'sw' | 'se' | 'slide'
type HSwing = 'wn' | 'ws' | 'en' | 'es' | 'slide'

const STEP: Record<string, Pt> = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }

function withSwing(door: Door, swing?: VSwing | HSwing): Door {
  if (!swing) return door
  if (swing === 'slide') return { ...door, slide: true }
  // a は北(縦)/西(横)の端、b は南/東の端
  const hinge = swing[0] === 'n' || swing[0] === 'w' ? door.a : door.b
  const [dx, dy] = STEP[swing[1]]
  return { ...door, swing: { hinge, open: [hinge[0] + dx, hinge[1] + dy] } }
}

/** 縦の壁 x 上の y〜y+1 の開口 */
export const vd = (x: number, y: number, swing?: VSwing): Door => withSwing({ a: [x, y], b: [x, y + 1] }, swing)
/** 横の壁 y 上の x〜x+1 の開口 */
export const hd = (x: number, y: number, swing?: HSwing): Door => withSwing({ a: [x, y], b: [x + 1, y] }, swing)
