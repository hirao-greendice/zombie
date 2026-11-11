import type { Building } from './types'
import { hd, rect, vd } from './plan'

// 西棟の平面図(messageImage_*.jpg)を 10x15 マスのグリッドで読み取ったもの。
// 1F は新しい平面図(オレンジの線 = 扉、弧 = 開く向き)。扉の開いた戸板(弧の付け根の線)は壁として扱わない。route は赤い線の道順

export const WEST_WING: Building = {
  name: 'WEST WING',
  width: 10,
  depth: 15,
  // 1F 南の両開きの扉(入口)の外
  allyStart: { floor: 0, at: [8, 14] },
  floors: [
    {
      // 1F は 10x14 マス。15 行目は建物の外
      id: '1F',
      rooms: [
        { kind: 'stairs', poly: rect(2, 0, 8, 1), label: '階段' },
        { kind: 'room', poly: rect(7, 6, 10, 10) },
        { kind: 'room', poly: rect(0, 8, 3, 11) },
        { kind: 'room', poly: rect(3, 8, 6, 11) },
        { kind: 'room', poly: rect(7, 11, 10, 13) },
        { kind: 'room', poly: rect(0, 12, 3, 14) },
        { kind: 'room', poly: rect(4, 12, 6, 14) },
      ],
      walls: [
        [[2, 1], [2, 2]], [[2, 2], [3, 2]], [[3, 2], [3, 5]], [[3, 5], [6, 5]], [[6, 5], [6, 7]], [[0, 7], [6, 7]],
        [[9, 0], [9, 2]], [[4, 2], [9, 2]], [[4, 2], [4, 4]], [[4, 4], [7, 4]], [[7, 4], [7, 6]],
        [[0, 14], [10, 14]], // 南の外壁
      ],
      doors: [
        hd(2, 1, 'wn'), hd(6, 2, 'ws'), vd(3, 3, 'nw'), vd(6, 5, 'ne'), hd(7, 6, 'en'), hd(2, 7, 'wn'),
        hd(3, 8, 'ws'), vd(3, 9, 'nw'), hd(3, 11, 'wn'), hd(8, 10, 'wn'), hd(8, 11, 'ws'),
        hd(1, 12, 'ws'), hd(4, 12, 'slide'), hd(5, 12, 'slide'),
        hd(7, 14, 'wn'), hd(8, 14, 'en'), // 入口(両開き)
      ],
      markers: [
        { kind: 'zombie', at: [0.5, 1.5] },
        { kind: 'zombie', at: [4.5, 3.5] },
        { kind: 'zombie', at: [9.5, 5.5] },
        { kind: 'zombie', at: [1.5, 7.5] },
        { kind: 'zombie', at: [6.5, 9.5] },
        { kind: 'zombie', at: [2.5, 10.5] },
      ],
    },
    {
      // 2F も 10x14 マス。階段を上りきった H1 から下へ出られる
      id: '2F',
      rooms: [
        { kind: 'stairs', poly: rect(2, 0, 8, 1), label: '階段' },
        { kind: 'room', poly: rect(4, 2, 6, 4) },
        { kind: 'room', poly: [[7, 2], [9, 2], [9, 0], [10, 0], [10, 5], [7, 5]] },
        { kind: 'room', poly: rect(0, 5, 3, 10) },
        { kind: 'room', poly: rect(4, 5, 6, 8) },
        { kind: 'room', poly: rect(7, 5, 10, 9) },
        { kind: 'room', poly: rect(0, 11, 3, 14) },
        { kind: 'room', poly: rect(4, 12, 6, 14) },
      ],
      walls: [
        [[1, 0], [1, 2]], [[1, 2], [3, 2]], [[3, 2], [3, 5]],
        [[4, 9], [7, 9]], [[4, 9], [4, 11]], [[4, 11], [7, 11]], [[7, 11], [7, 14]],
        [[0, 14], [10, 14]], // 南の外壁
      ],
      doors: [
        hd(2, 1, 'wn'), hd(7, 1), // 階段の扉 / 上りきった H1 の下の開口
        hd(1, 2, 'ws'), hd(5, 2, 'ws'), hd(8, 2, 'ws'), hd(1, 5, 'ws'), vd(6, 5, 'nw'), hd(8, 5, 'ws'),
        vd(4, 7, 'se'), vd(7, 7, 'ne'), vd(3, 8, 'nw'), hd(8, 9, 'ws'), hd(0, 10, 'wn'), hd(0, 11, 'ws'),
        hd(4, 12, 'slide'), hd(5, 12, 'slide'),
      ],
      markers: [
        { kind: 'arrival', at: [7.5, 0.5], label: '▲ FROM 1F' },
        { kind: 'zombie', at: [0.5, 1.5] },
        { kind: 'zombie', at: [3.5, 3.5] },
        { kind: 'zombie', at: [9.5, 5.5] },
        { kind: 'zombie', at: [5.5, 9.5] },
        { kind: 'zombie', at: [9.5, 13.5] },
      ],
      // 赤: 上ってきた H1 から左の部屋を抜けて A13 へ / 紫: B13 から引き返し、J10 の爆弾の位置へ
      route: [
        [7, 0], [7, 1], [6, 1], [6, 5], [4, 5], [4, 7], [3, 7], [3, 8], [0, 8], [0, 12],
        [1, 12], [1, 11], [0, 11], [0, 8], [3, 8], [3, 7], [4, 7], [4, 5], [6, 5], [6, 7], [8, 7], [8, 9], [9, 9],
      ],
    },
    {
      // 3F も 10x14 マス。2F から上ってくると H1 に着く
      id: '3F',
      rooms: [
        { kind: 'stairs', poly: rect(2, 0, 8, 1), label: '階段' },
        { kind: 'room', poly: [[0, 0], [1, 0], [1, 2], [2, 2], [2, 4], [0, 4]] },
        { kind: 'room', poly: [[3, 2], [7, 2], [7, 5], [6, 5], [6, 8], [4, 8], [4, 3], [3, 3]] },
        { kind: 'room', poly: rect(8, 0, 10, 3) },
        { kind: 'room', poly: [[8, 3], [10, 3], [10, 10], [7, 10], [7, 6], [8, 6]] },
        { kind: 'room', poly: rect(0, 4, 3, 8) },
        { kind: 'room', poly: [[1, 9], [6, 9], [6, 11], [3, 11], [3, 14], [1, 14]] },
        { kind: 'room', poly: rect(7, 11, 10, 14) },
        { kind: 'room', poly: rect(4, 12, 6, 14) },
      ],
      walls: [[[0, 14], [10, 14]]], // 南の外壁
      doors: [
        hd(2, 1, 'wn'), hd(7, 1), // 階段の扉 / 上りきった H1 の下の開口
        vd(1, 1, 'ne'), vd(8, 1, 'ne'), hd(6, 2, 'ws'), hd(9, 3, 'wn'), hd(0, 4, 'ws'), vd(8, 4, 'ne'),
        vd(3, 5, 'nw'), vd(4, 5, 'ne'), hd(1, 8, 'wn'), hd(8, 10, 'en'), vd(1, 10, 'ne'), vd(6, 10, 'nw'),
        hd(8, 11, 'ws'), hd(4, 12, 'slide'), hd(5, 12, 'slide'),
      ],
      markers: [
        { kind: 'arrival', at: [7.5, 0.5], label: '▲ FROM 2F' },
        { kind: 'zombie', at: [9.5, 0.5] },
        { kind: 'zombie', at: [2.5, 2.5] },
        { kind: 'zombie', at: [6.5, 3.5] },
        { kind: 'zombie', at: [6.5, 7.5] },
        { kind: 'zombie', at: [3.5, 11.5] },
        { kind: 'zombie', at: [0.5, 13.5] },
        { kind: 'zombie', at: [8.5, 13.5] },
      ],
    },
  ],
}
