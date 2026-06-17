import { useMemo } from 'react'
import { Layers, Sparkles, FolderTree } from 'lucide-react'
import { gpts as allGpts } from '../data/gpts'
import { categoryStyle } from '../lib/categoryStyle'

export default function Dashboard() {
  const porCategoria = useMemo(() => {
    const map: Record<string, number> = {}
    for (const g of allGpts) map[g.categoria] = (map[g.categoria] ?? 0) + 1
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [])

  const total = allGpts.length
  const maxCount = porCategoria[0]?.[1] ?? 1

  const stats = [
    { label: 'Assistentes', valor: total, icon: Sparkles },
    { label: 'Categorias', valor: porCategoria.length, icon: FolderTree },
    {
      label: 'Maior categoria',
      valor: porCategoria[0]?.[0] ?? '—',
      icon: Layers,
      pequeno: true,
    },
  ]

  return (
    <div className="animate-fade-in space-y-8">
      {/* Cartões de métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, valor, icon: Icon, pequeno }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-neon bg-teal-surface/70 p-5 shadow-card backdrop-blur"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neon-gradient text-teal-bg shadow-glow-cyan">
              <Icon size={22} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-wider text-ink-muted/60">
                {label}
              </p>
              <p
                className={[
                  'font-bold text-white',
                  pequeno ? 'truncate text-[15px] leading-tight' : 'text-3xl',
                ].join(' ')}
              >
                {valor}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Distribuição por categoria */}
      <div className="rounded-2xl border border-neon bg-teal-surface/60 p-6 shadow-card backdrop-blur">
        <h2 className="mb-5 text-[15px] font-semibold text-white">
          Distribuição por categoria
        </h2>
        <div className="space-y-3.5">
          {porCategoria.map(([cat, count]) => {
            const style = categoryStyle(cat)
            const pct = Math.round((count / maxCount) * 100)
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-52 shrink-0 truncate text-[13px] text-ink-muted">
                  {cat}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${style.dot} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[13px] font-semibold text-white">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
