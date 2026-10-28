import { WEST_WING } from './westWing'
import { EAST_WING } from './eastWing'
import type { Building } from './types'

/** 切り替えて表示できる棟(ボタンの並び順) */
export const WINGS = {
  west: { label: 'WEST', building: WEST_WING },
  east: { label: 'EAST', building: EAST_WING },
}

export type WingId = keyof typeof WINGS

/** マップの表示: 片方の棟だけ / 両方を横に並べる */
export type WingView = WingId | 'both'

/** 表示に含まれる棟(左から順) */
export const WINGS_IN: Record<WingView, WingId[]> = {
  west: ['west'],
  east: ['east'],
  both: ['west', 'east'],
}

/** 表示ごとの建物の配列(3D を作り直さないように、毎回同じ配列を使う) */
export const BUILDINGS_IN = Object.fromEntries(
  Object.entries(WINGS_IN).map(([view, ids]) => [view, ids.map((id) => WINGS[id].building)]),
) as Record<WingView, Building[]>
