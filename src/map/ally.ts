import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { COLORS, WALL_HEIGHT } from './buildFloor'

type Vec = [number, number, number]

/** まっすぐ立った人の線画(足元が原点、+z が正面) */
const FIGURE: [Vec, Vec][] = [
  [[0, 0.4, 0], [0, 0.75, 0]], // 胴
  [[0, 0.4, 0], [-0.09, 0, 0]], // 脚
  [[0, 0.4, 0], [0.09, 0, 0]],
  [[-0.13, 0.72, 0], [0.13, 0.72, 0]], // 肩
  [[-0.13, 0.72, 0], [-0.16, 0.42, 0.04]], // 腕
  [[0.13, 0.72, 0], [0.16, 0.42, 0.04]],
  [[0, 0.75, 0], [0, 0.78, 0.12]], // 向きがわかるように鼻先
]

/** シミュレーションで歩く仲間の 3D 表示 */
export function buildAlly() {
  const group = new THREE.Group()
  const color = COLORS.ally

  const figure = new THREE.Group()
  figure.scale.setScalar(1.4)
  group.add(figure)
  const geo = new LineSegmentsGeometry()
  geo.setPositions(FIGURE.flat(2))
  const mat = new LineMaterial({ color, linewidth: 3, transparent: true, depthTest: false })
  const body = new LineSegments2(geo, mat)
  body.renderOrder = 10
  figure.add(body)
  const head = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.09)),
    new THREE.LineBasicMaterial({ color, depthTest: false }),
  )
  head.position.y = 0.88
  head.renderOrder = 10
  figure.add(head)

  // 遠くからでも見つけられるように、頭上に光の柱と目印
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, WALL_HEIGHT, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
  )
  beacon.position.y = 1.4 + WALL_HEIGHT / 2
  group.add(beacon)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.4, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.04
  group.add(ring)

  const el = document.createElement('div')
  el.className = 'map-label map-label--ally'
  el.textContent = 'ALLY'
  const label = new CSS2DObject(el)
  label.position.y = 1.4 + WALL_HEIGHT + 0.3
  group.add(label)

  const fadable = [mat, head.material, beacon.material] as { opacity: number; transparent: boolean }[]
  const baseOpacity = fadable.map((m) => m.opacity)
  let visibility = 1

  return {
    group,
    lineMaterials: [mat],
    /** 1 = 通常、小さいほど薄く(見ていない階にいるとき) */
    setVisibility(v: number) {
      visibility = v
      fadable.forEach((m, i) => {
        m.transparent = true
        m.opacity = baseOpacity[i] * v
      })
      el.style.opacity = String(v)
    },
    /** walking: 歩いているあいだ足取りを揺らす / heading: 向き(ラジアン) */
    tick(t: number, walking: boolean, heading: number | null) {
      if (heading !== null) figure.rotation.y = heading
      figure.position.y = walking ? Math.abs(Math.sin(t * 10)) * 0.05 : 0
      const p = (t * 0.7) % 1
      ring.scale.setScalar(1 + p * 1.2)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p) * visibility
    },
  }
}
