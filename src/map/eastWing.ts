import type { Building, Pt, Room } from './types'
import { hd, rect, vd } from './plan'

// 東棟の平面図(messageImage_*.jpg)を 10x15 マスのグリッドで読み取ったもの。
// 1F は新しい平面図(オレンジの線 = 扉、弧 = 開く向き)。扉の開いた戸板(弧の付け根の線)は壁として扱わない。route は赤い線の道順

/** 鉄格子の独房(扉なし) */
const cells = (polys: Pt[][]): Room[] => polys.map((poly) => ({ kind: 'room', poly }))

export const EAST_WING: Building = {
  name: 'EAST WING',
  width: 10,
  depth: 15,
  // 1F 南の外壁の開口(入口)の外
  allyStart: { floor: 0, at: [1, 14] },
  floors: [
    {
      // 1F は 10x14 マス。15 行目は建物の外
      id: '1F',
      rooms: [
        { kind: 'stairs', poly: rect(2, 0, 8, 1), label: '階段' },
        ...cells([0, 2, 4, 6, 8, 10, 12].map((y) => rect(0, y, 1, y + 2))),
        ...cells([rect(9, 0, 10, 3), rect(9, 3, 10, 6), rect(9, 6, 10, 9), rect(9, 9, 10, 11), rect(7, 2, 8, 8)]),
        { kind: 'room', poly: rect(2, 2, 4, 6) },
        { kind: 'room', poly: rect(4, 2, 6, 6) },
        { kind: 'room', poly: rect(2, 6, 4, 11) },
        { kind: 'room', poly: rect(5, 9, 8, 11) },
        { kind: 'room', poly: rect(1, 12, 3, 14) },
        { kind: 'room', poly: rect(4, 12, 6, 14) },
        { kind: 'room', poly: rect(7, 12, 10, 14) },
      ],
      walls: [[[0, 14], [10, 14]]], // 南の外壁
      doors: [
        hd(2, 1, 'wn'), vd(4, 4, 'nw'), vd(6, 5, 'se'), hd(3, 6, 'es'), vd(5, 9, 'nw'), hd(7, 9, 'wn'),
        vd(4, 10, 'sw'), hd(1, 12, 'ws'), hd(4, 12, 'slide'), hd(5, 12, 'slide'), vd(7, 13, 'ne'),
        hd(1, 14), // 入口(扉なし)
      ],
      bars: [
        [[1, 0], [1, 14]],
        [[8, 2], [8, 8]],
        [[9, 0], [9, 11]],
      ],
      markers: [
        { kind: 'zombie', at: [6.5, 1.5] },
        { kind: 'zombie', at: [0.5, 3.5] },
        { kind: 'zombie', at: [5.5, 3.5] },
        { kind: 'zombie', at: [9.5, 3.5] },
        { kind: 'zombie', at: [1.5, 6.5] },
        { kind: 'zombie', at: [7.5, 6.5] },
        { kind: 'zombie', at: [8.5, 8.5] },
        { kind: 'zombie', at: [0.5, 13.5] },
      ],
    },
    {
      // 2F も 10x14 マス。階段を上りきった R1 から扉で下へ出る
      id: '2F',
      rooms: [
        { kind: 'stairs', poly: rect(2, 0, 8, 1), label: '階段' },
        { kind: 'room', poly: [[0, 0], [1, 0], [1, 2], [4, 2], [4, 5], [0, 5]] },
        { kind: 'room', poly: [[5, 2], [9, 2], [9, 0], [10, 0], [10, 5], [5, 5]] },
        { kind: 'room', poly: [[1, 6], [6, 6], [6, 8], [4, 8], [4, 11], [1, 11]] },
        { kind: 'room', poly: rect(7, 5, 10, 8) },
        { kind: 'room', poly: rect(0, 12, 3, 14) },
        { kind: 'room', poly: rect(4, 12, 6, 14) },
      ],
      walls: [
        [[5, 9], [10, 9]], [[5, 9], [5, 11]], [[5, 11], [7, 11]], [[7, 11], [7, 14]],
        [[0, 14], [10, 14]], // 南の外壁
      ],
      doors: [
        hd(2, 1, 'wn'), hd(7, 1, 'en'), // 階段の扉 / 上りきった R1 の扉
        hd(2, 2, 'ws'), hd(8, 2, 'es'), hd(3, 5, 'en'), hd(6, 5, 'wn'), hd(3, 6, 'es'), vd(7, 6, 'sw'),
        hd(8, 8, 'wn'), hd(8, 9, 'es'), vd(4, 10, 'sw'), vd(7, 11, 'ne'), hd(2, 12, 'en'),
        hd(4, 12, 'slide'), hd(5, 12, 'slide'),
      ],
      markers: [
        { kind: 'arrival', at: [7.5, 0.5], label: '▲ FROM 1F' },
        { kind: 'zombie', at: [4.5, 2.5] },
        { kind: 'zombie', at: [8.5, 4.5] },
        { kind: 'zombie', at: [5.5, 8.5] },
        { kind: 'zombie', at: [0.5, 9.5] },
      ],
      // 青: 上ってきた R1 から右側を下って S11 へ / 紫: S12 から左へ回り込み、M1 の階段へ
      route: [
        [7, 0], [7, 1], [8, 1], [8, 2], [6, 2], [6, 6], [8, 6], [8, 10],
        [8, 11], [4, 11], [4, 10], [3, 10], [3, 4], [2, 4], [2, 0],
      ],
    },
    {
      // 3F も 10x14 マス。2F から上ってくると R1 に着く。階段の両端は扉のない開口
      id: '3F',
      rooms: [
        { kind: 'stairs', poly: rect(2, 0, 8, 1), label: '階段' },
        { kind: 'room', poly: [[0, 0], [1, 0], [1, 2], [4, 2], [4, 8], [0, 8]] },
        { kind: 'room', poly: rect(5, 2, 8, 5) },
        ...cells([rect(9, 0, 10, 5)]),
        { kind: 'room', poly: rect(5, 6, 10, 8) },
        { kind: 'room', poly: [[0, 8], [2, 8], [2, 11], [3, 11], [3, 14], [0, 14]] },
        { kind: 'room', poly: [[3, 9], [6, 9], [6, 11], [4, 11], [4, 10], [3, 10]] },
        { kind: 'room', poly: rect(7, 8, 10, 11) },
        { kind: 'room', poly: rect(7, 12, 10, 14) },
        { kind: 'room', poly: rect(4, 12, 6, 14) },
      ],
      walls: [[[0, 14], [10, 14]]], // 南の外壁
      doors: [
        hd(2, 1), hd(7, 1),
        vd(9, 2), // 鉄格子の扉
        vd(8, 2, 'sw'), vd(4, 5, 'nw'), hd(6, 5, 'wn'), hd(6, 6, 'ws'), hd(0, 8, 'ws'), hd(8, 8, 'ws'),
        hd(4, 9, 'es'), vd(3, 11, 'sw'), hd(9, 11, 'wn'), hd(8, 12, 'ws'), hd(4, 12, 'slide'), hd(5, 12, 'slide'),
      ],
      bars: [[[9, 0], [9, 5]]],
      markers: [
        { kind: 'arrival', at: [7.5, 0.5], label: '▲ FROM 2F' },
        { kind: 'zombie', at: [9.5, 2.5] },
        { kind: 'zombie', at: [4.5, 3.5] },
        { kind: 'zombie', at: [1.5, 4.5] },
        { kind: 'zombie', at: [2.5, 7.5] },
        { kind: 'zombie', at: [2.5, 9.5] },
        { kind: 'zombie', at: [6.5, 11.5] },
        { kind: 'zombie', at: [1.5, 13.5] },
      ],
    },
  ],
}
