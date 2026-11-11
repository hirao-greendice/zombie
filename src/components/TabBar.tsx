export type TabId = 'map' | 'comms' | 'hack'

export const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: 'map', label: 'MAP', sub: 'マップ・指示' },
  { id: 'comms', label: '通信履歴', sub: 'COMMS LOG' },
  { id: 'hack', label: 'ハッキング', sub: 'HACKING' },
]

interface Props {
  tab: TabId
  onChange(tab: TabId): void
  /** タブごとの未読バッジ */
  badges?: Partial<Record<TabId, boolean>>
}

export function TabBar({ tab, onChange, badges = {} }: Props) {
  return (
    <nav className="tab-bar">
      {TABS.map((t) => (
        <button key={t.id} className={`tab-btn ${tab === t.id ? 'is-active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          <small>{t.sub}</small>
          {badges[t.id] && <span className="tab-badge">NEW</span>}
        </button>
      ))}
    </nav>
  )
}
