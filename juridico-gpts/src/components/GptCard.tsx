import { ArrowUpRight } from 'lucide-react'
import type { Gpt } from '../types'
import { categoryStyle } from '../lib/categoryStyle'

export default function GptCard({ gpt }: { gpt: Gpt }) {
  const style = categoryStyle(gpt.categoria)

  return (
    <a
      href={gpt.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex h-full flex-col gap-3 rounded-2xl border border-neon bg-teal-surface/70 p-5 shadow-card backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-neon-strong hover:shadow-card-lg"
    >
      {/* Badge de categoria */}
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border ${style.border} ${style.bg} px-2.5 py-1 text-[11px] font-medium ${style.text}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {gpt.categoria}
      </span>

      {/* Nome */}
      <h3 className="text-[15px] font-semibold leading-snug text-white transition-colors group-hover:text-[#12e7ff]">
        {gpt.nome}
      </h3>

      {/* Descrição */}
      <p className="line-clamp-4 flex-1 text-[13px] leading-relaxed text-ink-muted/85">
        {gpt.descricao}
      </p>

      {/* Ação */}
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-[12px] font-medium text-ink-muted/70">
          Abrir no ChatGPT
        </span>
        <span className="flex items-center gap-1 rounded-full bg-neon-gradient px-3 py-1.5 text-[12px] font-semibold text-teal-bg shadow-glow-cyan transition-transform group-hover:scale-105">
          Acessar
          <ArrowUpRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </a>
  )
}
