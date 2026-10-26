import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { buildFloor, COLORS, FLOOR_GAP, WALL_HEIGHT, type FloorHandle } from './buildFloor'
import type { Building, StairType } from './types'

interface Props {
  building: Building
  /** 選択中の階の index。null なら全階表示 */
  activeFloor: number | null
  autoRotate: boolean
  /** 値が変わるたびにカメラを初期位置へ戻す */
  resetKey: number
  /** true: 各階を離して表示 / false: 実際の建物どおり積み重ねる */
  exploded: boolean
  stairType: StairType
  /** true のあいだ描画を止める(別タブ表示中など) */
  paused?: boolean
}

// 透明度はリニア空間で効くため、sRGB 出力では見た目より明るくなる。小さめの値にしている
const DIM = 0.03
const DIM_ABOVE = 0.008
const LIFT = 4
const VIEW_DIR = new THREE.Vector3(1, 0.62, 1.15).normalize()

/** 親要素いっぱいに広がり、親の大きさが変わると描画サイズも追従する */
export function MapView({ building, activeFloor, autoRotate, resetKey, exploded, stairType, paused = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // 描画ループから最新の props を読むための参照
  const state = useRef({ activeFloor, autoRotate, resetKey, exploded, stairType, paused })
  state.current = { activeFloor, autoRotate, resetKey, exploded, stairType, paused }

  useEffect(() => {
    const host = hostRef.current!
    const { width: W, depth: D } = building
    // 表示エリアの大きさ(Stage の座標系)。下の resize() で更新する
    let width = Math.max(host.clientWidth, 1)
    let height = Math.max(host.clientHeight, 1)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x020604, 1)
    host.appendChild(renderer.domElement)

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(width, height)
    labelRenderer.domElement.className = 'map-labels'
    host.appendChild(labelRenderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x020604, 0.012)
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 400)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 10
    controls.maxDistance = 70
    controls.maxPolarAngle = Math.PI * 0.49
    controls.autoRotateSpeed = 0.5

    // --- 建物 ---
    const floors: FloorHandle[] = building.floors.map((f) => {
      const h = buildFloor(f, W, D)
      scene.add(h.group)
      return h
    })
    // 階と階の間隔。離して表示 = FLOOR_GAP、積み重ね = 壁の高さ(上の階が下の階の壁の上に乗る)
    const gapGoal = () => (state.current.exploded ? FLOOR_GAP : WALL_HEIGHT)
    let gap = gapGoal()
    const topY = () => (building.floors.length - 1) * gap

    // 階をつなぐ柱(建物の四隅)
    const pillarGeo = new THREE.BufferGeometry().setFromPoints(
      [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]].flatMap(([x, z]) => [
        new THREE.Vector3(x, 0, z),
        new THREE.Vector3(x, 1, z),
      ]),
    )
    const pillarMat = new THREE.LineDashedMaterial({ color: COLORS.line, dashSize: 0.2, gapSize: 0.2, transparent: true, opacity: 0.35 })
    const pillars = new THREE.LineSegments(pillarGeo, pillarMat)
    pillars.computeLineDistances()
    scene.add(pillars)

    // 地面の大きなグリッド
    const ground = new THREE.GridHelper(120, 60, COLORS.grid, COLORS.grid)
    ground.position.y = -0.6
    const groundMat = ground.material as THREE.Material
    groundMat.transparent = true
    groundMat.opacity = 0.18
    scene.add(ground)

    // --- スキャン演出 ---
    // 全階表示: 建物の外周が上下に走査 / 階選択時: 横一線が奥から手前へ走査
    const scanRing = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
      ),
      new THREE.LineBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.8 }),
    )
    scene.add(scanRing)

    const scanBar = new THREE.Group()
    const scanPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W, WALL_HEIGHT * 1.4),
      new THREE.MeshBasicMaterial({
        color: COLORS.line,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    scanPlane.position.y = WALL_HEIGHT * 0.7
    const scanLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-W / 2, 0.03, 0), new THREE.Vector3(W / 2, 0.03, 0)]),
      new THREE.LineBasicMaterial({ color: COLORS.line }),
    )
    scanBar.add(scanPlane, scanLine)
    scene.add(scanBar)

    // --- ポストエフェクト(発光) ---
    const composer = new EffectComposer(renderer)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(width, height)
    composer.addPass(new RenderPass(scene, camera))
    // 発光の強さ・広がり・発光し始める明るさ
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.1, 0.1, 0.6))
    composer.addPass(new OutputPass())

    const resize = () => {
      width = Math.max(host.clientWidth, 1)
      height = Math.max(host.clientHeight, 1)
      renderer.setSize(width, height)
      labelRenderer.setSize(width, height)
      composer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      for (const f of floors) for (const m of f.lineMaterials) m.resolution.set(width, height)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    // --- カメラ ---
    const goalTarget = new THREE.Vector3()
    let goalDistance = 0
    const isAbove = (i: number) => state.current.activeFloor !== null && i > state.current.activeFloor
    const visibilityGoal = (i: number): number => {
      const af = state.current.activeFloor
      return af === null || af === i ? 1 : isAbove(i) ? DIM_ABOVE : DIM
    }
    const liftGoal = (i: number) => i * gap + (isAbove(i) ? LIFT : 0)
    // 初回は補間せず、いきなり目標の状態で表示する
    const visibility = floors.map((_, i) => visibilityGoal(i))
    floors.forEach((f, i) => (f.group.position.y = liftGoal(i)))
    let lastReset = -1
    let lastActive: number | null = activeFloor
    let lastExploded = exploded
    let zoomUntil = 0

    const updateGoal = () => {
      const af = state.current.activeFloor
      if (af === null) {
        goalTarget.set(0, topY() / 2, 0)
        goalDistance = state.current.exploded ? 40 : 32
      } else {
        goalTarget.set(0, af * gap, 0)
        goalDistance = 24
      }
    }
    updateGoal()
    controls.target.copy(goalTarget)
    camera.position.copy(goalTarget).addScaledVector(VIEW_DIR, goalDistance)

    const clock = new THREE.Clock()
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(clock.getDelta(), 0.1)
      if (state.current.paused) return
      const t = clock.elapsedTime
      const { activeFloor: af, autoRotate: ar, resetKey: rk, exploded: ex } = state.current
      const k = 1 - Math.exp(-dt * 4)
      gap = THREE.MathUtils.lerp(gap, gapGoal(), k)
      updateGoal()

      // 選択階へ注視点と距離をなめらかに寄せる(距離は切替直後だけ。それ以外はピンチ操作を優先)
      const offset = camera.position.clone().sub(controls.target)
      if (rk !== lastReset) {
        if (lastReset !== -1) offset.copy(VIEW_DIR).multiplyScalar(offset.length())
        lastReset = rk
        zoomUntil = t + 1.5
      }
      if (af !== lastActive || ex !== lastExploded) {
        lastActive = af
        lastExploded = ex
        zoomUntil = t + 1.5
      }
      controls.target.lerp(goalTarget, k)
      if (t < zoomUntil) offset.setLength(THREE.MathUtils.lerp(offset.length(), goalDistance, k))
      camera.position.copy(controls.target).add(offset)

      controls.autoRotate = ar
      controls.update()

      // 選択階より上は持ち上げてほぼ消し、下は暗く残す
      floors.forEach((f, i) => {
        visibility[i] = THREE.MathUtils.lerp(visibility[i], visibilityGoal(i), k)
        f.setVisibility(visibility[i])
        f.setStairType(state.current.stairType)
        f.group.position.y = THREE.MathUtils.lerp(f.group.position.y, liftGoal(i), k)
        f.tick(t)
      })
      // 四隅の柱は離して表示しているときだけ見せる
      pillars.scale.y = topY() + WALL_HEIGHT
      const spread = (gap - WALL_HEIGHT) / (FLOOR_GAP - WALL_HEIGHT)
      pillarMat.opacity = 0.35 * spread * (af === null ? 1 : DIM)

      if (af === null) {
        const p = (t * 0.25) % 1
        scanRing.visible = true
        scanBar.visible = false
        scanRing.position.y = p * (topY() + WALL_HEIGHT)
        ;(scanRing.material as THREE.LineBasicMaterial).opacity = 0.8 * Math.sin(p * Math.PI)
      } else {
        const p = (t * 0.3) % 1
        scanRing.visible = false
        scanBar.visible = true
        scanBar.position.set(0, af * gap, -D / 2 + p * D)
      }

      composer.render()
      labelRenderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      controls.dispose()
      composer.dispose()
      renderer.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        mats.forEach((mat) => mat.dispose())
      })
      host.replaceChildren()
    }
  }, [building])

  return <div ref={hostRef} className="map-view" />
}
