import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { barPieces, computeWalls, mergePieces } from './walls'
import { straightStairs, uTurnStairs } from './stairs'
import type { Floor, MarkerKind, RoomKind, StairType } from './types'

export const WALL_HEIGHT = 2
// 離して表示するときの階の間隔(壁の高さ + すき間 3.5)
export const FLOOR_GAP = 5.5
/** 鉄格子の縦棒の間隔 */
const BAR_STEP = 0.25

// 役割ごとに色を分ける: 壁 = 緑 / 出入口・番号の部屋 = 黄 / 階段・EV = 青 / ゾンビ = 赤 / 仲間 = 白
export const COLORS = {
  line: 0x3dffa2,
  grid: 0x1a5a40,
  door: 0xffc23d,
  key: 0xffc23d,
  stairs: 0x4aa8ff,
  danger: 0xff3b3b,
  neutral: 0x8a9a94,
  ally: 0xffffff,
  slab: 0x010604,
}

/** 部屋の床の色(room は階の色を使う) */
const ROOM_FILL: Record<Exclude<RoomKind, 'room'>, number> = {
  key: COLORS.key,
  stairs: COLORS.stairs,
  ev: COLORS.stairs,
}

export const MARKER_COLOR: Record<MarkerKind, number> = {
  black: COLORS.neutral,
  blue: COLORS.stairs,
  red: COLORS.danger,
  zombie: COLORS.danger,
  arrival: COLORS.stairs,
}

/** 前に腕を突き出したゾンビの線画(足元が原点、+z が正面) */
const ZOMBIE_FIGURE: [Vec, Vec][] = [
  [[0, 0.38, 0], [0, 0.64, 0.06]], // 胴(前かがみ)
  [[0, 0.38, 0], [-0.09, 0, 0.03]], // 脚
  [[0, 0.38, 0], [0.08, 0, -0.06]],
  [[-0.11, 0.6, 0.05], [0.11, 0.6, 0.05]], // 肩
  [[-0.11, 0.6, 0.05], [-0.1, 0.57, 0.34]], // 腕
  [[0.11, 0.6, 0.05], [0.12, 0.55, 0.32]],
]

/** 階ごとの透明度をまとめて上げ下げするための登録簿 */
export interface FloorHandle {
  group: THREE.Group
  /** 1 = 通常表示、0 で非表示 */
  setVisibility(v: number): void
  /** 毎フレーム呼ぶ(マーカーのアニメーション) */
  tick(t: number): void
  /** 階段の形(と、それに合わせた到着地点)の表示を切り替える */
  setStairType(type: StairType): void
  lineMaterials: LineMaterial[]
}

type Vec = [number, number, number]

/** color: この階の壁・床の色(floorColors.ts) */
export function buildFloor(floor: Floor, width: number, depth: number, color: number = COLORS.line): FloorHandle {
  const gridColor = new THREE.Color(color).multiplyScalar(0.45).getHex()
  const group = new THREE.Group()
  const fades: { mat: { opacity: number }; base: number }[] = []
  const labels: HTMLElement[] = []
  const lineMaterials: LineMaterial[] = []
  const animated: ((t: number) => void)[] = []

  // 平面図 (x, y) → 3D (x, 高さ, z)。建物の中心を原点に
  const P = (x: number, y: number, h = 0): Vec => [x - width / 2, h, y - depth / 2]

  const fade = <M extends { opacity: number }>(mat: M, base: number) => {
    mat.opacity = base
    fades.push({ mat, base })
    return mat
  }

  const lines = (segs: [Vec, Vec][], color: number, linewidth: number, opacity = 1, parent: THREE.Object3D = group) => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(segs.flat(2))
    const mat = new LineMaterial({ color, linewidth, transparent: true, depthWrite: false })
    lineMaterials.push(mat)
    const obj = new LineSegments2(geo, fade(mat, opacity))
    parent.add(obj)
    return obj
  }

  const fillMat = (color: number, opacity: number) =>
    fade(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
      opacity,
    )

  const label = (text: string, className: string, pos: Vec, parent: THREE.Object3D = group) => {
    const el = document.createElement('div')
    el.className = className
    el.textContent = text
    labels.push(el)
    const obj = new CSS2DObject(el)
    obj.position.set(...pos)
    parent.add(obj)
  }

  // --- 床: 外周とグリッド ---
  const grid: [Vec, Vec][] = []
  for (let x = 1; x < width; x++) grid.push([P(x, 0), P(x, depth)])
  for (let y = 1; y < depth; y++) grid.push([P(0, y), P(width, y)])
  lines(grid, gridColor, 1, 0.18)

  // 暗い床板。下の階の線が透けて重なりすぎないように、手前の階で少し隠す
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    fade(new THREE.MeshBasicMaterial({ color: COLORS.slab, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0.7),
  )
  slab.rotation.x = -Math.PI / 2
  slab.position.y = -0.02
  slab.userData.slab = true
  group.add(slab)

  // --- 部屋の床塗り ---
  for (const room of floor.rooms) {
    const shape = new THREE.Shape(room.poly.map(([x, y]) => new THREE.Vector2(x - width / 2, -(y - depth / 2))))
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMat(room.kind === 'room' ? color : ROOM_FILL[room.kind], room.kind === 'room' ? 0.09 : 0.16))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.01
    group.add(mesh)

    if (room.label) {
      const xs = room.poly.map((p) => p[0])
      const ys = room.poly.map((p) => p[1])
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      label(room.label, `map-label map-label--${room.kind}`, P(cx, cy, 0.3))
    }
  }

  // --- 階段: 直階段 / U 字を両方作っておき、表示を切り替える(その階の壁の高さに収める。最上階は屋上へ) ---
  const stairRooms = floor.rooms.filter((r) => r.kind === 'stairs')
  const byStairType: Record<StairType, THREE.Object3D[]> = { straight: [], uturn: [] }
  if (stairRooms.length) {
    const make = (fn: typeof straightStairs) =>
      lines(
        stairRooms.flatMap((r) => fn(r, floor.doors, WALL_HEIGHT)).map(([a, b]): [Vec, Vec] => [P(...a), P(...b)]),
        COLORS.stairs,
        1.4,
      )
    byStairType.straight.push(make(straightStairs))
    byStairType.uturn.push(make(uTurnStairs))
  }

  // --- 壁: 上辺は明るく(上から見て間取りが読める)、下辺と縦線は控えめに + 半透明の面 ---
  const wallTops: [Vec, Vec][] = []
  const wallFrames: [Vec, Vec][] = []
  const wallMat = fillMat(color, 0.03)
  for (const [[x1, y1], [x2, y2]] of computeWalls(floor, width, depth)) {
    wallTops.push([P(x1, y1, WALL_HEIGHT), P(x2, y2, WALL_HEIGHT)])
    wallFrames.push(
      [P(x1, y1), P(x2, y2)],
      [P(x1, y1), P(x1, y1, WALL_HEIGHT)],
      [P(x2, y2), P(x2, y2, WALL_HEIGHT)],
    )
    const len = Math.hypot(x2 - x1, y2 - y1)
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_HEIGHT), wallMat)
    const [mx, , mz] = P((x1 + x2) / 2, (y1 + y2) / 2)
    plane.position.set(mx, WALL_HEIGHT / 2, mz)
    if (x1 === x2) plane.rotation.y = Math.PI / 2
    group.add(plane)
  }
  lines(wallFrames, color, 1.2, 0.35)
  lines(wallTops, color, 2.6)

  // --- 鉄格子: 上下の横棒と、等間隔の縦棒(面は張らず、中が透けて見える) ---
  const barSegs: [Vec, Vec][] = []
  for (const [[x1, y1], [x2, y2]] of mergePieces(barPieces(floor))) {
    barSegs.push([P(x1, y1, 0.02), P(x2, y2, 0.02)], [P(x1, y1, WALL_HEIGHT), P(x2, y2, WALL_HEIGHT)])
    const len = Math.hypot(x2 - x1, y2 - y1)
    const n = Math.round(len / BAR_STEP)
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n
      const y = y1 + ((y2 - y1) * i) / n
      barSegs.push([P(x, y), P(x, y, WALL_HEIGHT)])
    }
  }
  if (barSegs.length) lines(barSegs, color, 1.4, 0.8)

  // --- ドア: 開口部に門型の枠 ---
  const doorSegs: [Vec, Vec][] = []
  const dh = WALL_HEIGHT * 0.7
  for (const { a, b } of floor.doors) {
    doorSegs.push(
      [P(...a), P(...a, dh)],
      [P(...a, dh), P(...b, dh)],
      [P(...b, dh), P(...b)],
      [P(...a, 0.02), P(...b, 0.02)],
    )
  }
  lines(doorSegs, COLORS.door, 2)

  // --- マーカー ---
  /** 床に広がって消える波紋 */
  const pulseRing = (parent: THREE.Object3D, color: number, phase: number, radius = 0.3) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.06, 40), fillMat(color, 0.9))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    parent.add(ring)
    const ringMat = ring.material as THREE.MeshBasicMaterial
    const ringFade = fades[fades.length - 1]
    animated.push((t) => {
      const p = ((t * 0.8 + phase) % 1 + 1) % 1
      ring.scale.setScalar(1 + p * 1.6)
      ringMat.opacity = ringFade.base * (1 - p) * currentVisibility
    })
  }

  for (const m of floor.markers) {
    const color = MARKER_COLOR[m.kind]
    const [x, , z] = P(...m.at)
    const marker = new THREE.Group()
    marker.position.set(x, 0, z)
    group.add(marker)
    if (m.onlyFor) byStairType[m.onlyFor].push(marker)
    const phase = Math.random() * Math.PI * 2

    if (m.kind === 'zombie') {
      // 床の危険エリア: 斜線入りの赤い四角
      const s = 0.45
      const zone: [Vec, Vec][] = [
        [[-s, 0.02, -s], [s, 0.02, -s]],
        [[s, 0.02, -s], [s, 0.02, s]],
        [[s, 0.02, s], [-s, 0.02, s]],
        [[-s, 0.02, s], [-s, 0.02, -s]],
      ]
      // x + z = c の斜線を四角の中に等間隔で
      for (let i = 1; i < 6; i++) {
        const c = -2 * s + (4 * s * i) / 6
        zone.push(c <= 0 ? [[-s, 0.02, c + s], [c + s, 0.02, -s]] : [[c - s, 0.02, s], [s, 0.02, c - s]])
      }
      const zoneMat = lines(zone, color, 1.6, 1, marker).material
      const zoneFade = fades[fades.length - 1]

      const figure = new THREE.Group()
      figure.rotation.y = phase
      figure.scale.setScalar(1.4)
      marker.add(figure)
      lines(ZOMBIE_FIGURE, color, 2.6, 1, figure)
      const head = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.08)),
        fade(new THREE.LineBasicMaterial({ color, transparent: true }), 1),
      )
      head.position.set(0, 0.72, 0.1)
      figure.add(head)

      pulseRing(marker, color, phase, 0.35)
      animated.push((t) => {
        // ふらふら揺れながら向きを変える
        figure.rotation.z = Math.sin(t * 1.6 + phase) * 0.08
        figure.rotation.y = phase + Math.sin(t * 0.4 + phase) * 0.6
        zoneMat.opacity = zoneFade.base * currentVisibility * (0.55 + 0.45 * Math.sin(t * 4 + phase))
      })
      continue
    }

    if (m.kind === 'arrival') {
      // 上ってきた地点: 上向きの矢印が昇っていく
      const arrow = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.ConeGeometry(0.16, 0.26, 4)),
        fade(new THREE.LineBasicMaterial({ color, transparent: true }), 1),
      )
      marker.add(arrow)
      pulseRing(marker, color, phase)
      animated.push((t) => {
        const p = (t * 0.6) % 1
        arrow.position.y = 0.2 + p * WALL_HEIGHT * 0.8
        arrow.rotation.y = t
      })
      if (m.label) label(m.label, 'map-label map-label--arrival', [0, WALL_HEIGHT + 0.3, 0], marker)
      continue
    }

    if (m.kind === 'red') {
      const box = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(0.35, 0.35, 0.35)),
        fade(new THREE.LineBasicMaterial({ color, transparent: true }), 1),
      )
      box.position.y = WALL_HEIGHT * 0.5
      marker.add(box)
      animated.push((t) => (box.rotation.y = t * 1.5))
      continue
    }

    const gem = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.28)),
      fade(new THREE.LineBasicMaterial({ color, transparent: true }), 1),
    )
    gem.position.y = WALL_HEIGHT + 0.5
    marker.add(gem)

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, WALL_HEIGHT + 0.5, 6), fillMat(color, 0.6))
    beam.position.y = (WALL_HEIGHT + 0.5) / 2
    marker.add(beam)

    pulseRing(marker, color, phase)
    animated.push((t) => {
      gem.rotation.y = t * 1.2
      gem.position.y = WALL_HEIGHT + 0.5 + Math.sin(t * 2 + phase) * 0.08
    })
  }

  // 階の名前
  label(floor.id, 'map-label map-label--floor', P(-0.9, depth, 0))
  labels[labels.length - 1].style.color = `#${color.toString(16).padStart(6, '0')}`

  let currentVisibility = 1
  return {
    group,
    lineMaterials,
    setVisibility(v) {
      currentVisibility = v
      for (const f of fades) f.mat.opacity = f.base * v
      for (const el of labels) el.style.opacity = String(v)
      // ほぼ消えたら描画自体をやめる(ラベルも消える)
      group.visible = v > 0.01
    },
    tick(t) {
      for (const fn of animated) fn(t)
    },
    setStairType(type) {
      for (const [k, objs] of Object.entries(byStairType)) for (const o of objs) o.visible = k === type
    },
  }
}
