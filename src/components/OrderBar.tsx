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
  onReplay(): void
  onResetAlly(): void
  onLoadDemo(): void
  showTrail: boolean
  onShowTrailChange(show: boolean): void
}

/** マップの下に置く、仲間への指示のパネル */
export function OrderBar(p: Props) {
  return (
    <div className="order-bar">
      <button className="order-bomb" onPointerDown={p.onBombDown} disabled={!p.planMode} title="平面図のマスへドラッグして置く">
        <BombIcon px={64} />
        <span>
          爆弾
          <small>ドラッグして置く</small>
        </span>
      </button>

      <div className="order-help">
        {p.planMode ? (
          <>
            <b>線を引く:</b> 仲間(白い丸)から指でなぞる。階段の中で指を止めると上の階へ続く。表示する階は立体と同じく右の FLOORS で選ぶ
          </>
        ) : (
          <>立体表示では線を引けません。上の「平面」に切り替えてください</>
        )}
      </div>

      <div className="sim-group">
        <button className="sim-btn" onClick={p.onUndo} disabled={!p.canUndo}>
          1つ戻す
        </button>
        <button className="sim-btn" onClick={p.onClear} disabled={!p.draftCells}>
          線を消す
        </button>
      </div>

      <button className="order-send" onClick={p.onSend} disabled={!p.draftCells}>
        送信 ▶<small>{p.draftCells ? `${p.draftCells}マス` : '線を引いてください'}</small>
      </button>

      <div className="sim-sep" />

      <div className="sim-group">
        <button className="sim-btn sim-btn--replay" onClick={p.onReplay}>
          ▶ リプレイ
        </button>
        <button className="sim-btn" onClick={p.onResetAlly} title="仲間をスタート地点に戻し、軌跡と爆弾も消す">
          ⟲
        </button>
        <button className="sim-btn" onClick={p.onLoadDemo} title="建物を一通り歩くデモの道順に戻す">
          デモ
        </button>
        <button className={`sim-btn sim-btn--mode ${p.showTrail ? 'is-active' : ''}`} onClick={() => p.onShowTrailChange(!p.showTrail)}>
          軌跡
        </button>
      </div>
    </div>
  )
}
