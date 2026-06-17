import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { gpts as allGpts, categorias } from '../data/gpts'
import GptCard from './GptCard'

export default function GptsDirectory() {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('Todas')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return allGpts.filter((g) => {
      const okCategoria = categoria === 'Todas' || g.categoria === categoria
      const okBusca =
        termo === '' ||
        g.nome.toLowerCase().includes(termo) ||
        g.descricao.toLowerCase().includes(termo)
      return okCategoria && okBusca
    })
  }, [busca, categoria])

  // Contagem por categoria (para o selo nas pills)
  const contagem = useMemo(() => {
    const map: Record<string, number> = { Todas: allGpts.length }
    for (const g of allGpts) map[g.categoria] = (map[g.categoria] ?? 0) + 1
    return map
  }, [])

  return (
    <div className="animate-fade-in">
      {/* Busca */}
      <div className="relative mx-auto mb-6 max-w-2xl">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted/60"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar assistente por nome ou descrição..."
          className="w-full rounded-full border border-neon bg-teal-surface/60 py-3.5 pl-12 pr-12 text-sm text-white placeholder:text-ink-muted/50 backdrop-blur transition-colors focus:border-neon-strong"
          aria-label="Buscar assistentes"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted/60 hover:text-white"
            aria-label="Limpar busca"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filtros por categoria (pills) */}
      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {categorias.map((cat) => {
          const isActive = categoria === cat
          return (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={[
                'rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-200',
                isActive
                  ? 'border-transparent bg-neon-gradient text-teal-bg shadow-glow-cyan'
                  : 'border-neon bg-teal-surface/50 text-ink-muted hover:border-neon-strong hover:text-white',
              ].join(' ')}
            >
              {cat}
              <span
                className={[
                  'ml-1.5 text-[11px]',
                  isActive ? 'text-teal-bg/70' : 'text-ink-muted/50',
                ].join(' ')}
              >
                {contagem[cat] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Contador de resultados */}
      <p className="mb-5 text-center text-[13px] text-ink-muted/70">
        Exibindo{' '}
        <span className="font-semibold text-[#12e7ff]">{filtrados.length}</span>{' '}
        {filtrados.length === 1 ? 'assistente' : 'assistentes'}
        {categoria !== 'Todas' && (
          <>
            {' '}
            em <span className="font-medium text-white">{categoria}</span>
          </>
        )}
      </p>

      {/* Grid de cards */}
      {filtrados.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((gpt) => (
            <GptCard key={gpt.url} gpt={gpt} />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-md rounded-2xl border border-neon bg-teal-surface/50 p-10 text-center">
          <p className="text-sm text-ink-muted">
            Nenhum assistente encontrado para{' '}
            <span className="font-semibold text-white">"{busca}"</span>.
          </p>
          <button
            onClick={() => {
              setBusca('')
              setCategoria('Todas')
            }}
            className="mt-4 rounded-full border border-neon px-4 py-2 text-[13px] font-medium text-[#12e7ff] hover:border-neon-strong"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  )
}
