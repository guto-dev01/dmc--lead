import { MessageSquare, Send, Lock } from 'lucide-react'

export default function ChatPlaceholder() {
  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <div className="rounded-2xl border border-neon bg-teal-surface/60 p-8 text-center shadow-card backdrop-blur">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-gradient text-teal-bg shadow-glow-cyan">
          <MessageSquare size={28} strokeWidth={2.2} />
        </div>
        <h2 className="text-xl font-bold text-white">Chat IA Jurídico</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted/85">
          Esta área está reservada para um assistente de chat jurídico integrado.
          A interface está pronta; falta apenas conectar um provedor de IA
          (Claude ou OpenAI) no backend.
        </p>

        {/* Prévia da interface (desabilitada) */}
        <div className="mt-7 space-y-3 text-left">
          <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-neon-gradient px-4 py-2.5 text-[13px] text-teal-bg">
            Quais documentos preciso para uma ação de cobrança?
          </div>
          <div className="w-fit max-w-[80%] rounded-2xl rounded-bl-sm border border-neon bg-white/5 px-4 py-2.5 text-[13px] text-ink-muted">
            <span className="inline-flex items-center gap-2">
              <Lock size={13} /> Conecte um provedor de IA para ativar as respostas.
            </span>
          </div>
        </div>

        {/* Caixa de envio (desabilitada) */}
        <div className="mt-6 flex items-center gap-2 rounded-full border border-neon bg-teal-bg/40 p-1.5 opacity-60">
          <input
            disabled
            placeholder="Digite sua dúvida jurídica..."
            className="flex-1 bg-transparent px-4 text-sm text-white placeholder:text-ink-muted/50 outline-none"
          />
          <button
            disabled
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neon-gradient text-teal-bg"
            aria-label="Enviar (desabilitado)"
          >
            <Send size={16} strokeWidth={2.4} />
          </button>
        </div>
        <p className="mt-3 text-[11px] text-ink-muted/50">
          Enquanto isso, use a aba <strong className="text-ink-muted">GPTs Jurídicos</strong> —
          78 assistentes já prontos no ChatGPT.
        </p>
      </div>
    </div>
  )
}
