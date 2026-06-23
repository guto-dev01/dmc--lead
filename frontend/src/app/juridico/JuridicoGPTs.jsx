"use client";
import { useMemo, useState } from "react";
import { GPTS, CATEGORIAS, CAT_COR } from "./gpts-data";
import ChatPanel from "./ChatPanel";

// Ícones inline (mesmo estilo stroke do ImobPro)
const I = {
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  external: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  ),
  chat: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

export default function JuridicoGPTs({ api }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [chatAlvo, setChatAlvo] = useState(null); // GPT selecionado p/ conversar na tela

  const contagem = useMemo(() => {
    const map = { Todas: GPTS.length };
    for (const g of GPTS) map[g.categoria] = (map[g.categoria] || 0) + 1;
    return map;
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return GPTS.filter((g) => {
      const okCat = categoria === "Todas" || g.categoria === categoria;
      const okBusca =
        !termo ||
        g.nome.toLowerCase().includes(termo) ||
        g.descricao.toLowerCase().includes(termo);
      return okCat && okBusca;
    });
  }, [busca, categoria]);

  return (
    <div className="max-w-[1200px]">
      {/* Intro */}
      <p className="text-[13.5px] text-[var(--foreground-muted)]/80 max-w-2xl mb-6 leading-relaxed">
        {GPTS.length} assistentes de IA especializados em Direito Brasileiro. Clique em um card
        para <strong className="text-white">conversar aqui na tela</strong> — ou abra o GPT
        original no ChatGPT, se preferir.
      </p>

      {/* Busca */}
      <div className="relative max-w-xl mb-5">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f7980]">{I.search}</span>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar assistente por nome ou descrição..."
          className="tech-input w-full pl-10 pr-10 py-3 text-[14px]"
          aria-label="Buscar assistentes"
        />
        {busca && (
          <button
            onClick={() => setBusca("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f7980] hover:text-white transition-colors"
            aria-label="Limpar busca"
          >
            {I.x}
          </button>
        )}
      </div>

      {/* Filtros por categoria */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIAS.map((cat) => {
          const active = categoria === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-all duration-150 ${
                active
                  ? "text-[#06262b] border-transparent"
                  : "text-[#7c98a0] border-[var(--hairline)] bg-[var(--surface-1)] hover:text-white hover:border-[rgba(18,231,255,0.25)]"
              }`}
              style={active ? { background: "var(--accent-gradient)" } : undefined}
            >
              {cat}
              <span className={`ml-1.5 text-[11px] ${active ? "opacity-60" : "opacity-50"}`}>
                {contagem[cat] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contador */}
      <p className="text-[12.5px] text-[#5f7980] mb-5">
        Exibindo{" "}
        <span className="numeric font-semibold text-[var(--accent-cyan)]">{filtrados.length}</span>{" "}
        {filtrados.length === 1 ? "assistente" : "assistentes"}
        {categoria !== "Todas" && (
          <>
            {" "}em <span className="text-white font-medium">{categoria}</span>
          </>
        )}
      </p>

      {/* Grid de cards */}
      {filtrados.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((g) => {
            const cor = CAT_COR[g.categoria] || "#12e7ff";
            return (
              <div
                key={g.url || g.nome}
                onClick={() => setChatAlvo(g)}
                className="group surface flex flex-col gap-3 p-5 rounded-[16px] border border-[var(--hairline)] hover:border-[rgba(18,231,255,0.3)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                {/* Badge categoria */}
                <span
                  className="inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[11px] font-medium border"
                  style={{ color: cor, borderColor: `${cor}40`, background: `${cor}14` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                  {g.categoria}
                </span>

                {/* Nome */}
                <h3 className="text-[14.5px] font-semibold leading-snug text-white group-hover:text-[var(--accent-cyan)] transition-colors">
                  {g.nome}
                </h3>

                {/* Descrição */}
                <p className="text-[12.5px] leading-relaxed text-[var(--foreground-muted)]/75 flex-1 line-clamp-4">
                  {g.descricao}
                </p>

                {/* Ações */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
                  {g.url ? (
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11.5px] text-[#5f7980] hover:text-[var(--accent-cyan)] transition-colors"
                      title="Abrir o GPT original no ChatGPT"
                    >
                      ChatGPT {I.external}
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[11.5px] text-[#5f7980]"
                      title="Assistente nativo do ImobPro (não há GPT no ChatGPT)"
                    >
                      ★ Nativo
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold text-[#06262b] group-hover:scale-105 transition-transform"
                    style={{ background: "var(--accent-gradient)" }}
                  >
                    {I.chat} Conversar aqui
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface max-w-md mx-auto p-10 rounded-[16px] border border-[var(--hairline)] text-center">
          <p className="text-[13.5px] text-[var(--foreground-muted)]">
            Nenhum assistente encontrado para{" "}
            <span className="text-white font-semibold">"{busca}"</span>.
          </p>
          <button
            onClick={() => {
              setBusca("");
              setCategoria("Todas");
            }}
            className="btn-secondary mt-4 px-4 py-2 rounded-full text-[13px]"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Aviso de minuta */}
      <p className="mt-8 text-[11px] text-[#5f7980]/80 leading-relaxed border-t border-[var(--hairline)] pt-4">
        ⚠️ Os conteúdos gerados pelos assistentes são <strong className="text-[#7c98a0]">minutas</strong> e
        devem ser revisados por profissional habilitado antes de qualquer uso oficial. Não substituem a
        análise do advogado.
      </p>

      {/* Chat embutido (abre ao clicar num card) */}
      {chatAlvo && (
        <ChatPanel
          api={api}
          modal
          onClose={() => setChatAlvo(null)}
          titulo={chatAlvo.nome}
          subtitulo={chatAlvo.categoria}
          categoria={chatAlvo.categoria}
          assistente={chatAlvo.nome}
          descricao={chatAlvo.descricao}
        />
      )}
    </div>
  );
}
