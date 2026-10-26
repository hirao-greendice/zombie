import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { computeWalls } from './walls'
import { straightStairs } from './stairs'
import type { Floor, MarkerKind, RoomKind } from './types'

export const WALL_HEIGHT = 1
export const FLOOR_GAP = 4.5

export const COLORS = {
  line: 0x3dffa2,
  grid: 0x1f6b4a,
  door: 0xffc23d,
  key: 0xffc23d,
  stairs: 0x3dc8ff,
  danger: 0xff3b3b,
}

const ROOM_FILL: Record<RoomKind, number> = {
  room: COLORS.line,
  key: COLORS.key,
  stairs: COLORS.stairs,
  ev: COLORS.stairs,
}

export const MARKER_COLOR: Record<MarkerKind, number> = {
  black: COLORS.danger,
  blue: COLORS.stairs,
  red: COLORS.danger,
}

/** 階ごとの透明度をまとめて上げ下げするための登録簿 */
export interface FloorHandle {
  group: THREE.Group
  /** 1 = 通常表示、0 に近いほど暗くなる */
  setVisibility(v: number): void
  /** 毎フレーム呼ぶ(マーカーのアニメーション) */
  tick(t: number): void
  lineMaterials: LineMaterial[]
}

type Vec = [number, number, number]

export function buildFloor(floor: Floor, width: number, depth: number): FloorHandle {
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

  const lines = (segs: [Vec, Vec][], color: number, linewidth: number, opacity = 1) => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(segs.flat(2))
    const mat = new LineMaterial({ color, linewidth, transparent: true, depthWrite: false })
    lineMaterials.push(mat)
    const obj = new LineSegments2(geo, fade(mat, opacity))
    group.add(obj)
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

  const label = (text: string, className: string, pos: Vec) => {
    const el = document.createElement('div')
    el.className = className
    el.textContent = text
    labels.push(el)
    const obj = new CSS2DObject(el)
    obj.position.set(...pos)
    group.add(obj)
  }

  // --- 床: 外周とグリッド ---
  const grid: [Vec, Vec][] = []
  for (let x = 1; x < width; x++) grid.push([P(x, 0), P(x, depth)])
  for (let y = 1; y < depth; y++) grid.push([P(0, y), P(width, y)])
  lines(grid, COLORS.grid, 1, 0.35)

  const slab = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), fillMat(COLORS.line, 0.015))
  slab.rotation.x = -Math.PI / 2
  group.add(slab)

  // --- 部屋の床塗り ---
  for (const room of floor.rooms) {
    const shape = new THREE.Shape(room.poly.map(([x, y]) => new THREE.Vector2(x - width / 2, -(y - depth / 2))))
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMat(ROOM_FILL[room.kind], room.kind === 'room' ? 0.04 : 0.1))
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

  // --- 階段: 直階段(その階の壁の高さに収める。最上階は屋上へ) ---
  const stairSegs = floor.rooms
    .filter((r) => r.kind === 'stairs')
    .flatMap((r) => straightStairs(r, floor.doors, WALL_HEIGHT))
    .map(([a, b]): [Vec, Vec] => [P(...a), P(...b)])
  if (stairSegs.length) lines(stairSegs, COLORS.stairs, 1.4)

  // --- 壁: 上辺・下辺・端の縦線 + 半透明の面 ---
  const wallSegs: [Vec, Vec][] = []
  const wallMat = fillMat(COLORS.line, 0.025)
  for (const [[x1, y1], [x2, y2]] of computeWalls(floor, width, depth)) {
    wallSegs.push(
      [P(x1, y1), P(x2, y2)],
      [P(x1, y1, WALL_HEIGHT), P(x2, y2, WALL_HEIGHT)],
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
  lines(wallSegs, COLORS.line, 2.2)

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
  for (const m of floor.markers) {
    const color = MARKER_COLOR[m.kind]
    const [x, , z] = P(...m.at)
    const marker = new THREE.Group()
    marker.position.set(x, 0, z)
    group.add(marker)

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

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 40), fillMat(color, 0.9))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    marker.add(ring)
    const ringMat = ring.material as THREE.MeshBasicMaterial
    const ringFade = fades[fades.length - 1]

    const phase = Math.random() * Math.PI * 2
    animated.push((t) => {
      gem.rotation.y = t * 1.2
      gem.position.y = WALL_HEIGHT + 0.5 + Math.sin(t * 2 + phase) * 0.08
      const p = ((t * 0.8 + phase) % 1 + 1) % 1
      ring.scale.setScalar(1 + p * 1.6)
      ringMat.opacity = ringFade.base * (1 - p) * currentVisibility
    })
  }

  // 階の名前
  label(floor.id, 'map-label map-label--floor', P(-0.9, 0, 0))

  let currentVisibility = 1
  return {
    group,
    lineMaterials,
    setVisibility(v) {
      currentVisibility = v
      for (const f of fades) f.mat.opacity = f.base * v
      for (const el of labels) el.style.opacity = String(Math.max(v, 0.15))
    },
    tick(t) {
      for (const fn of animated) fn(t)
    },
  }
}
