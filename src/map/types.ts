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

/**
 * black / blue / red: 平面図の丸・四角の印(意味が決まったら名前を付け替える)
 * zombie: 通路をふさぐゾンビ / arrival: 下の階から上ってきた到着地点
 */
export type MarkerKind = 'black' | 'blue' | 'red' | 'zombie' | 'arrival'

/** 階段の形。straight = 一直線、uturn = 踊り場で折り返す U 字 */
export type StairType = 'straight' | 'uturn'

export interface Marker {
  kind: MarkerKind
  at: Pt
  label?: string
  /** 指定すると、その階段の形のときだけ表示する(到着地点は階段の形で変わるため) */
  onlyFor?: StairType
}

export interface Floor {
  id: string
  rooms: Room[]
  doors: Door[]
  /** 部屋の外周以外の間仕切り */
  walls?: [Pt, Pt][]
  /** 鉄格子(平面図の破線)。壁と同じく通れないが、中が見える */
  bars?: [Pt, Pt][]
  markers: Marker[]
  /**
   * 仲間の道順(平面図の赤い線)。曲がり角のマスを通る順に並べる。
   * デモはこれをたどり、上の階があれば最後に階段から上る
   */
  route?: Pt[]
}

export interface Building {
  name: string
  /** グリッドのマス数 */
  width: number
  depth: number
  /** 下の階から順に */
  floors: Floor[]
  /** シミュレーションで仲間が最初にいる場所(floor は floors の index、at はマスの左上) */
  allyStart?: { floor: number; at: Pt }
}
