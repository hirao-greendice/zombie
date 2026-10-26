import { useEffect, useState } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config'

function readInfo() {
  const dpr = window.devicePixelRatio
  return {
    viewport: `${window.innerWidth} x ${window.innerHeight}`,
    screen: `${screen.width} x ${screen.height}`,
    physical: `${Math.round(screen.width * dpr)} x ${Math.round(screen.height * dpr)}`,
    dpr,
    scale: Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT),
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}

/** 実機の画面サイズ確認用。D キー or 左上を3回タップで表示切替、F でフルスクリーン */
export function DevOverlay() {
  const [visible, setVisible] = useState(true)
  const [info, setInfo] = useState(readInfo)

  useEffect(() => {
    const onResize = () => setInfo(readInfo())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd') setVisible((v) => !v)
      if (e.key === 'f') toggleFullscreen()
    }
    let taps: number[] = []
    const onPointer = (e: PointerEvent) => {
      if (e.clientX > 120 || e.clientY > 120) return
      const now = performance.now()
      taps = [...taps.filter((t) => now - t < 600), now]
      if (taps.length >= 3) {
        setVisible((v) => !v)
        taps = []
      }
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  if (!visible) return null
  return (
    <div className="dev-overlay">
      {`STAGE    ${STAGE_WIDTH} x ${STAGE_HEIGHT}
VIEWPORT ${info.viewport} (css px)
SCREEN   ${info.screen} (css px)
PHYSICAL ${info.physical} (dpr ${info.dpr})
SCALE    ${info.scale.toFixed(3)}`}
      <br />
      <button onClick={toggleFullscreen}>FULLSCREEN</button>
    </div>
  )
}
