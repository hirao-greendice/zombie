import { useEffect, useRef, useState } from 'react'
import type { WingId } from '../map/wings'
import type { AllyPos } from '../sim/simulate'
import type { Sim } from '../sim/useSim'
import { draftOrders, draftSummary, emptyDraft, samePoint, type Bomb, type Draft, type PlanPoint } from './draft'

const WING_IDS: WingId[] = ['west', 'east']
const startOf = (pos: AllyPos): PlanPoint => ({ floor: pos.floor, x: pos.x, y: pos.y })
const byWing = <T,>(fn: (w: WingId) => T) => ({ west: fn('west'), east: fn('east') })

/** 送った結果(通信ログに残す) */
export interface PlanSent {
  wing: WingId
  /** こちらの指示の要約 */
  order: string
  reply: string
}

/** 棟ごとの、平面図に描いた道順の下書きと、置いた爆弾 */
export function usePlans(sims: Record<WingId, Sim>) {
  const [drafts, setDrafts] = useState<Record<WingId, Draft>>(() => byWing((w) => emptyDraft(startOf(sims[w].view.pos))))
  const [bombs, setBombs] = useState<Record<WingId, Bomb[]>>({ west: [], east: [] })
  const nextBombId = useRef(1)

  // 仲間が動いたら(送信・リセット・デモ)、下書きはそこから描き直し。
  // 1マスも進めなかったときは位置が同じもののままなので、描いた線を残して直せるようにする
  const positions = byWing((w) => sims[w].view.pos)
  const lastPositions = useRef(positions)
  useEffect(() => {
    const moved = WING_IDS.filter((w) => positions[w] !== lastPositions.current[w])
    lastPositions.current = positions
    if (moved.length) setDrafts((prev) => ({ ...prev, ...Object.fromEntries(moved.map((w) => [w, emptyDraft(startOf(positions[w]))])) }))
  }, [positions.west, positions.east])

  const updateDraft = (wing: WingId, fn: (d: Draft) => Draft) => setDrafts((prev) => ({ ...prev, [wing]: fn(prev[wing]) }))

  /** 爆弾を置く(同じマスにすでにあれば置かない) */
  const placeBomb = (wing: WingId, at: PlanPoint) =>
    setBombs((prev) =>
      prev[wing].some((b) => samePoint(b, at)) ? prev : { ...prev, [wing]: [...prev[wing], { id: nextBombId.current++, ...at, plantedAt: null }] },
    )
  const removeBomb = (wing: WingId, id: number) => setBombs((prev) => ({ ...prev, [wing]: prev[wing].filter((b) => b.id !== id) }))

  return {
    drafts,
    bombs,
    updateDraft,
    placeBomb,
    removeBomb,
    /** 置いてある爆弾を別のマス(別の棟でもよい)へ動かす */
    moveBomb(from: WingId, id: number, to: WingId, at: PlanPoint) {
      const bomb = bombs[from].find((b) => b.id === id)
      if (!bomb || bombs[to].some((b) => b.id !== id && samePoint(b, at))) return
      removeBomb(from, id)
      setBombs((prev) => ({ ...prev, [to]: [...prev[to], { ...bomb, ...at }] }))
    },
    /** 下書きのある棟の仲間に、道順を送る。線どおりに進めなくなったところで止まる */
    send(floorIds: Record<WingId, string[]>): PlanSent[] {
      const sent: PlanSent[] = []
      for (const wing of WING_IDS) {
        const { points } = drafts[wing]
        if (points.length < 2) continue
        const orders = draftOrders(points)
        const result = sims[wing].exec(orders.join(' '), true)

        // 通ったマスにある爆弾を設置する(仲間がそこに着いた時点で表示が変わる)
        const reached = [{ floor: points[0].floor, x: points[0].x + 0.5, y: points[0].y + 0.5, rise: 0 }, ...result.route]
        let planted = 0
        const nextBombs = bombs[wing].map((b) => {
          if (b.plantedAt !== null) return b
          const i = reached.findIndex((p) => p.rise === 0 && p.floor === b.floor && p.x === b.x + 0.5 && p.y === b.y + 0.5)
          if (i < 0) return b
          planted++
          return { ...b, plantedAt: result.trailStart + i - 1 }
        })
        setBombs((prev) => ({ ...prev, [wing]: nextBombs }))
        const left = nextBombs.filter((b) => b.plantedAt === null).length

        const { cells, floors } = draftSummary(points, floorIds[wing])
        const lastReply = result.reply.split(' → ').pop() ?? ''
        const replies = [
          result.halted ? `${lastReply}…ここで止まる(${result.done} / ${orders.length})` : '了解、線のとおりに移動した',
          planted ? `爆弾を${planted}個設置した` : '',
          left ? `まだ置いていない爆弾が${left}個ある` : '',
        ]
        sent.push({
          wing,
          order: `経路 ${cells}マス (${floors})${bombs[wing].some((b) => b.plantedAt === null) ? ' / 爆弾' : ''}`,
          reply: replies.filter(Boolean).join('。'),
        })
      }
      return sent
    },
    /** 仲間をスタート地点に戻し、下書き・爆弾も消す */
    reset(wing: WingId) {
      sims[wing].reset()
      setBombs((prev) => ({ ...prev, [wing]: [] }))
    },
  }
}

export type Plans = ReturnType<typeof usePlans>
