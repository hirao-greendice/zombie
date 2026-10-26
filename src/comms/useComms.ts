import { useEffect, useState } from 'react'
import { COMMS_STEPS } from './steps'

export interface CommsMessage {
  id: number
  from: 'me' | 'system'
  text: string
  time: number
}

interface CommsState {
  /** 届いている通信の数(1〜COMMS_STEPS.length) */
  unlocked: number
  /** 見た通信の数。unlocked より小さければ未読あり */
  seen: number
  messages: CommsMessage[]
}

const STORAGE_KEY = 'zombie-prison.comms.v1'
const TOTAL = COMMS_STEPS.length

const receivedMessage = (step: number, id: number): CommsMessage => ({
  id,
  from: 'system',
  text: `${COMMS_STEPS[step - 1].title} RECEIVED`,
  time: Date.now(),
})

/** step 件目まで届いている状態 */
const initialState = (step = 1): CommsState => ({
  unlocked: step,
  seen: 0,
  messages: Array.from({ length: step }, (_, i) => receivedMessage(i + 1, i + 1)),
})

function load(): CommsState {
  // ?step=3 で進行を指定して開ける(確認用)
  const forced = Number(new URLSearchParams(location.search).get('step'))
  if (forced >= 1 && forced <= TOTAL) return initialState(forced)
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CommsState | null
    if (saved && saved.unlocked >= 1 && Array.isArray(saved.messages)) return saved
  } catch {
    // 保存データが読めないときは最初から
  }
  return initialState()
}

const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '')

/** 通信タブの進行状況と送信ログ。ブラウザに保存するので再読み込みしても続きから */
export function useComms() {
  const [state, setState] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 保存できない環境(プライベートモード等)でも動作は続ける
    }
  }, [state])

  const unlockTo = (prev: CommsState, n: number): CommsState => {
    const unlocked = Math.min(Math.max(n, 1), TOTAL)
    const messages = [...prev.messages]
    for (let step = prev.unlocked + 1; step <= unlocked; step++) messages.push(receivedMessage(step, messages.length + 1))
    return { ...prev, unlocked, seen: Math.min(prev.seen, unlocked), messages }
  }

  return {
    ...state,
    total: TOTAL,
    hasNew: state.seen < state.unlocked,
    send(text: string) {
      const body = text.trim()
      if (!body) return
      setState((prev) => {
        const next = {
          ...prev,
          messages: [...prev.messages, { id: prev.messages.length + 1, from: 'me' as const, text: body, time: Date.now() }],
        }
        // 今の通信に正解の言葉が設定されていて、それが含まれていたら次の通信が届く
        const answers = COMMS_STEPS[prev.unlocked - 1].answers ?? []
        const hit = answers.some((a) => normalize(body).includes(normalize(a)))
        return hit ? unlockTo(next, prev.unlocked + 1) : next
      })
    },
    markSeen(step: number) {
      setState((prev) => (step > prev.seen ? { ...prev, seen: step } : prev))
    },
    next: () => setState((prev) => unlockTo(prev, prev.unlocked + 1)),
    prev: () => setState((prev) => ({ ...prev, unlocked: Math.max(prev.unlocked - 1, 1), seen: Math.min(prev.seen, Math.max(prev.unlocked - 1, 1)) })),
    reset: () => setState(initialState()),
  }
}

export type Comms = ReturnType<typeof useComms>
