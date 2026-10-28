import type { Building, Marker } from './types'
import { hd, rect, vd } from './plan'

// 東棟の平面図(messageImage_*.jpg)を 10x15 マスのグリッドで読み取ったもの。
// 扉の開いた戸板(弧の付け根の線)は壁として扱わない。route は赤い線の道順

/** 縦一列に並んだ黒丸 */
const dots = (x: number, ys: number[]): Marker[] => ys.map((y) => ({ kind: 'black', at: [x, y] }))

export const EAST_WING: Building = {
  name: 'EAST WING',
  width: 10,
  depth: 15,
  // 1F 左下の赤い四角(入口)の内側
  allyStart: { floor: 0, at: [0, 14] },
  floors: [
    {
      id: '1F',
      rooms: [
        { kind: 'stairs', poly: rect(0, 0, 2, 4), label: '階段' },
        { kind: 'key', poly: rect(3, 0, 6, 4), label: '①' },
        // 鉄格子の独房(黒丸の列)
        { kind: 'room', poly: rect(6, 0, 7, 8) },
        { kind: 'room', poly: rect(7, 0, 8, 8) },
        { kind: 'room', poly: rect(9, 0, 10, 13) },
        { kind: 'room', poly: rect(0, 5, 5, 8) },
        { kind: 'room', poly: rect(1, 9, 5, 14) },
        { kind: 'room', poly: rect(6, 9, 8, 12) },
        { kind: 'ev', poly: rect(8, 13, 10, 15), label: 'EV' },
      ],
      doors: [
        vd(2, 0), vd(3, 0), hd(4, 4), hd(5, 4),
        hd(4, 5), hd(0, 8), hd(1, 9), vd(5, 12), hd(7, 9), vd(8, 14),
        hd(0, 15), // 入口
      ],
      bars: [
        [[6, 0], [6, 8]],
        [[8, 0], [8, 8]],
        [[9, 0], [9, 13]],
      ],
      markers: [
        ...dots(6.5, [1.5, 3.5, 5.5, 7.5]),
        ...dots(7.5, [0.5, 2.5, 4.5, 6.5]),
        ...dots(9.5, [0.5, 2.5, 4.5, 6.5, 8.5, 10.5, 12.5]),
        { kind: 'black', at: [1.5, 6.5] },
        { kind: 'black', at: [3.5, 8.5] },
        { kind: 'blue', at: [7.5, 8.5] },
        { kind: 'red', at: [5.5, 4] },
        { kind: 'red', at: [0.5, 15] },
      ],
      // 入口から右へ回り込み、赤い四角の扉から①の部屋を抜けて階段へ
      route: [[0, 14], [7, 14], [7, 12], [5, 12], [5, 0], [1, 0]],
    },
    {
      id: '2F',
      rooms: [
        { kind: 'stairs', poly: rect(0, 0, 2, 4), label: '階段' },
        { kind: 'room', poly: [[2, 1], [5, 1], [5, 9], [3, 9], [3, 8], [2, 8]] },
        { kind: 'key', poly: [[6, 0], [10, 0], [10, 4], [9, 4], [9, 8], [6, 8]], label: '②' },
        { kind: 'key', poly: rect(1, 10, 3, 13), label: '①' },
        { kind: 'room', poly: rect(3, 12, 7, 15) },
        { kind: 'ev', poly: rect(8, 13, 10, 15), label: 'EV' },
      ],
      doors: [
        vd(2, 0), hd(2, 1), vd(2, 7), hd(3, 9),
        vd(6, 0), hd(9, 4), hd(8, 8),
        hd(1, 10), hd(2, 13), hd(6, 12), vd(7, 14), vd(8, 14),
      ],
      markers: [
        { kind: 'black', at: [7.5, 0.5] },
        { kind: 'arrival', at: [1.5, 0.5], label: '▲ FROM 1F' },
      ],
      // 西側を下って①、右側から②を回って階段へ戻る
      route: [
        [2, 0], [2, 7], [1, 7], [1, 4], [0, 4], [0, 14], [2, 14], [2, 12], [1, 12], [1, 9],
        [9, 9], [9, 3], [6, 3], [6, 7], [8, 7], [8, 8], [5, 8], [5, 0], [1, 0],
      ],
    },
    {
      id: '3F',
      rooms: [
        { kind: 'stairs', poly: rect(0, 0, 2, 4), label: '階段' },
        { kind: 'room', poly: rect(3, 1, 5, 8) },
        // 鉄格子の独房
        { kind: 'room', poly: rect(6, 0, 7, 8) },
        { kind: 'key', poly: rect(7, 4, 9, 8), label: '①' },
        { kind: 'room', poly: rect(0, 5, 2, 9) },
        { kind: 'room', poly: rect(6, 9, 8, 11) },
        { kind: 'room', poly: [[0, 10], [2, 10], [2, 12], [7, 12], [7, 14], [0, 14]] },
        { kind: 'ev', poly: rect(8, 13, 10, 15), label: 'EV' },
      ],
      doors: [
        vd(2, 0), vd(3, 4), vd(7, 1), hd(7, 4), hd(8, 8),
        vd(2, 8), hd(7, 11), hd(2, 12), hd(6, 14), vd(8, 14),
      ],
      bars: [[[6, 0], [6, 8]]],
      markers: [
        { kind: 'black', at: [6.5, 1.5] },
        { kind: 'black', at: [1.5, 10.5] },
        { kind: 'arrival', at: [1.5, 0.5], label: '▲ FROM 2F' },
      ],
      // 右側を大きく回って①を通り、左下の部屋を抜けて EV へ
      route: [
        [2, 0], [5, 0], [5, 11], [9, 11], [9, 0], [7, 0], [7, 7], [8, 7], [8, 8],
        [2, 8], [2, 12], [6, 12], [6, 14], [8, 14],
      ],
    },
  ],
}
