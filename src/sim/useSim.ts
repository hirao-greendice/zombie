import { useEffect, useMemo, useRef, useState } from 'react'
import type { Building, StairType } from '../map/types'
import { buildNav, type Nav } from './nav'
import { demoOrders } from './demo'
import { initialSim, runOrders, type AllyPos, type SimState, type Waypoint } from './simulate'

/** 3D マップに渡す仲間の動き */
export interface AllyView {
  pos: AllyPos
  /** 今回の指示で通る点。routeId が変わったら先頭から歩き直す */
  route: Waypoint[]
  routeId: number
  /** true のときは歩かずに pos へ瞬間移動(リセット時) */
  snap: boolean
  /** スタート地点からこれまでに通った点すべて(軌跡とリプレイ用。末尾は route と同じ) */
  trail: Waypoint[]
  /** 値が変わったら、trail を最初から再生し直す */
  replayId: number
}

const pointOf = (pos: AllyPos): Waypoint => ({ floor: pos.floor, x: pos.x + 0.5, y: pos.y + 0.5, rise: pos.roof ? 1 : 0 })

/** デモの道順を歩き終えた状態を作る(仲間は終点、軌跡は道順すべて) */
function demoRun(nav: Nav, building: Building, stairType: StairType): { state: SimState; trail: Waypoint[] } {
  const start = initialSim(nav, building.allyStart)
  const orders = demoOrders(nav, start.pos, stairType)
  const result = runOrders(start, orders.join(' '), nav, stairType)
  return { state: result.state, trail: [pointOf(start.pos), ...result.route] }
}

/** 指示どおりに仲間がマップ上を動くシミュレーション。最初はデモの道順を歩き終えた状態 */
export function useSim(building: Building, stairType: StairType) {
  const nav = useMemo(() => buildNav(building), [building])
  const initial = useMemo(() => demoRun(nav, building, stairType), [])
  const state = useRef(initial.state)
  const [view, setView] = useState<AllyView>(() => ({
    pos: initial.state.pos,
    route: [],
    routeId: 0,
    snap: true,
    trail: initial.trail,
    replayId: 0,
  }))

  /** デモの道順を読み込む(仲間は終点に置き、軌跡を描く) */
  const loadDemo = (type: StairType = stairType) => {
    const demo = demoRun(nav, building, type)
    state.current = demo.state
    setView((v) => ({ ...v, pos: demo.state.pos, route: [], routeId: v.routeId + 1, snap: true, trail: demo.trail }))
  }

  // 階段の形を切り替えたら、その形でデモの道順を計算し直す
  const firstStairType = useRef(stairType)
  useEffect(() => {
    if (stairType === firstStairType.current) return
    firstStairType.current = stairType
    loadDemo(stairType)
  }, [stairType])

  return {
    view,
    /** 指示を実行し、仲間の返事を返す */
    exec(text: string) {
      const result = runOrders(state.current, text, nav, stairType)
      state.current = result.state
      setView((v) => ({
        ...v,
        pos: result.state.pos,
        route: result.route,
        routeId: v.routeId + 1,
        snap: false,
        trail: [...v.trail, ...result.route],
      }))
      return result.reply
    },
    /** 仲間をスタート地点に戻し、軌跡も消す */
    reset() {
      state.current = initialSim(nav, building.allyStart)
      setView((v) => ({
        ...v,
        pos: state.current.pos,
        route: [],
        routeId: v.routeId + 1,
        snap: true,
        trail: [pointOf(state.current.pos)],
      }))
    },
    /** これまでの動きを最初から再生する */
    replay() {
      setView((v) => ({ ...v, replayId: v.replayId + 1 }))
    },
    /** デモの道順に戻す */
    loadDemo: () => loadDemo(),
  }
}

export type Sim = ReturnType<typeof useSim>
