import { Scale, MessageSquare, LayoutDashboard } from 'lucide-react'
import type { Tab } from '../types'

const TABS: { id: Tab; label: string; icon: typeof Scale }[] = [
  { id: 'gpts', label: 'GPTs Jurídicos', icon: Scale },
  { id: 'chat', label: 'Chat IA', icon: MessageSquare },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export default function TabNav({ active, onChange }: Props) {
  return (
    <nav
      className="flex items-center gap-1 rounded-full border border-neon bg-teal-surface/60 p-1 backdrop-blur"
      role="tablist"
      aria-label="Seções do sistema"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={[
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-neon-gradient text-teal-bg shadow-glow-cyan'
                : 'text-ink-muted hover:bg-white/5 hover:text-white',
            ].join(' ')}
          >
            <Icon size={16} strokeWidth={2.2} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
