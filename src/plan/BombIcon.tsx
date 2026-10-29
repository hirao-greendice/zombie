/** 爆弾のアイコン(SVG の中に置く。中心が原点、size = 直径の目安) */
export function BombGlyph({ size = 1, planted = false }: { size?: number; planted?: boolean }) {
  const r = size * 0.32
  return (
    <g className={`bomb-glyph ${planted ? 'is-planted' : ''}`}>
      <circle r={r} cx={-size * 0.04} cy={size * 0.08} />
      <rect x={r * 0.35} y={-r * 0.95} width={r * 0.5} height={r * 0.4} transform={`rotate(40 ${r * 0.6} ${-r * 0.75})`} />
      <path d={`M ${r * 0.75} ${-r * 0.95} q ${r * 0.35} ${-r * 0.55} ${r * 0.85} ${-r * 0.35}`} className="bomb-fuse" />
      <circle className="bomb-spark" r={r * 0.22} cx={r * 1.6} cy={-r * 1.3} />
    </g>
  )
}

/** ボタンやドラッグ中に表示する、単独の爆弾アイコン */
export function BombIcon({ px = 64 }: { px?: number }) {
  return (
    <svg className="bomb-icon" width={px} height={px} viewBox="-0.55 -0.55 1.1 1.1">
      <BombGlyph />
    </svg>
  )
}
