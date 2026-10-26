import { STAGE_HEIGHT, STAGE_WIDTH } from '../config'

const W = STAGE_WIDTH
const H = STAGE_HEIGHT

/** 動作確認用のサンプル画面。ワイヤーフレーム表現の素材(グリッド・ブラケット・回転リング)を一通り置いている */
export function BootScreen() {
  return (
    <div className="screen">
      <svg className="layer" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <defs>
          <pattern id="grid-s" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" className="grid-minor" />
          </pattern>
          <pattern id="grid-l" width="200" height="200" patternUnits="userSpaceOnUse">
            <rect width="200" height="200" fill="url(#grid-s)" />
            <path d="M200 0H0V200" className="grid-major" />
          </pattern>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={W} height={H} fill="url(#grid-l)" />

        {/* 外枠のコーナーブラケット */}
        <g className="line" filter="url(#glow)">
          <path d="M40 140V40H140" />
          <path d={`M${W - 140} 40H${W - 40}V140`} />
          <path d={`M40 ${H - 140}V${H - 40}H140`} />
          <path d={`M${W - 140} ${H - 40}H${W - 40}V${H - 140}`} />
        </g>

        {/* 中央の回転リング */}
        <g transform={`translate(${W / 2} ${H / 2 - 40})`} className="line" filter="url(#glow)">
          <circle r="260" className="dim" />
          <g className="spin-slow">
            <circle r="220" strokeDasharray="4 12" />
          </g>
          <g className="spin-rev">
            <circle r="180" strokeDasharray="120 40 20 40" />
          </g>
          <circle r="140" className="dim" />
          {Array.from({ length: 36 }, (_, i) => (
            <line key={i} x1="0" y1={-260} x2="0" y2={i % 3 ? -248 : -236} transform={`rotate(${i * 10})`} />
          ))}
        </g>

        {/* ハザード帯 */}
        <g className="line danger">
          <path d={`M${W / 2 - 420} ${H - 230}H${W / 2 + 420}`} />
          {Array.from({ length: 21 }, (_, i) => (
            <path key={i} d={`M${W / 2 - 420 + i * 40} ${H - 210}l20 -20`} />
          ))}
        </g>
      </svg>

      <div className="title-block">
        <div className="title-sub">CONTAINMENT FACILITY // SECTOR 07</div>
        <h1 className="title glitch" data-text="ZOMBIE PRISON">ZOMBIE PRISON</h1>
        <div className="title-sub blink">&gt; SYSTEM BOOT ... STANDBY_</div>
      </div>
    </div>
  )
}
