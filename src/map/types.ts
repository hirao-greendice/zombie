/** 平面図上の座標 [x, y]。1 = グリッド1マス。左上が原点、y は下向き */
export type Pt = [number, number]

export type RoomKind = 'room' | 'key' | 'stairs' | 'ev'

export interface Room {
  kind: RoomKind
  /** 外周の頂点(軸に平行な多角形) */
  poly: Pt[]
  label?: string
}

/** 壁の開口部(長さ1マス) */
export interface Door {
  a: Pt
  b: Pt
}

/** 平面図の丸・四角の印。意味が決まったら名前を付け替える */
export type MarkerKind = 'black' | 'blue' | 'red'

export interface Marker {
  kind: MarkerKind
  at: Pt
}

export interface Floor {
  id: string
  rooms: Room[]
  doors: Door[]
  /** 部屋の外周以外の間仕切り */
  walls?: [Pt, Pt][]
  markers: Marker[]
}

export interface Building {
  name: string
  /** グリッドのマス数 */
  width: number
  depth: number
  /** 下の階から順に */
  floors: Floor[]
}
