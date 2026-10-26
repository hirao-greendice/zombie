import { useEffect, useState, type ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config'

function fitScale() {
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)
}

/** 1920x1200 の固定キャンバスを、画面に収まるよう中央寄せで拡大縮小する */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fitScale)

  useEffect(() => {
    const onResize = () => setScale(fitScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="stage-viewport">
      <div
        className="stage"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
      >
        {children}
        <div className="fx-scanlines" />
        <div className="fx-vignette" />
      </div>
    </div>
  )
}
