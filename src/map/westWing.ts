import type { Building } from './types'
import { hd, rect, vd } from './plan'

// 西棟の平面図(messageImage_*.jpg)を 10x15 マスのグリッドで読み取ったもの。
// 扉の開いた戸板(弧の付け根の線)は壁として扱わない。route は赤い線の道順

export const WEST_WING: Building = {
  name: 'WEST WING',
  width: 10,
  depth: 15,
  // 1F 右下の赤い四角(入口)の内側
  allyStart: { floor: 0, at: [9, 14] },
  floors: [
    {
      id: '1F',
      rooms: [
        { kind: 'room', poly: [[0, 0], [2, 0], [2, 3], [3, 3], [3, 4], [0, 4]] },
        { kind: 'room', poly: rect(5, 1, 8, 4), label: '2Fから' },
        { kind: 'stairs', poly: rect(8, 0, 10, 4), label: '階段' },
        { kind: 'key', poly: rect(0, 5, 3, 9), label: '①' },
        { kind: 'room', poly: rect(4, 5, 7, 9) },
        { kind: 'room', poly: rect(7, 5, 9, 14) },
        { kind: 'room', poly: rect(0, 10, 2, 13) },
        { kind: 'room', poly: rect(3, 10, 6, 13) },
        { kind: 'ev', poly: rect(0, 13, 2, 15), label: 'EV' },
      ],
      doors: [
        vd(2, 0), hd(0, 4), hd(7, 1), vd(5, 2), vd(8, 0),
        hd(0, 5), hd(2, 9), hd(5, 5), hd(6, 9), hd(7, 5), hd(8, 14),
        vd(2, 10), vd(3, 10), hd(4, 13), vd(2, 14),
        hd(9, 15), // 入口
      ],
      markers: [
        { kind: 'black', at: [4.5, 3.5] },
        { kind: 'black', at: [4.5, 7.5] },
        { kind: 'black', at: [7.5, 8.5] },
        { kind: 'black', at: [5.5, 11.5] },
        { kind: 'black', at: [0.5, 12.5] },
        { kind: 'red', at: [9.5, 15] },
      ],
      // 入口から左へ進み、①の部屋と左上の部屋を抜けて、上の廊下から階段へ
      route: [[9, 14], [2, 14], [2, 5], [0, 5], [0, 0], [8, 0]],
    },
    {
      id: '2F',
      rooms: [
        { kind: 'room', poly: rect(0, 0, 4, 4) },
        { kind: 'room', poly: rect(5, 1, 8, 4), label: '1階へ' },
        { kind: 'stairs', poly: rect(8, 0, 10, 4), label: '階段' },
        { kind: 'room', poly: rect(0, 5, 4, 7) },
        { kind: 'key', poly: [[6, 5], [10, 5], [10, 10], [8, 10], [8, 9], [6, 9]], label: '②' },
        { kind: 'key', poly: rect(1, 8, 5, 12), label: '①' },
        { kind: 'room', poly: [[8, 11], [10, 11], [10, 15], [6, 15], [6, 13], [8, 13]] },
        { kind: 'ev', poly: rect(0, 13, 2, 15), label: 'EV' },
        { kind: 'room', poly: rect(3, 13, 5, 15) },
      ],
      doors: [
        vd(4, 0), vd(4, 3), vd(5, 3), vd(8, 0),
        hd(0, 7), vd(6, 5), vd(6, 7), hd(4, 8), vd(5, 10),
        hd(9, 11), hd(7, 13), vd(2, 14), hd(4, 13),
      ],
      markers: [{ kind: 'arrival', at: [8.5, 0.5], label: '▲ FROM 1F' }],
      // 左を回って下へ、右下の部屋を抜けて①を通り、②へ入る
      route: [[7, 0], [4, 0], [4, 7], [0, 7], [0, 12], [7, 12], [7, 13], [9, 13], [9, 10], [4, 10], [4, 7], [6, 7]],
    },
    {
      id: '3F',
      rooms: [
        { kind: 'room', poly: rect(1, 1, 4, 4) },
        { kind: 'room', poly: rect(5, 1, 7, 5) },
        { kind: 'stairs', poly: rect(8, 0, 10, 4), label: '階段' },
        { kind: 'key', poly: rect(3, 6, 6, 9), label: '①' },
        { kind: 'room', poly: rect(8, 5, 10, 11) },
        { kind: 'key', poly: rect(0, 8, 2, 13), label: '②' },
        { kind: 'ev', poly: rect(0, 13, 2, 15), label: 'EV' },
        { kind: 'room', poly: rect(3, 13, 6, 15) },
        { kind: 'room', poly: rect(7, 13, 10, 15) },
      ],
      doors: [
        vd(4, 1), vd(5, 1), vd(5, 4), vd(8, 0),
        hd(4, 6), vd(3, 7), vd(6, 7), hd(4, 9), vd(8, 7),
        vd(2, 11), vd(2, 14), vd(3, 14), vd(6, 14), vd(7, 14),
      ],
      markers: [{ kind: 'arrival', at: [8.5, 0.5], label: '▲ FROM 2F' }],
      // 左の廊下を下って折り返し、①の部屋を縦に抜けて、右から回り込んで②へ
      route: [[7, 0], [0, 0], [0, 7], [2, 7], [2, 4], [4, 4], [4, 12], [9, 12], [9, 11], [1, 11]],
    },
  ],
}
