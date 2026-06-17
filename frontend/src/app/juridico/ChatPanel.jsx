"use client";
import { useEffect, useRef, useState } from "react";

const Ico = {
  send: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  spark: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2l1.9 5.8H20l-4.8 3.5 1.8 5.7L12 13.9 6.9 17l1.8-5.7L4 7.8h6.1z" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  clip: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  doc: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
    </svg>
  ),
};

const ACEITA = ".pdf,.docx,.txt,.md,.csv,.json,.rtf,.htm,.html,.log";

export default function ChatPanel({
  api,
  titulo = "Assistente Jurídico IA",
  subtitulo = "",
  categoria = "",
  assistente = "",
  descricao = "",
  sugestoes = [],
  modal = false,
  onClose,
}) {
  const [mensagens, setMensagens] = useState([]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [configurado, setConfigurado] = useState(null); // null = checando
  const [anexo, setAnexo] = useState(null); // { nome, texto, chars, truncado }
  const [anexando, setAnexando] = useState(false);
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  // Checa se o chat está configurado (sem expor a chave)
  useEffect(() => {
    let vivo = true;
    api("/api/juridico/status")
      .then((s) => vivo && setConfigurado(!!s?.configurado))
      .catch(() => vivo && setConfigurado(false));
    return () => {
      vivo = false;
    };
  }, [api]);

  // Auto-scroll para o fim
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, carregando]);

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // permite reanexar o mesmo arquivo
    if (!file) return;
    setErro("");
    setAnexando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      const data = await api("/api/juridico/extrair", { method: "POST", body: fd });
      setAnexo({ nome: data.nome, texto: data.texto, chars: data.chars, truncado: data.truncado });
    } catch (err) {
      setErro(err?.message || "Não foi possível ler o documento.");
    } finally {
      setAnexando(false);
      inputRef.current?.focus();
    }
  }

  async function enviar(texto) {
    const conteudo = (texto ?? input).trim();
    if ((!conteudo && !anexo) || carregando) return;
    setErro("");
    const msgUsuario = conteudo || (anexo ? `Analise o documento anexado: ${anexo.nome}` : "");
    const historico = [...mensagens, { role: "user", content: msgUsuario }];
    setMensagens(historico);
    setInput("");
    setCarregando(true);
    try {
      const data = await api("/api/juridico/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: historico,
          categoria,
          assistente,
          descricao,
          documento: anexo?.texto || undefined,
          documento_nome: anexo?.nome || undefined,
        }),
      });
      setMensagens((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setErro(e?.message || "Falha ao falar com a IA.");
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  const vazio = mensagens.length === 0;
  const fmt = (n) => new Intl.NumberFormat("pt-BR").format(n);

  const corpo = (
    <div className="flex flex-col h-full min-h-0">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--hairline)] flex-shrink-0">
        <span className="flex items-center justify-center w-9 h-9 rounded-[10px] text-[#06262b]" style={{ background: "var(--accent-gradient)" }}>
          {Ico.spark}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-white truncate">{titulo}</h3>
          <p className="text-[11px] text-[#5f7980] truncate">
            {subtitulo || (categoria ? categoria : "Direito Brasileiro · IA")}
          </p>
        </div>
        {mensagens.length > 0 && (
          <button
            onClick={() => { setMensagens([]); setErro(""); }}
            className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px]"
            title="Limpar conversa"
          >
            {Ico.trash} Limpar
          </button>
        )}
        {modal && (
          <button onClick={onClose} className="btn-ghost p-2 rounded-full" aria-label="Fechar">
            {Ico.x}
          </button>
        )}
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {vazio && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <span className="flex items-center justify-center w-14 h-14 rounded-2xl text-[#06262b] mb-3" style={{ background: "var(--accent-gradient)" }}>
              {Ico.spark}
            </span>
            <p className="text-[14px] text-white font-medium">Como posso ajudar?</p>
            <p className="text-[12.5px] text-[#5f7980] mt-1 max-w-sm">
              {descricao || "Descreva o caso, anexe um documento (PDF, DOCX, TXT) ou peça uma peça, parecer ou pesquisa."}
            </p>
            {sugestoes.length > 0 && configurado !== false && (
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="px-3 py-1.5 rounded-full text-[12px] text-[#7c98a0] border border-[var(--hairline)] bg-[var(--surface-1)] hover:text-white hover:border-[rgba(18,231,255,0.25)] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {configurado === false && (
              <div className="mt-5 max-w-sm px-4 py-3 rounded-[12px] text-[12.5px] border text-[var(--warning)] border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)]">
                Chat IA ainda não configurado. Peça ao administrador para definir a variável
                <strong> GEMINI_API_KEY</strong> (grátis) no servidor.
              </div>
            )}
          </div>
        )}

        {mensagens.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "rounded-br-sm text-[#06262b]"
                  : "rounded-bl-sm text-[var(--foreground-muted)] border border-[var(--hairline)]"
              }`}
              style={m.role === "user" ? { background: "var(--accent-gradient)" } : { background: "var(--surface-2)" }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {carregando && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm border border-[var(--hairline)]" style={{ background: "var(--surface-2)" }}>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: "240ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {/* Erro */}
      {erro && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-[10px] text-[12px] border text-[var(--danger)] border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] flex-shrink-0">
          {erro}
        </div>
      )}

      {/* Chip do anexo */}
      {anexo && (
        <div className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[rgba(18,231,255,0.25)] bg-[var(--surface-1)] flex-shrink-0">
          <span className="text-[var(--accent-cyan)] flex-shrink-0">{Ico.doc}</span>
          <span className="text-[12px] text-white truncate flex-1">{anexo.nome}</span>
          <span className="text-[11px] text-[#5f7980] flex-shrink-0">
            {fmt(anexo.chars)} caracteres{anexo.truncado ? " (truncado)" : ""}
          </span>
          <button onClick={() => setAnexo(null)} className="text-[#5f7980] hover:text-white flex-shrink-0" aria-label="Remover anexo">
            {Ico.x}
          </button>
        </div>
      )}

      {/* Entrada */}
      <div className="p-3 border-t border-[var(--hairline)] flex-shrink-0">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACEITA}
            onChange={onPickFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={anexando || carregando || configurado === false}
            title="Anexar documento (PDF, DOCX, TXT)"
            aria-label="Anexar documento"
            className="flex items-center justify-center w-11 h-11 rounded-[12px] border border-[var(--hairline)] text-[#7c98a0] hover:text-white hover:border-[rgba(18,231,255,0.3)] transition-all flex-shrink-0 disabled:opacity-40"
          >
            {anexando ? (
              <span className="w-4 h-4 rounded-full border-2 border-[var(--accent-cyan)] border-t-transparent animate-spin" />
            ) : (
              Ico.clip
            )}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={configurado === false}
            placeholder={configurado === false ? "Chat indisponível" : "Digite sua mensagem...  (Enter envia · Shift+Enter quebra linha)"}
            className="tech-input flex-1 resize-none max-h-32 py-2.5 text-[13px] disabled:opacity-50"
          />
          <button
            onClick={() => enviar()}
            disabled={carregando || (!input.trim() && !anexo) || configurado === false}
            className="tech-button flex items-center justify-center w-11 h-11 rounded-[12px] text-[#06262b] flex-shrink-0 disabled:opacity-40"
            style={{ background: "var(--accent-gradient)" }}
            aria-label="Enviar"
          >
            {Ico.send}
          </button>
        </div>
        <p className="text-[10.5px] text-[#5f7980]/70 mt-2 px-1">
          Anexe PDF, DOCX ou TXT (máx. 20 MB). Conteúdo gerado por IA é <strong>minuta</strong> — revise antes de usar. Não substitui o advogado.
        </p>
      </div>
    </div>
  );

  if (!modal) {
    return (
      <div className="surface rounded-[16px] border border-[var(--hairline)] overflow-hidden h-[calc(100vh-200px)] min-h-[480px]">
        {corpo}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="surface w-full max-w-2xl h-[80vh] max-h-[700px] rounded-[18px] border border-[var(--hairline)] overflow-hidden shadow-2xl" style={{ background: "var(--background-muted)" }}>
        {corpo}
      </div>
    </div>
  );
}
