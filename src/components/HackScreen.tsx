import { useState } from 'react'
import { DOOR_KEYS } from '../hack/doorKeys'

type ToolId = 'door' | 'crypto' | 'camera'

const TOOLS: { id: ToolId; no: number; label: string; sub: string }[] = [
  { id: 'door', no: 1, label: '扉の開閉', sub: 'DOOR CONTROL' },
  { id: 'crypto', no: 2, label: '暗号復元', sub: 'DATA RECOVERY' },
  { id: 'camera', no: 3, label: '監視カメラ', sub: 'SURVEILLANCE' },
]

/** 記号を絵文字ではなく文字として描かせる */
const asText = (icon: string) => icon + '︎'

// ハッキングタブ: 3 つの機能を選び、それぞれの画面に入る
export function HackScreen() {
  const [tool, setTool] = useState<ToolId | null>(null)
  const current = TOOLS.find((t) => t.id === tool)

  return (
    <div className="screen layout layout--hack">
      <header className="screen-header">
        <div className="map-title">
          <span className="map-title-main">HACKING</span>
          <span className="map-title-sub">// {current ? `機能${current.no} ${current.label}` : 'SELECT TOOL'}</span>
        </div>
        {current && (
          <button className="panel-btn hack-back" onClick={() => setTool(null)}>
            ◀ 機能の選択へ
          </button>
        )}
      </header>

      <div className="layout-main hack-main">
        {!current && (
          <div className="hack-tools">
            {TOOLS.map((t) => (
              <button key={t.id} className="panel-btn hack-tool" onClick={() => setTool(t.id)}>
                <small>機能 {t.no}</small>
                <span className="hack-tool-label">{t.label}</span>
                <small>{t.sub}</small>
              </button>
            ))}
          </div>
        )}
        {tool === 'door' && <DoorControl />}
        {(tool === 'crypto' || tool === 'camera') && (
          <div className="hack-offline hud-frame">
            <span className="blink">NO SIGNAL</span>
            <small>この機能は準備中です</small>
          </div>
        )}
      </div>
    </div>
  )
}

/** 扉の開閉: アイコンのキーボード(4x8)。押したキーの問題を上に出す */
function DoorControl() {
  const [selected, setSelected] = useState<number | null>(null)
  const key = selected === null ? null : DOOR_KEYS[selected]

  return (
    <div className="door-control">
      <div className="door-question hud-frame">
        {key ? (
          <>
            <div className="door-question-head">
              <span className="door-question-icon">{asText(key.icon)}</span>
              <span>
                KEY {String(selected! + 1).padStart(2, '0')} / {key.name}
              </span>
            </div>
            <p className="door-question-body">{key.question ?? '問題は準備中です'}</p>
          </>
        ) : (
          <p className="door-question-empty">キーを押すと、そのキーの問題が表示されます</p>
        )}
      </div>
      <div className="door-keys">
        {DOOR_KEYS.map((k, i) => (
          <button key={i} className={`door-key ${selected === i ? 'is-active' : ''}`} onClick={() => setSelected(i)}>
            {asText(k.icon)}
          </button>
        ))}
      </div>
    </div>
  )
}
