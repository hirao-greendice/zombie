import { useEffect, useRef, useState } from 'react'
import type { AllyView } from '../sim/useSim'

/** 仲間の歩く速さ(マス/秒)。3D と同じ */
const WALK_SPEED = 3
const REPLAY_SPEED = 2

export interface Walker {
  floor: number
  x: number
  y: number
  /** 軌跡(trail)のうち、ここまで歩き終えた点の数 */
  done: number
  walking: boolean
}

type Point = AllyView['trail'][number]

/** 平面図の上で、仲間を指示どおりに歩かせる(MapView の仲間と同じ動き) */
export function useWalker(view: AllyView, paused: boolean): Walker {
  const at = (p: Point, done: number, walking = false): Walker => ({ floor: p.floor, x: p.x, y: p.y, done, walking })
  const [walker, setWalker] = useState<Walker>(() => at(view.trail[view.trail.length - 1], view.trail.length))
  const run = useRef({ queue: [] as Point[], routeId: view.routeId, replayId: view.replayId, replaying: false, current: walker })

  // 新しい指示・リセット・リプレイを受け取る
  useEffect(() => {
    const r = run.current
    if (view.routeId !== r.routeId) {
      r.routeId = view.routeId
      if (view.snap) {
        r.queue = []
        r.current = at(view.trail[view.trail.length - 1], view.trail.length)
        setWalker(r.current)
      } else r.queue = [...r.queue, ...view.route]
    }
    if (view.replayId !== r.replayId) {
      r.replayId = view.replayId
      r.replaying = true
      r.queue = view.trail.slice(1)
      r.current = at(view.trail[0], 1, true)
      setWalker(r.current)
    }
  }, [view.routeId, view.replayId])

  useEffect(() => {
    if (paused) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const r = run.current
      if (!r.queue.length) return
      let { floor, x, y, done } = r.current
      let budget = WALK_SPEED * (r.replaying ? REPLAY_SPEED : 1) * dt
      while (r.queue.length && budget > 0) {
        const target = r.queue[0]
        // 階が変わるところ(階段)は、平面図の上では瞬間的に移る
        const dist = target.floor === floor ? Math.hypot(target.x - x, target.y - y) : 0
        if (dist <= budget) {
          budget -= dist
          ;({ floor, x, y } = target)
          done++
          r.queue.shift()
        } else {
          x += ((target.x - x) * budget) / dist
          y += ((target.y - y) * budget) / dist
          budget = 0
        }
      }
      if (!r.queue.length) r.replaying = false
      r.current = { floor, x, y, done, walking: r.queue.length > 0 }
      setWalker(r.current)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paused])

  return walker
}
