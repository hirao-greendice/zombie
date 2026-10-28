import type { Door, Pt } from './types'

// 平面図をグリッドで書き写すときの道具

/** 長方形の部屋の外周 */
export const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
]
/** 縦の壁 x 上の y〜y+1 の開口 */
export const vd = (x: number, y: number): Door => ({ a: [x, y], b: [x, y + 1] })
/** 横の壁 y 上の x〜x+1 の開口 */
export const hd = (x: number, y: number): Door => ({ a: [x, y], b: [x + 1, y] })
