import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { buildFloor, COLORS, FLOOR_GAP, WALL_HEIGHT, type FloorHandle } from './buildFloor'
import { buildAlly } from './ally'
import { floorColor } from './floorColors'
import type { Building, StairType } from './types'
import type { AllyView } from '../sim/useSim'

interface Props {
  building: Building
  /** 階ごとの表示 ON/OFF(floors と同じ順) */
  shownFloors: boolean[]
  autoRotate: boolean
  /** 値が変わるたびにカメラを初期位置へ戻す */
  resetKey: number
  /** true: 各階を離して表示 / false: 実際の建物どおり積み重ねる */
  exploded: boolean
  stairType: StairType
  /** true のあいだ描画を止める(別タブ表示中など) */
  paused?: boolean
  /** シミュレーションの仲間。省略すると表示しない */
  ally?: AllyView
  /** 歩いている仲間が別の階に着いたとき */
  onAllyFloorChange?(floor: number): void
  /** 仲間の通った道を矢印付きの線で描く */
  showTrail?: boolean
}

/** 表示している階より上の、消している階を持ち上げる量 */
const LIFT = 5
const VIEW_DIR = new THREE.Vector3(1, 0.62, 1.15).normalize()
/** 仲間の歩く速さ(マス/秒) */
const WALK_SPEED = 3
/** リプレイは何倍速で再生するか */
const REPLAY_SPEED = 2
/** 軌跡の矢印(>)を置く間隔 */
const CHEVRON_STEP = 1.2

/** 親要素いっぱいに広がり、親の大きさが変わると描画サイズも追従する */
export function MapView({ building, shownFloors, autoRotate, resetKey, exploded, stairType, paused = false, ally, onAllyFloorChange, showTrail = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // 描画ループから最新の props を読むための参照
  const state = useRef({ shownFloors, autoRotate, resetKey, exploded, stairType, paused, ally, onAllyFloorChange, showTrail })
  state.current = { shownFloors, autoRotate, resetKey, exploded, stairType, paused, ally, onAllyFloorChange, showTrail }

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
    scene.fog = new THREE.FogExp2(0x020604, 0.006)
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 400)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 10
    controls.maxDistance = 70
    controls.maxPolarAngle = Math.PI * 0.49
    controls.autoRotateSpeed = 0.5

    // --- 建物 ---
    const floors: FloorHandle[] = building.floors.map((f, i) => {
      const h = buildFloor(f, W, D, floorColor(i))
      // カメラは常に上から見るので、下の階 → 上の階の床板 → 上の階の中身、の順に描く
      h.group.traverse((o) => (o.renderOrder = i * 10 + (o.userData.slab ? 0 : 1)))
      scene.add(h.group)
      return h
    })
    // 階と階の間隔。離して表示 = FLOOR_GAP、積み重ね = 壁の高さ(上の階が下の階の壁の上に乗る)
    const gapGoal = () => (state.current.exploded ? FLOOR_GAP : WALL_HEIGHT)
    let gap = gapGoal()

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

    // 方角の目印(⬆️ = 平面図の上 = 北)
    const compassEl = document.createElement('div')
    compassEl.className = 'map-label map-label--compass'
    compassEl.textContent = '▲ N'
    const compass = new CSS2DObject(compassEl)
    compass.position.set(0, 0, -D / 2 - 1.2)
    scene.add(compass)

    // --- シミュレーションの仲間 ---
    const allyObj = buildAlly()
    allyObj.group.traverse((o) => (o.renderOrder = 1000))
    scene.add(allyObj.group)
    /** 平面図の点 → いまの階の位置を反映した 3D 座標 */
    const toWorld = (p: { floor: number; x: number; y: number; rise?: number }) =>
      new THREE.Vector3(p.x - W / 2, floors[p.floor].group.position.y + (p.rise ?? 0) * WALL_HEIGHT, p.y - D / 2)
    const allyRest = () => {
      const a = state.current.ally!
      return toWorld({ floor: a.pos.floor, x: a.pos.x + 0.5, y: a.pos.y + 0.5, rise: a.pos.roof ? 1 : 0 })
    }
    let allyQueue: AllyView['route'] = []
    let allyRouteId = -1
    let allyReplayId = ally?.replayId ?? 0
    let replaying = false
    /** ここまで歩き終えた点(軌跡として描く) */
    let trailDone: AllyView['trail'] = ally ? [...ally.trail] : []
    let allyPos: THREE.Vector3 | null = null
    let allyHeading: number | null = null
    let allyFloor = ally?.pos.floor ?? 0
    const setAllyFloor = (floor: number) => {
      if (floor === allyFloor) return
      allyFloor = floor
      state.current.onAllyFloorChange?.(floor)
    }

    // --- 軌跡: 通った道の線と、進んだ向きの矢印(>) ---
    const trailMat = new LineMaterial({ color: COLORS.ally, linewidth: 5, transparent: true, depthTest: false })
    const trailLine = new LineSegments2(new LineSegmentsGeometry(), trailMat)
    trailLine.renderOrder = 999
    scene.add(trailLine)
    const TRAIL_LIFT = new THREE.Vector3(0, 0.08, 0)
    const updateTrail = (points: { floor: number; v: THREE.Vector3 }[]) => {
      const flat: number[] = []
      const push = (p: THREE.Vector3, q: THREE.Vector3) => flat.push(p.x, p.y, p.z, q.x, q.y, q.z)
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i]
        const b = points[i + 1]
        // 消している階の部分は描かない
        if (visibility[a.floor] < 0.5 && visibility[b.floor] < 0.5) continue
        const d = b.v.clone().sub(a.v)
        const len = d.length()
        if (len < 0.01) continue
        push(a.v, b.v)
        const flatLen = Math.hypot(d.x, d.z)
        if (flatLen < 0.3) continue
        const dir = d.clone().normalize()
        const side = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(0.26)
        for (let s = Math.min(CHEVRON_STEP / 2, len / 2); s < len; s += CHEVRON_STEP) {
          const c = a.v.clone().addScaledVector(dir, s)
          const tip = c.clone().addScaledVector(dir, 0.22)
          const back = c.clone().addScaledVector(dir, -0.14)
          push(back.clone().add(side), tip)
          push(back.clone().sub(side), tip)
        }
      }
      trailLine.geometry.dispose()
      trailLine.geometry = new LineSegmentsGeometry()
      trailLine.visible = flat.length > 0
      if (flat.length) trailLine.geometry.setPositions(flat)
    }

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
      for (const m of allyObj.lineMaterials) m.resolution.set(width, height)
      trailMat.resolution.set(width, height)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    // --- カメラ ---
    const goalTarget = new THREE.Vector3()
    let goalDistance = 0
    const shown = (i: number) => state.current.shownFloors[i] ?? true
    /** 表示している階の一番下と一番上 */
    const shownRange = () => {
      const idx = floors.map((_, i) => i).filter(shown)
      return idx.length ? [idx[0], idx[idx.length - 1]] : [0, floors.length - 1]
    }
    // 消している階は完全に見えなくする。表示している階より上なら、持ち上げながら消す
    const visibilityGoal = (i: number): number => (shown(i) ? 1 : 0)
    const liftGoal = (i: number) => i * gap + (!shown(i) && i > shownRange()[1] ? LIFT : 0)
    // 初回は補間せず、いきなり目標の状態で表示する
    const visibility = floors.map((_, i) => visibilityGoal(i))
    floors.forEach((f, i) => (f.group.position.y = liftGoal(i)))
    let lastReset = -1
    let lastShown = shownFloors.join()
    let lastExploded = exploded
    let zoomUntil = 0

    // 表示している階の真ん中を見る。階が多いほど引いて見る
    const updateGoal = () => {
      const [lo, hi] = shownRange()
      goalTarget.set(0, ((lo + hi) / 2) * gap, 0)
      goalDistance = lo === hi ? 24 : 24 + (hi - lo) * (state.current.exploded ? 8 : 4)
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
      const { shownFloors: sf, autoRotate: ar, resetKey: rk, exploded: ex } = state.current
      const [lo, hi] = shownRange()
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
      if (sf.join() !== lastShown || ex !== lastExploded) {
        lastShown = sf.join()
        lastExploded = ex
        zoomUntil = t + 1.5
      }
      controls.target.lerp(goalTarget, k)
      if (t < zoomUntil) offset.setLength(THREE.MathUtils.lerp(offset.length(), goalDistance, k))
      camera.position.copy(controls.target).add(offset)

      controls.autoRotate = ar
      controls.update()

      floors.forEach((f, i) => {
        visibility[i] = THREE.MathUtils.lerp(visibility[i], visibilityGoal(i), k)
        f.setVisibility(visibility[i])
        f.setStairType(state.current.stairType)
        f.group.position.y = THREE.MathUtils.lerp(f.group.position.y, liftGoal(i), k)
        f.tick(t)
      })
      // 四隅の柱は、複数の階を離して表示しているときだけ見せる
      pillars.position.y = lo * gap
      pillars.scale.y = (hi - lo) * gap + WALL_HEIGHT
      const spread = (gap - WALL_HEIGHT) / (FLOOR_GAP - WALL_HEIGHT)
      pillarMat.opacity = 0.35 * spread * (lo === hi ? 0 : 1)

      // 仲間: 新しい指示が来たら通る点を順に歩く。止まっているときは階の上下移動に追従する
      const a = state.current.ally
      allyObj.group.visible = !!a
      if (a) {
        if (a.routeId !== allyRouteId) {
          allyRouteId = a.routeId
          if (a.snap || !allyPos) {
            // リセット: その場に置き直し、軌跡もそこから
            allyQueue = []
            trailDone = [...a.trail]
            allyPos = allyRest()
            setAllyFloor(a.pos.floor)
          } else {
            // まだ歩いている途中なら、残りを歩いてから続けて歩く
            allyQueue = [...allyQueue, ...a.route]
          }
        }
        if (a.replayId !== allyReplayId) {
          // リプレイ: スタート地点に戻して、通った点を最初から歩き直す
          allyReplayId = a.replayId
          replaying = true
          trailDone = a.trail.slice(0, 1)
          allyQueue = a.trail.slice(1)
          allyPos = toWorld(a.trail[0])
          setAllyFloor(a.trail[0].floor)
        }
        let walking = false
        let budget = (replaying ? WALK_SPEED * REPLAY_SPEED : WALK_SPEED) * dt
        while (allyQueue.length && budget > 0) {
          const target = toWorld(allyQueue[0])
          const to = target.clone().sub(allyPos!)
          const dist = to.length()
          if (Math.abs(to.x) + Math.abs(to.z) > 0.01) allyHeading = Math.atan2(to.x, to.z)
          if (dist <= budget) {
            allyPos = target
            budget -= dist
            const reached = allyQueue.shift()!
            trailDone.push(reached)
            setAllyFloor(reached.floor)
          } else {
            allyPos!.addScaledVector(to, budget / dist)
            budget = 0
          }
          walking = true
        }
        if (!allyQueue.length) {
          allyPos = allyRest()
          replaying = false
        }
        allyObj.group.position.copy(allyPos!)
        allyObj.tick(t, walking, allyHeading)
        // 消している階にいるときは仲間も消す
        allyObj.setVisibility(visibility[allyFloor])

        if (state.current.showTrail) {
          const points = trailDone.map((p) => ({ floor: p.floor, v: toWorld(p).add(TRAIL_LIFT) }))
          if (allyQueue.length) points.push({ floor: allyFloor, v: allyPos!.clone().add(TRAIL_LIFT) })
          updateTrail(points)
        } else trailLine.visible = false
      } else trailLine.visible = false

      // 複数の階: 外周が上下に走査 / 1つの階: 横一線が奥から手前へ走査
      if (lo !== hi) {
        const p = (t * 0.25) % 1
        scanRing.visible = true
        scanBar.visible = false
        scanRing.position.y = lo * gap + p * ((hi - lo) * gap + WALL_HEIGHT)
        ;(scanRing.material as THREE.LineBasicMaterial).opacity = 0.8 * Math.sin(p * Math.PI)
      } else {
        const p = (t * 0.3) % 1
        scanRing.visible = false
        scanBar.visible = true
        scanBar.position.set(0, lo * gap, -D / 2 + p * D)
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
