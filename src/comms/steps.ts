// 仲間から届く通信(映像)の一覧。上から順に、進行に合わせて1件ずつ届く。
// 映像ファイルは public/comms/ に置く(例: public/comms/step01.mp4 → video: 'comms/step01.mp4')
// 先頭に / を付けない(GitHub Pages ではサイトが /zombie/ の下に置かれるため)

export interface CommsStep {
  title: string
  video: string
  /**
   * プレイヤーが送った指示にこの言葉のどれかが含まれていたら、次の通信が自動で届く。
   * 省略した場合はスタッフ操作(GM パネル)でのみ進む
   */
  answers?: string[]
}

export const COMMS_STEPS: CommsStep[] = [
  { title: 'TRANSMISSION 01', video: 'comms/step01.mp4' },
  { title: 'TRANSMISSION 02', video: 'comms/step02.mp4' },
  { title: 'TRANSMISSION 03', video: 'comms/step03.mp4' },
  { title: 'TRANSMISSION 04', video: 'comms/step04.mp4' },
  { title: 'TRANSMISSION 05', video: 'comms/step05.mp4' },
  { title: 'TRANSMISSION 06', video: 'comms/step06.mp4' },
  { title: 'TRANSMISSION 07', video: 'comms/step07.mp4' },
]

/** こちらから送れる絵文字 */
export const COMMS_EMOJI = ['⬆️', '⬇️', '⬅️', '➡️', '🛑', '🏃', '🤫', '✋', '🔑', '🚪', '🧟', '⚠️', '✅', '❌', '❓', '👍']
