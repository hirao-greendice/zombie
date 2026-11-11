import type { PointerEvent as ReactPointerEvent } from 'react'
import { BombIcon } from '../plan/BombIcon'

interface Props {
  /** 平面図(2D)を表示しているか。3D のときは線を描けない */
  planMode: boolean
  /** 爆弾のアイコンを押した(ここからドラッグが始まる) */
  onBombDown(e: ReactPointerEvent): void
  /** 描いた線のマス数(送れる棟の合計) */
  draftCells: number
  canUndo: boolean
  onUndo(): void
  onClear(): void
  onSend(): void
}

/** 右のパネルの下に置く、仲間への指示(爆弾・線の取り消し・送信) */
export function OrderBar(p: Props) {
  return (
    <div className="order-panel">
      {!p.planMode && <p className="order-hint">「平面」にすると線を引けます</p>}
      <button className="order-bomb" onPointerDown={p.onBombDown} disabled={!p.planMode}>
        <BombIcon px={56} />
        爆弾
      </button>
      <div className="order-edit">
        <button className="side-btn" onClick={p.onUndo} disabled={!p.canUndo}>
          1つ戻す
        </button>
        <button className="side-btn" onClick={p.onClear} disabled={!p.draftCells}>
          線を消す
        </button>
      </div>
      <button className="order-send" onClick={p.onSend} disabled={!p.draftCells}>
        送信 ▶<small>{p.draftCells ? `${p.draftCells}マス` : '線を引いてください'}</small>
      </button>
    </div>
  )
}
