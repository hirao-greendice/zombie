export type TabId = 'map' | 'comms'

const TABS: { id: TabId; label: string }[] = [
  { id: 'map', label: 'MAP' },
  { id: 'comms', label: 'COMMS' },
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
          {badges[t.id] && <span className="tab-badge">NEW</span>}
        </button>
      ))}
    </nav>
  )
}
