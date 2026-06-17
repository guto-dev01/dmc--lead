import { useState } from 'react'
import { Scale } from 'lucide-react'
import type { Tab } from './types'
import TabNav from './components/TabNav'
import GptsDirectory from './components/GptsDirectory'
import ChatPlaceholder from './components/ChatPlaceholder'
import Dashboard from './components/Dashboard'

export default function App() {
  const [tab, setTab] = useState<Tab>('gpts')

  return (
    <div className="min-h-screen">
      {/* Cabeçalho fixo com as abas */}
      <header className="sticky top-0 z-20 border-b border-neon bg-teal-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-gradient text-teal-bg shadow-glow-cyan">
              <Scale size={20} strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] font-bold text-white">
                Assistentes Jurídicos <span className="text-gradient">IA</span>
              </h1>
              <p className="text-[11px] text-ink-muted/60">
                Direito Brasileiro · powered by ImobPro
              </p>
            </div>
          </div>
          <TabNav active={tab} onChange={setTab} />
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {tab === 'gpts' && (
          <>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Encontre o assistente jurídico ideal
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted/80">
                Uma coleção de GPTs especializados em Direito Brasileiro — peças,
                jurisprudência, contratos, estratégia e muito mais. Clique para
                abrir diretamente no ChatGPT.
              </p>
            </div>
            <GptsDirectory />
          </>
        )}
        {tab === 'chat' && <ChatPlaceholder />}
        {tab === 'dashboard' && <Dashboard />}
      </main>

      {/* Rodapé */}
      <footer className="border-t border-neon/60 py-6">
        <p className="mx-auto max-w-6xl px-4 text-center text-[11.5px] text-ink-muted/50">
          As respostas geradas pelos assistentes são <strong>minutas</strong> e
          devem ser revisadas por um profissional habilitado antes de qualquer uso
          oficial. Não substituem a análise do advogado.
        </p>
      </footer>
    </div>
  )
}
