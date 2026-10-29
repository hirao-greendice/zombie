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
import { WING_GAP } from './wings'
import { floorColor } from './floorColors'
import type { Building, StairType } from './types'
import type { AllyView } from '../sim/useSim'

interface Props {
  /** 横に並べて表示する棟(左から順)。配列が変わったら作り直すので、毎回同じ配列を渡す */
  buildings: Building[]
  /** 階ごとの表示 ON/OFF(floors と同じ順。どの棟も同じ階をまとめて切り替える) */
  shownFloors: boolean[]
  autoRotate: boolean
  /** 値が変わるたびにカメラを初期位置へ戻す */
  resetKey: number
  /** true: 各階を離して表示 / false: 実際の建物どおり積み重ねる */
  exploded: boolean
  stairType: StairType
  /** true のあいだ描画を止める(別タブ表示中など) */
  paused?: boolean
  /** 棟ごとのシミュレーションの仲間(buildings と同じ順)。無い棟には表示しない */
  allies?: (AllyView | undefined)[]
  /** onAllyFloorChange で知らせる仲間(allies の index) */
  followAlly?: number
  /** 歩いている仲間が別の階に着いたとき */
  onAllyFloorChange?(floor: number): void
  /** 仲間の通った道を矢印付きの線で描く */
  showTrail?: boolean
  /** true: 真上から見下ろし、壁を床へ沈めて平面図の形に変形する(FLAT_SECONDS かけて) */
  flat?: boolean
  /** 平面で線を描く階 */
  flatFloor?: number
  /**
   * 平面にしたときに合わせる位置と大きさ(この上に重ねる平面図と同じにすると、つなぎ目なく入れ替わる)。
   * cx, cy = 表示エリアの中心から、棟全体の中心までのずれ(px) / scale = 1マスの大きさ(px)
   */
  flatFrame?: () => { cx: number; cy: number; scale: number } | null
}

/** 立体 ⇄ 平面の変形にかける時間(秒) */
export const FLAT_SECONDS = 0.9

/** 表示している階より上の、消している階を持ち上げる量 */
const LIFT = 5
const VIEW_DIR = new THREE.Vector3(1, 0.62, 1.15).normalize()
/** 仲間の歩く速さ(マス/秒) */
const WALK_SPEED = 3
/** リプレイは何倍速で再生するか */
const REPLAY_SPEED = 2
/** 軌跡の矢印(>)を置く間隔 */
const CHEVRON_STEP = 1.2

type Waypoint = AllyView['route'][number]

/** 親要素いっぱいに広がり、親の大きさが変わると描画サイズも追従する */
export function MapView({
  buildings,
  shownFloors,
  autoRotate,
  resetKey,
  exploded,
  stairType,
  paused = false,
  allies,
  followAlly = 0,
  onAllyFloorChange,
  showTrail = true,
  flat = false,
  flatFloor = 0,
  flatFrame,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // 描画ループから最新の props を読むための参照
  const state = useRef({ shownFloors, autoRotate, resetKey, exploded, stairType, paused, allies, followAlly, onAllyFloorChange, showTrail, flat, flatFloor, flatFrame })
  state.current = { shownFloors, autoRotate, resetKey, exploded, stairType, paused, allies, followAlly, onAllyFloorChange, showTrail, flat, flatFloor, flatFrame }

  useEffect(() => {
    const host = hostRef.current!
    // 棟を左から並べ、全体の中心を原点にする。offsets = 各棟の中心の x
    const totalW = buildings.reduce((s, b) => s + b.width, 0) + WING_GAP * (buildings.length - 1)
    const D = Math.max(...buildings.map((b) => b.depth))
    const offsets: number[] = []
    let cursor = -totalW / 2
    for (const b of buildings) {
      offsets.push(cursor + b.width / 2)
      cursor += b.width + WING_GAP
    }
    const floorCount = Math.max(...buildings.map((b) => b.floors.length))
    /** 横に広いほど引いて見る */
    const widthScale = Math.max(1, totalW / 12)
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
    scene.fog = new THREE.FogExp2(0x020604, 0.006 / widthScale)
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 400)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 10
    controls.maxDistance = 70 * widthScale
    controls.maxPolarAngle = Math.PI * 0.49
    controls.autoRotateSpeed = 0.5

    // --- 建物: wings[棟][階] ---
    const wings: FloorHandle[][] = buildings.map((b, w) =>
      b.floors.map((f, i) => {
        const h = buildFloor(f, b.width, b.depth, floorColor(i))
        h.group.position.x = offsets[w]
        // カメラは常に上から見るので、下の階 → 上の階の床板 → 上の階の中身、の順に描く
        h.group.traverse((o) => (o.renderOrder = i * 10 + (o.userData.slab ? 0 : 1)))
        scene.add(h.group)
        return h
      }),
    )
    const allFloors = wings.flat()
    // 階と階の間隔。離して表示 = FLOOR_GAP、積み重ね = 壁の高さ(上の階が下の階の壁の上に乗る)
    const gapGoal = () => (state.current.exploded ? FLOOR_GAP : WALL_HEIGHT)
    let gap = gapGoal()

    // 棟の外周(平面上の4隅)
    const outlines = buildings.map((b, w) => {
      const [x0, x1, z0, z1] = [offsets[w] - b.width / 2, offsets[w] + b.width / 2, -b.depth / 2, b.depth / 2]
      return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
    })

    // 複数の棟を並べたときは、棟の名前を手前に出す
    if (buildings.length > 1) {
      buildings.forEach((b, w) => {
        const el = document.createElement('div')
        el.className = 'map-label map-label--wing'
        el.textContent = b.name
        const obj = new CSS2DObject(el)
        obj.position.set(offsets[w], 0, b.depth / 2 + 1.6)
        scene.add(obj)
      })
    }

    // 階をつなぐ柱(各棟の四隅)
    const pillarGeo = new THREE.BufferGeometry().setFromPoints(
      outlines.flat().flatMap(([x, z]) => [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 1, z)]),
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
    // 全階表示: 各棟の外周が上下に走査 / 階選択時: 横一線が奥から手前へ走査
    const scanRing = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(
        outlines.flatMap((o) => o.flatMap(([x, z], i) => {
          const [nx, nz] = o[(i + 1) % o.length]
          return [new THREE.Vector3(x, 0, z), new THREE.Vector3(nx, 0, nz)]
        })),
      ),
      new THREE.LineBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.8 }),
    )
    scene.add(scanRing)

    const scanBar = new THREE.Group()
    const scanPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(totalW, WALL_HEIGHT * 1.4),
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
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-totalW / 2, 0.03, 0), new THREE.Vector3(totalW / 2, 0.03, 0)]),
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

    // --- カメラ・階の状態(仲間の位置計算でも使う) ---
    const goalTarget = new THREE.Vector3()
    let goalDistance = 0
    const shown = (i: number) => state.current.shownFloors[i] ?? true
    /** 表示している階の一番下と一番上 */
    const shownRange = () => {
      const idx = [...Array(floorCount).keys()].filter(shown)
      return idx.length ? [idx[0], idx[idx.length - 1]] : [0, floorCount - 1]
    }
    // 消している階は完全に見えなくする。表示している階より上なら、持ち上げながら消す
    // 平面にするときは、表示している階を全部同じ高さに重ねる
    const visibilityGoal = (i: number): number =>
      shown(i) ? 1 : 0
    const liftGoal = (i: number) => (state.current.flat ? 0 : i * gap + (!shown(i) && i > shownRange()[1] ? LIFT : 0))
    // 初回は補間せず、いきなり目標の状態で表示する
    const visibility = [...Array(floorCount).keys()].map(visibilityGoal)
    /** 階ごとの床の高さ(どの棟も同じ) */
    const floorY = [...Array(floorCount).keys()].map(liftGoal)

    // --- シミュレーションの仲間(棟ごと) ---
    const TRAIL_LIFT = new THREE.Vector3(0, 0.08, 0)
    /** 棟 w を歩く仲間と、その軌跡 */
    const createAlly = (w: number) => {
      const b = buildings[w]
      const view = () => state.current.allies?.[w]
      const allyObj = buildAlly()
      allyObj.group.traverse((o) => (o.renderOrder = 1000))
      scene.add(allyObj.group)
      /** 平面図の点 → いまの階の位置を反映した 3D 座標 */
      const toWorld = (p: { floor: number; x: number; y: number; rise?: number }) =>
        new THREE.Vector3(offsets[w] + p.x - b.width / 2, floorY[p.floor] + (p.rise ?? 0) * WALL_HEIGHT, p.y - b.depth / 2)
      const allyRest = (a: AllyView) => toWorld({ floor: a.pos.floor, x: a.pos.x + 0.5, y: a.pos.y + 0.5, rise: a.pos.roof ? 1 : 0 })
      const first = view()
      let allyQueue: Waypoint[] = []
      let allyRouteId = -1
      let allyReplayId = first?.replayId ?? 0
      let replaying = false
      /** ここまで歩き終えた点(軌跡として描く) */
      let trailDone: Waypoint[] = first ? [...first.trail] : []
      let allyPos: THREE.Vector3 | null = null
      let allyHeading: number | null = null
      let allyFloor = first?.pos.floor ?? 0
      const setAllyFloor = (floor: number) => {
        if (floor === allyFloor) return
        allyFloor = floor
        if (state.current.followAlly === w) state.current.onAllyFloorChange?.(floor)
      }

      // --- 軌跡: 通った道の線と、進んだ向きの矢印(>) ---
      const trailMat = new LineMaterial({ color: COLORS.ally, linewidth: 5, transparent: true, depthTest: false })
      const trailLine = new LineSegments2(new LineSegmentsGeometry(), trailMat)
      trailLine.renderOrder = 999
      scene.add(trailLine)
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

      return {
        lineMaterials: [...allyObj.lineMaterials, trailMat],
        /** 新しい指示が来たら通る点を順に歩く。止まっているときは階の上下移動に追従する */
        tick(dt: number, t: number) {
          const a = view()
          allyObj.group.visible = !!a
          if (!a) {
            trailLine.visible = false
            return
          }
          if (a.routeId !== allyRouteId) {
            allyRouteId = a.routeId
            if (a.snap || !allyPos) {
              // リセット: その場に置き直し、軌跡もそこから
              allyQueue = []
              trailDone = [...a.trail]
              allyPos = allyRest(a)
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
            allyPos = allyRest(a)
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
        },
      }
    }
    const allyRunners = buildings.map((_, w) => createAlly(w))

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
      for (const f of allFloors) for (const m of f.lineMaterials) m.resolution.set(width, height)
      for (const r of allyRunners) for (const m of r.lineMaterials) m.resolution.set(width, height)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    // --- カメラ ---
    let lastReset = -1
    let lastShown = shownFloors.join()
    let lastExploded = exploded
    let zoomUntil = 0

    // 表示している階の真ん中を見る。階が多いほど・棟が横に広いほど引いて見る
    const updateGoal = () => {
      const [lo, hi] = shownRange()
      goalTarget.set(0, ((lo + hi) / 2) * gap, 0)
      goalDistance = (lo === hi ? 24 : 24 + (hi - lo) * (state.current.exploded ? 8 : 4)) * widthScale
    }
    updateGoal()
    controls.target.copy(goalTarget)
    camera.position.copy(goalTarget).addScaledVector(VIEW_DIR, goalDistance)

    // --- 立体 ⇄ 平面の変形 ---
    // flatT: 0 = 立体 / 1 = 平面。変形を始めたときのカメラ(球座標)を覚えておき、真上へ回り込む
    let flatT = flat ? 1 : 0
    let orbitSnap: { target: THREE.Vector3; sph: THREE.Spherical } | null = null
    const takeSnap = () => {
      const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
      // 真上(北が上)へは近い向きから回る
      sph.theta = Math.atan2(Math.sin(sph.theta), Math.cos(sph.theta))
      orbitSnap = { target: controls.target.clone(), sph }
    }
    /** 平面にしたときの、真上からの距離と注視点のずれ。flatFrame があればそれに合わせ、なければ棟全体がちょうど収まるように */
    const flatView = () => {
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const frame = state.current.flatFrame?.()
      if (!frame) return { distance: Math.max((D + 2) / (2 * tan), (totalW + 2) / (2 * tan * camera.aspect)), dx: 0, dz: 0 }
      // 真上から見下ろすと、距離 r の床で 1マス = (height / 2) / (r * tan) px
      return { distance: height / 2 / (frame.scale * tan), dx: -frame.cx / frame.scale, dz: -frame.cy / frame.scale }
    }
    const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)

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
      const flatGoal = state.current.flat ? 1 : 0
      if (flatGoal === 1 && flatT === 0) takeSnap()
      flatT = THREE.MathUtils.clamp(flatT + (flatGoal ? 1 : -1) * (dt / FLAT_SECONDS), 0, 1)
      const e = ease(flatT)
      if (flatT > 0) {
        // 変形中・平面: カメラを真上へ回し込みながら、残す階の真ん中へ寄る
        if (!orbitSnap) takeSnap()
        const snap = orbitSnap!
        const fv = flatView()
        const target = snap.target.clone().lerp(new THREE.Vector3(fv.dx, floorY[state.current.flatFloor] ?? 0, fv.dz), e)
        const sph = new THREE.Spherical(
          THREE.MathUtils.lerp(snap.sph.radius, fv.distance, e),
          THREE.MathUtils.lerp(snap.sph.phi, 0.0001, e),
          THREE.MathUtils.lerp(snap.sph.theta, 0, e),
        )
        controls.enabled = false
        controls.target.copy(target)
        camera.position.setFromSpherical(sph).add(target)
        camera.lookAt(target)
      } else {
        if (orbitSnap) {
          // 立体に戻りきったら、元の視点から操作を再開
          controls.target.copy(orbitSnap.target)
          camera.position.setFromSpherical(orbitSnap.sph).add(orbitSnap.target)
          orbitSnap = null
          controls.enabled = true
        }
        controls.target.lerp(goalTarget, k)
        if (t < zoomUntil) offset.setLength(THREE.MathUtils.lerp(offset.length(), goalDistance, k))
        camera.position.copy(controls.target).add(offset)
        controls.autoRotate = ar
        controls.update()
      }

      for (let i = 0; i < floorCount; i++) {
        visibility[i] = THREE.MathUtils.lerp(visibility[i], visibilityGoal(i), k)
        floorY[i] = THREE.MathUtils.lerp(floorY[i], liftGoal(i), k)
      }
      for (const floors of wings) {
        floors.forEach((f, i) => {
          f.setVisibility(visibility[i])
          f.setStairType(state.current.stairType)
          f.group.position.y = floorY[i]
          // 平面にするときは、壁を床へ沈める
          f.group.scale.y = 1 - 0.97 * e
          f.setLineScale(1 + e)
          f.tick(t)
        })
      }
      // 四隅の柱は、複数の階を離して表示しているときだけ見せる
      pillars.position.y = lo * gap
      pillars.scale.y = (hi - lo) * gap + WALL_HEIGHT
      const spread = (gap - WALL_HEIGHT) / (FLOOR_GAP - WALL_HEIGHT)
      pillarMat.opacity = 0.35 * spread * (lo === hi ? 0 : 1) * (1 - e)

      for (const r of allyRunners) r.tick(dt, t)

      // 複数の階: 外周が上下に走査 / 1つの階: 横一線が奥から手前へ走査
      if (flatT > 0) {
        scanRing.visible = false
        scanBar.visible = false
      } else if (lo !== hi) {
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
      window.removeEventListener('resize', resize)
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
  }, [buildings])

  return <div ref={hostRef} className="map-view" />
}
