import { useEffect, useRef, useState } from 'react'
import { COMMS_EMOJI, COMMS_STEPS } from '../comms/steps'
import type { Comms } from '../comms/useComms'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config'

const MONITOR = { x: 40, y: 150, w: 1240, h: 698 }

const clock = (t: number) => new Date(t).toLocaleTimeString('ja-JP', { hour12: false })
const pad = (n: number) => String(n).padStart(2, '0')

interface Props {
  comms: Comms
  /** 表示中のタブかどうか(表示中に見た通信だけ既読にする) */
  active: boolean
}

export function CommsScreen({ comms, active }: Props) {
  const [selected, setSelected] = useState(comms.unlocked)
  const [incoming, setIncoming] = useState(false)
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const lastUnlocked = useRef(comms.unlocked)

  // 新しい通信が届いたら、それを選んで「INCOMING」演出
  useEffect(() => {
    if (comms.unlocked > lastUnlocked.current) {
      setSelected(comms.unlocked)
      setIncoming(true)
      const id = setTimeout(() => setIncoming(false), 2600)
      lastUnlocked.current = comms.unlocked
      return () => clearTimeout(id)
    }
    lastUnlocked.current = comms.unlocked
    if (selected > comms.unlocked) setSelected(comms.unlocked)
  }, [comms.unlocked])

  useEffect(() => {
    if (active) comms.markSeen(selected)
  }, [active, selected])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [comms.messages.length, active])

  const send = () => {
    comms.send(draft)
    setDraft('')
  }

  const step = COMMS_STEPS[selected - 1]

  return (
    <div className="screen comms-screen">
      <svg className="layer" viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} width={STAGE_WIDTH} height={STAGE_HEIGHT}>
        <g className="line">
          <path d="M40 60H700l30 30H1880" className="dim" />
          <path d="M40 120H1880" className="dim" />
          <path d={`M${MONITOR.x} ${MONITOR.y + 60}V${MONITOR.y}H${MONITOR.x + 60}`} />
          <path d={`M${MONITOR.x + MONITOR.w - 60} ${MONITOR.y}H${MONITOR.x + MONITOR.w}V${MONITOR.y + 60}`} />
          <path d={`M${MONITOR.x} ${MONITOR.y + MONITOR.h - 60}V${MONITOR.y + MONITOR.h}H${MONITOR.x + 60}`} />
          <path d={`M${MONITOR.x + MONITOR.w - 60} ${MONITOR.y + MONITOR.h}H${MONITOR.x + MONITOR.w}V${MONITOR.y + MONITOR.h - 60}`} />
        </g>
      </svg>

      <header className="map-header">
        <div className="map-title">
          <span className="map-title-main">COMMS</span>
          <span className="map-title-sub">// FIELD LINK</span>
        </div>
      </header>

      <div className="comms-monitor" style={{ left: MONITOR.x, top: MONITOR.y, width: MONITOR.w, height: MONITOR.h }}>
        <VideoMonitor key={selected} src={step.video} />
        <div className="comms-monitor-hud">
          <span className="rec">● REC</span>
          <span>
            CH-{pad(selected)} / {step.title}
          </span>
        </div>
        {incoming && (
          <div className="comms-incoming">
            <div className="comms-incoming-text">INCOMING TRANSMISSION</div>
            <div className="comms-incoming-sub">{step.title}</div>
          </div>
        )}
      </div>

      <div className="comms-steps">
        {COMMS_STEPS.map((s, i) => {
          const n = i + 1
          const locked = n > comms.unlocked
          const isNew = !locked && n > comms.seen
          return (
            <button
              key={n}
              className={`comms-step ${selected === n ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
              disabled={locked}
              onClick={() => setSelected(n)}
            >
              <span className="comms-step-no">{pad(n)}</span>
              <span className="comms-step-title">{locked ? '■■■■■■' : s.title}</span>
              <span className={`comms-step-state ${isNew ? 'new' : ''}`}>{locked ? 'ENCRYPTED' : isNew ? 'NEW' : 'RECEIVED'}</span>
            </button>
          )
        })}
      </div>

      <aside className="comms-panel">
        <div className="panel-heading">
          TRANSMIT LOG <span className="comms-progress">{comms.unlocked} / {comms.total}</span>
        </div>
        <div className="comms-log" ref={logRef}>
          {comms.messages.map((m) => (
            <div key={m.id} className={`comms-msg comms-msg--${m.from}`}>
              <span className="comms-msg-time">{clock(m.time)}</span>
              <span className="comms-msg-text">{m.from === 'system' ? `▼ ${m.text}` : m.text}</span>
            </div>
          ))}
        </div>

        <div className="panel-heading">SEND ORDER</div>
        <div className="comms-emoji">
          {COMMS_EMOJI.map((e) => (
            <button key={e} onClick={() => setDraft(draft + e)}>
              {e}
            </button>
          ))}
        </div>
        <div className="comms-input">
          <input
            value={draft}
            placeholder="指示を入力..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
          />
          <button className="comms-clear" onClick={() => setDraft('')} disabled={!draft}>
            ✕
          </button>
        </div>
        <button className="comms-send" onClick={send} disabled={!draft.trim()}>
          SEND ▶
        </button>
      </aside>
    </div>
  )
}

/** 映像の再生。ファイルが無い・読めないときは砂嵐の NO SIGNAL を出す */
function VideoMonitor({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)

  const toggle = () => {
    const v = videoRef.current
    if (!v || failed) return
    if (v.paused) v.play().catch(() => setFailed(true))
    else v.pause()
  }

  return (
    <div className="comms-video" onClick={toggle}>
      {!failed && (
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
      {failed ? (
        <>
          <Noise />
          <div className="comms-nosignal">
            <div>NO SIGNAL</div>
            <small>映像ファイル未配置: public{src}</small>
          </div>
        </>
      ) : (
        !playing && <div className="comms-play">▶ PLAY</div>
      )}
    </div>
  )
}

/** 砂嵐 */
function Noise() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(canvas.width, canvas.height)
    let raf = 0
    let frame = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (frame++ % 3) return
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 90
        d[i] = v * 0.6
        d[i + 1] = v
        d[i + 2] = v * 0.75
        d[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="comms-noise" width={240} height={135} />
}
