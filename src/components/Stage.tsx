import { useEffect, useState, type ReactNode } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config'

/**
 * 1920x1200 を最小サイズとして、画面がそれより横長なら横に、縦長なら縦に広げる。
 * 拡大率は「1920x1200 がちょうど収まる倍率」なので、どの画面でも黒帯なしで全面を使う
 */
function fit() {
  const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)
  return { scale, width: window.innerWidth / scale, height: window.innerHeight / scale }
}

export function Stage({ children }: { children: ReactNode }) {
  const [{ scale, width, height }, setFit] = useState(fit)

  useEffect(() => {
    const onResize = () => setFit(fit())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="stage-viewport">
      <div className="stage" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
        <div className="fx-scanlines" />
        <div className="fx-vignette" />
      </div>
    </div>
  )
}
