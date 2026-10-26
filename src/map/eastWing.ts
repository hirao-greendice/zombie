import type { Building, Door, Pt } from './types'

// 東棟の平面図(messageImage_*.jpg)を 10x15 マスのグリッドで読み取ったもの

const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
]
/** 縦の壁 x 上の y〜y+1 の開口 */
const vd = (x: number, y: number): Door => ({ a: [x, y], b: [x, y + 1] })
/** 横の壁 y 上の x〜x+1 の開口 */
const hd = (x: number, y: number): Door => ({ a: [x, y], b: [x + 1, y] })

export const EAST_WING: Building = {
  name: 'EAST WING',
  width: 10,
  depth: 15,
  floors: [
    {
      id: '1F',
      rooms: [
        { kind: 'stairs', poly: rect(0, 0, 2, 4), label: '階段' },
        { kind: 'key', poly: rect(3, 0, 10, 4), label: '①' },
        { kind: 'room', poly: rect(0, 5, 2, 8) },
        { kind: 'room', poly: rect(3, 5, 5, 8) },
        { kind: 'room', poly: rect(6, 5, 9, 8) },
        { kind: 'room', poly: [[2, 9], [4, 9], [4, 12], [5, 12], [5, 14], [2, 14]] },
        { kind: 'room', poly: rect(6, 9, 8, 12) },
        { kind: 'ev', poly: rect(8, 13, 10, 15), label: 'EV' },
      ],
      doors: [
        vd(2, 0), vd(3, 0), hd(9, 4),
        vd(2, 5), vd(5, 5), vd(3, 7), vd(6, 6),
        hd(2, 9), vd(5, 13), hd(6, 9), vd(8, 14),
      ],
      markers: [
        { kind: 'black', at: [9.5, 2.6] },
        { kind: 'black', at: [1.5, 8.5] },
        { kind: 'blue', at: [7.5, 8.5] },
        { kind: 'red', at: [5.5, 4] },
        { kind: 'red', at: [0.5, 15] },
      ],
    },
    {
      id: '2F',
      rooms: [
        { kind: 'stairs', poly: rect(0, 0, 2, 4), label: '階段' },
        { kind: 'room', poly: rect(2, 1, 5, 4) },
        { kind: 'room', poly: [[2, 4], [5, 4], [5, 9], [6, 9], [6, 11], [4, 11], [4, 9], [2, 9]] },
        { kind: 'key', poly: rect(1, 10, 3, 13), label: '①' },
        { kind: 'room', poly: rect(3, 12, 7, 15) },
        { kind: 'key', poly: [[6, 0], [10, 0], [10, 4], [9, 4], [9, 8], [6, 8]], label: '②' },
        { kind: 'ev', poly: rect(8, 13, 10, 15), label: 'EV' },
      ],
      doors: [
        vd(2, 0), hd(2, 1), hd(2, 4), vd(2, 8),
        hd(1, 10), hd(2, 13), hd(6, 12), vd(7, 14),
        vd(6, 0), hd(9, 4), hd(8, 8), vd(8, 14),
      ],
      markers: [{ kind: 'black', at: [8.5, 0.5] }],
    },
    {
      id: '3F',
      rooms: [
        { kind: 'stairs', poly: rect(0, 0, 2, 4), label: '階段' },
        { kind: 'room', poly: rect(3, 1, 5, 4) },
        { kind: 'room', poly: rect(6, 0, 10, 8) },
        { kind: 'room', poly: [[1, 5], [5, 5], [5, 8], [3, 8], [3, 9], [1, 9]] },
        { kind: 'room', poly: rect(4, 9, 7, 11) },
        { kind: 'room', poly: rect(0, 10, 2, 14) },
        { kind: 'room', poly: rect(3, 12, 7, 14) },
        { kind: 'ev', poly: rect(8, 13, 10, 15), label: 'EV' },
      ],
      doors: [
        vd(2, 0), vd(3, 2), vd(6, 0), hd(9, 8),
        hd(2, 5), hd(1, 9), vd(4, 9), hd(6, 11),
        vd(2, 10), vd(3, 12), hd(3, 14), vd(8, 14),
      ],
      walls: [
        [[6, 10], [6, 11]],
        [[3, 13], [4, 13]],
        [[4, 13], [4, 14]],
      ],
      markers: [
        { kind: 'black', at: [7.7, 0.5] },
        { kind: 'black', at: [7.5, 9.3] },
        { kind: 'black', at: [5.5, 10.5] },
        { kind: 'black', at: [0.5, 10.5] },
      ],
    },
  ],
}
