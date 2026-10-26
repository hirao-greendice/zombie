import { useEffect, useState } from 'react'
import type { Comms } from '../comms/useComms'

/** スタッフ用の進行操作。G キー or 右上を3回タップで表示切替 */
export function GmPanel({ comms }: { comms: Comms }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'g' && !(e.target instanceof HTMLInputElement)) setVisible((v) => !v)
    }
    let taps: number[] = []
    const onPointer = (e: PointerEvent) => {
      if (e.clientX < window.innerWidth - 120 || e.clientY > 120) return
      const now = performance.now()
      taps = [...taps.filter((t) => now - t < 600), now]
      if (taps.length >= 3) {
        setVisible((v) => !v)
        taps = []
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  if (!visible) return null
  return (
    <div className="gm-panel">
      <div>GM / COMMS STEP {comms.unlocked} / {comms.total}</div>
      <div className="gm-buttons">
        <button onClick={comms.prev} disabled={comms.unlocked <= 1}>◀ PREV</button>
        <button onClick={comms.next} disabled={comms.unlocked >= comms.total}>NEXT ▶</button>
        <button onClick={() => confirm('通信の進行とログを最初に戻しますか?') && comms.reset()}>RESET</button>
        <button onClick={() => setVisible(false)}>CLOSE</button>
      </div>
    </div>
  )
}
