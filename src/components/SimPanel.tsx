import { useState } from 'react'

// 指示の出し方が決まるまでの仮の操作ボタン。押すと指示文を作って送る
const ARROWS = [
  { icon: '⬅️', label: '←' },
  { icon: '⬆️', label: '↑' },
  { icon: '⬇️', label: '↓' },
  { icon: '➡️', label: '→' },
]
const ACTIONS = [
  { order: '上る', label: '上る' },
  { order: '降りる', label: '降りる' },
  { order: '戻れ', label: '戻る' },
]

interface Props {
  onSend(text: string): void
  onResetAlly(): void
  /** これまでの動きを最初から再生する */
  onReplay(): void
  /** 建物を一通り歩くデモの道順に戻す */
  onLoadDemo(): void
  showTrail: boolean
  onShowTrailChange(show: boolean): void
}

/** マップの下に置く、仲間への指示を試す操作パネル */
export function SimPanel({ onSend, onResetAlly, onReplay, onLoadDemo, showTrail, onShowTrailChange }: Props) {
  /** step = 1マスずつ / run = 壁まで */
  const [mode, setMode] = useState<'step' | 'run'>('step')
  const [text, setText] = useState('')

  const sendText = () => {
    onSend(text)
    setText('')
  }

  return (
    <div className="sim-panel">
      <div className="sim-group">
        {ARROWS.map((a) => (
          <button key={a.icon} className="sim-btn sim-btn--arrow" onClick={() => onSend(mode === 'step' ? `${a.icon}1` : a.icon)}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="sim-group">
        <button className={`sim-btn sim-btn--mode ${mode === 'step' ? 'is-active' : ''}`} onClick={() => setMode('step')}>
          1マス
        </button>
        <button className={`sim-btn sim-btn--mode ${mode === 'run' ? 'is-active' : ''}`} onClick={() => setMode('run')}>
          壁まで
        </button>
      </div>

      <div className="sim-sep" />

      <div className="sim-group">
        {ACTIONS.map((a) => (
          <button key={a.order} className="sim-btn" onClick={() => onSend(a.order)}>
            {a.label}
          </button>
        ))}
        <button className="sim-btn" onClick={onResetAlly} title="仲間をスタート地点に戻し、軌跡も消す">
          ⟲
        </button>
      </div>

      <div className="sim-sep" />

      <div className="sim-group">
        <button className="sim-btn sim-btn--replay" onClick={onReplay}>
          ▶ リプレイ
        </button>
        <button className="sim-btn" onClick={onLoadDemo} title="建物を一通り歩くデモの道順に戻す">
          デモ
        </button>
        <button className={`sim-btn sim-btn--mode ${showTrail ? 'is-active' : ''}`} onClick={() => onShowTrailChange(!showTrail)}>
          軌跡
        </button>
      </div>

      <div className="sim-sep" />

      <div className="sim-input">
        <input
          value={text}
          placeholder="自由入力(例: ⬆️3 ➡️ 上る)"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && sendText()}
        />
        <button className="sim-btn" onClick={sendText} disabled={!text.trim()}>
          送信
        </button>
      </div>
    </div>
  )
}
