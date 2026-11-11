// ハッキング「扉の開閉」のキーボード(4 段 x 8 列)。キーを押すと、そのキー専用の問題が出る。
// 並びは上の段の左から順。question を書き換えれば問題が変わる

export interface DoorKey {
  /** キーに描く記号(絵文字にならないよう、表示時に文字として描く指定を付ける) */
  icon: string
  name: string
  /** このキーを押したときに出す問題。未設定なら「準備中」 */
  question?: string
}

const ICONS: [string, string][] = [
  ['☢', 'RADIATION'], ['☣', 'BIOHAZARD'], ['⚡', 'POWER'], ['☠', 'SKULL'], ['✚', 'MEDIC'], ['✖', 'CROSS'], ['◆', 'DIAMOND'], ['●', 'CIRCLE'],
  ['▲', 'TRIANGLE'], ['■', 'SQUARE'], ['★', 'STAR'], ['☾', 'MOON'], ['☀', 'SUN'], ['♠', 'SPADE'], ['♣', 'CLUB'], ['♥', 'HEART'],
  ['♦', 'DIA'], ['♪', 'NOTE'], ['⚙', 'GEAR'], ['⚑', 'FLAG'], ['⌘', 'COMMAND'], ['☎', 'PHONE'], ['✉', 'MAIL'], ['⌛', 'TIME'],
  ['☂', 'UMBRELLA'], ['✈', 'PLANE'], ['⚓', 'ANCHOR'], ['♞', 'KNIGHT'], ['☯', 'BALANCE'], ['⚖', 'SCALE'], ['✿', 'FLOWER'], ['❄', 'ICE'],
]

export const DOOR_KEYS: DoorKey[] = ICONS.map(([icon, name]) => ({ icon, name }))
