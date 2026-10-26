import type { Dir } from './nav'

/** 送られた指示を読み取った結果 */
export type Order =
  | { kind: 'move'; dir: Dir; count: number | null }
  | { kind: 'up' }
  | { kind: 'down' }
  | { kind: 'back' }
  | { kind: 'wait' }

// 同じ位置で複数当てはまるときは、先に書いたものが優先される(「上る」を方向の「上」より先に)
const TOKEN = new RegExp(
  [
    '(?<down>(?:降|下|お)りる|下の階|⏬|🔽)',
    '(?<up>(?:上|登|のぼ)る|上の階|屋上|⏫|🔼)',
    '(?<back>戻|もど|↩)',
    '(?<wait>🛑|止|待)',
    '(?<n>⬆|↑|上|北)',
    '(?<s>⬇|↓|下|南)',
    '(?<w>⬅|←|左|西)',
    '(?<e>➡|→|右|東)',
  ].join('|'),
  'gu',
)
// 絵文字の後ろに付く見えない記号(U+FE0F)を読み飛ばしてから数字を探す
const COUNT = /^[️\s]*[x×]?\s*(\d+)/u

/** 指示の文から、動きの命令を順番に取り出す */
export function parseOrders(text: string): Order[] {
  const src = text.normalize('NFKC')
  const orders: Order[] = []
  for (const m of src.matchAll(TOKEN)) {
    const g = m.groups!
    if (g.down) orders.push({ kind: 'down' })
    else if (g.up) orders.push({ kind: 'up' })
    else if (g.back) orders.push({ kind: 'back' })
    else if (g.wait) orders.push({ kind: 'wait' })
    else {
      const dir = (['n', 's', 'w', 'e'] as const).find((d) => g[d])!
      const count = src.slice(m.index! + m[0].length).match(COUNT)
      orders.push({ kind: 'move', dir, count: count ? Number(count[1]) : null })
    }
  }
  // 「階段」だけ書かれていたら上る
  if (orders.length === 0 && src.includes('階段')) orders.push({ kind: 'up' })
  return mergeRepeats(orders)
}

/** 数字なしの同じ方向が続いたら、続いた数だけマスを進む(⬆️⬆️⬆️ = 北へ3マス) */
function mergeRepeats(orders: Order[]): Order[] {
  const merged: Order[] = []
  let i = 0
  while (i < orders.length) {
    const o = orders[i]
    let j = i + 1
    if (o.kind === 'move' && o.count === null) {
      while (j < orders.length) {
        const n = orders[j]
        if (n.kind !== 'move' || n.dir !== o.dir || n.count !== null) break
        j++
      }
    }
    merged.push(j - i > 1 && o.kind === 'move' ? { ...o, count: j - i } : o)
    i = j
  }
  return merged
}
