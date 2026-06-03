"use client";

// Agenda / Calendário Inteligente — porte fiel (React/Tailwind) do módulo
// "calendar" do projeto agenda-imob (originalmente Angular Material), adaptado
// ao modelo de Tarefas do ImobPro (/api/tarefas) e ao tema do app.
//
// Layout: sidebar esquerda (mini-calendário + filtros por responsável/status/
// prioridade) + área principal com toolbar e quatro visualizações
// (Dia · Semana · Mês · Lista). Cada tarefa é posicionada na sua data de
// vencimento; tarefas sem data aparecem numa faixa "Sem data".

import { useState, useMemo } from "react";

// ---- Helpers de data (locais, sem fuso — alinhados ao restante do app) ----
const dKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => addDays(d, -d.getDay()); // semana começa no domingo
const sameYMD = (a, b) => dKey(a) === dKey(b);
const parseISO = (iso) => { const [a, m, d] = String(iso).split("-").map(Number); return new Date(a, (m || 1) - 1, d || 1); };

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
// Horas exibidas como pauta nas visualizações de semana/dia (decorativo).
const HORAS = ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"];

// Iniciais e cores estáveis por responsável (avatar/legenda dos filtros).
const iniciais = (nome) =>
  nome ? nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") : "?";
const CORES_RESP = ["#00e7fc", "#00ff4d", "#ff9800", "#ff4757", "#a855f7", "#38bdf8", "#fbbf24", "#f472b6"];

// Grade de um mês (preenche semanas completas com dias adjacentes).
const mesGrid = (ano, mes) => {
  const first = new Date(ano, mes, 1);
  const days = [];
  for (let i = first.getDay(); i > 0; i--) days.push(new Date(ano, mes, 1 - i));
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= ultimo; d++) days.push(new Date(ano, mes, d));
  while (days.length % 7 !== 0) days.push(addDays(days[days.length - 1], 1));
  return days;
};

export default function AgendaCalendar({
  tarefas = [],
  loading = false,
  Icon,
  corDaTarefa,           // (tarefa) => hex — cor pela prioridade/status
  prioridades = [],      // [{ value, label, color }]
  statusList = [],       // [{ value, label, color }]
  onNova,                // (dateStr?) => void
  onAbrir,               // (tarefa) => void
  onMover,               // (tarefa, novoDateStr) => void   (drag & drop)
}) {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => new Date());      // mês visível / mini-calendário
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [prioridadeFilter, setPrioridadeFilter] = useState("");
  const [respSel, setRespSel] = useState([]);                  // responsáveis marcados (vazio = todos)
  const [dragOver, setDragOver] = useState(null);              // dKey do dia sob arraste

  const hoje = new Date();
  const ano = cursor.getFullYear();
  const mes = cursor.getMonth();

  const labelStatus = (v) => statusList.find((s) => s.value === v)?.label || v;
  const labelPrio = (v) => prioridades.find((p) => p.value === v)?.label || v;
  const cor = (t) => (corDaTarefa ? corDaTarefa(t) : "#38bdf8");

  // Responsáveis distintos (com cor/avatar) para a lista de filtros.
  const responsaveis = useMemo(() => {
    const nomes = [...new Set(tarefas.map((t) => t.responsavel).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    return nomes.map((nome, i) => ({ nome, cor: CORES_RESP[i % CORES_RESP.length], avatar: iniciais(nome) }));
  }, [tarefas]);
  const corDoResp = (nome) => responsaveis.find((r) => r.nome === nome)?.cor || "#64748b";

  // Filtros combináveis.
  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tarefas.filter((t) => {
      const mResp = respSel.length === 0 ? true : (t.responsavel && respSel.includes(t.responsavel));
      const mStatus = statusFilter ? t.status === statusFilter : true;
      const mPrio = prioridadeFilter ? t.prioridade === prioridadeFilter : true;
      const mSearch = q
        ? (t.titulo || "").toLowerCase().includes(q) || (t.descricao || "").toLowerCase().includes(q)
        : true;
      return mResp && mStatus && mPrio && mSearch;
    });
  }, [tarefas, respSel, statusFilter, prioridadeFilter, search]);

  // Índice por dia + faixa sem data.
  const { porDia, semData } = useMemo(() => {
    const pd = {}, sd = [];
    for (const t of filtradas) {
      if (t.data_vencimento) (pd[t.data_vencimento] ||= []).push(t);
      else sd.push(t);
    }
    return { porDia: pd, semData: sd };
  }, [filtradas]);
  const tarefasDoDia = (d) => porDia[dKey(d)] || [];
  const temTarefa = (d) => (porDia[dKey(d)]?.length || 0) > 0;

  // ---- Navegação ----
  const irHoje = () => { const h = new Date(); setCursor(h); setSelectedDay(h); };
  const passo = (dir) => {
    if (view === "month") {
      setCursor(new Date(ano, mes + dir, 1));
    } else {
      const base = addDays(selectedDay, (view === "week" ? 7 : 1) * dir);
      setSelectedDay(base);
      setCursor(base);
    }
  };
  const prevMonth = () => setCursor(new Date(ano, mes - 1, 1));
  const nextMonth = () => setCursor(new Date(ano, mes + 1, 1));
  const escolherDia = (d) => {
    setSelectedDay(d);
    if (d.getMonth() !== mes || d.getFullYear() !== ano) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  // Rótulo do período conforme a visualização.
  let periodo;
  if (view === "month") periodo = `${MESES_PT[mes]} ${ano}`;
  else if (view === "week") {
    const ini = startOfWeek(selectedDay); const fim = addDays(ini, 6);
    periodo = `${ini.getDate()} ${MESES_PT[ini.getMonth()].slice(0, 3)} – ${fim.getDate()} ${MESES_PT[fim.getMonth()].slice(0, 3)} ${fim.getFullYear()}`;
  } else if (view === "day") periodo = `${selectedDay.getDate()} de ${MESES_PT[selectedDay.getMonth()]} de ${selectedDay.getFullYear()}`;
  else periodo = `${filtradas.length} evento${filtradas.length === 1 ? "" : "s"}`;

  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDay), i));

  // ---- Drag & drop (mover tarefa de dia) ----
  const onDragStart = (e, t) => { e.dataTransfer.setData("text/plain", String(t.id)); e.dataTransfer.effectAllowed = "move"; };
  const onDrop = (e, d) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const t = tarefas.find((x) => String(x.id) === String(id));
    const novo = dKey(d);
    if (t && onMover && t.data_vencimento !== novo) onMover(t, novo);
  };

  // ---- Sub-componentes ----
  const Avatar = ({ nome, cor, size = 22 }) => (
    <span className="inline-grid place-items-center rounded-full text-[10px] font-bold text-black shrink-0"
      style={{ width: size, height: size, background: cor }}>{iniciais(nome)}</span>
  );

  // Barra compacta (mês).
  const EventBar = (t) => (
    <div key={t.id} draggable onDragStart={(e) => onDragStart(e, t)}
      onClick={(e) => { e.stopPropagation(); onAbrir(t); }} title={t.titulo}
      className="group/ev w-full text-left truncate text-[11px] leading-tight px-1.5 py-1 rounded-md border-l-2 cursor-pointer hover:brightness-125 transition"
      style={{ borderLeftColor: cor(t), background: `${cor(t)}22`, color: "#e2e8f0" }}>
      <span className={t.status === "concluida" ? "line-through opacity-70" : ""}>{t.titulo}</span>
    </div>
  );

  // Bloco de evento (semana/dia) — mais detalhado.
  const EventBlock = (t) => (
    <div key={t.id} onClick={() => onAbrir(t)} draggable onDragStart={(e) => onDragStart(e, t)}
      className="text-left rounded-lg px-2.5 py-2 cursor-pointer border-l-[3px] hover:brightness-110 transition"
      style={{ borderLeftColor: cor(t), background: `${cor(t)}1c` }}>
      <div className={`text-white text-[13px] font-medium truncate ${t.status === "concluida" ? "line-through opacity-70" : ""}`}>{t.titulo}</div>
      {t.descricao && <div className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{t.descricao}</div>}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${cor(t)}26`, color: cor(t) }}>{labelPrio(t.prioridade)}</span>
        <span className="text-slate-400 text-[10px]">{labelStatus(t.status)}</span>
        {t.responsavel && <span className="ml-auto flex items-center gap-1 text-slate-300 text-[10px]">
          <Avatar nome={t.responsavel} cor={corDoResp(t.responsavel)} size={16} />{t.responsavel}</span>}
      </div>
    </div>
  );

  const miniDays = mesGrid(ano, mes);

  return (
    <div className="relative">
      {/* Brilho decorativo (hero) */}
      <div aria-hidden className="pointer-events-none absolute -top-10 right-10 w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #00e7fc, transparent 70%)" }} />

      <div className="relative grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* ===================== SIDEBAR ESQUERDA ===================== */}
        <aside className="space-y-4">
          {/* Mini-calendário */}
          <div className="surface-strong rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={prevMonth} aria-label="Mês anterior"
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/5 transition"><Icon name="chevronLeft" size={16} /></button>
              <h3 className="text-white text-sm font-semibold capitalize">{MESES_PT[mes]} {ano}</h3>
              <button onClick={nextMonth} aria-label="Próximo mês"
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/5 transition"><Icon name="chevronRight" size={16} /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS_PT.map((w) => <div key={w} className="text-center text-slate-500 text-[10px] font-medium py-0.5">{w[0]}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {miniDays.map((d) => {
                const foraMes = d.getMonth() !== mes;
                const isHoje = sameYMD(d, hoje);
                const isSel = sameYMD(d, selectedDay);
                return (
                  <button key={dKey(d)} onClick={() => escolherDia(d)}
                    className={`relative aspect-square grid place-items-center text-[11px] rounded-lg transition
                      ${isSel ? "bg-[#00e7fc] text-black font-bold" : isHoje ? "text-[#00e7fc] font-semibold" : foraMes ? "text-slate-600" : "text-slate-300 hover:bg-white/5"}`}>
                    {d.getDate()}
                    {temTarefa(d) && !isSel && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#00e7fc]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtrar eventos */}
          <div className="surface-strong rounded-2xl p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Filtrar eventos</h3>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={14} /></span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar eventos..."
                className="w-full pl-8 pr-3 py-2 tech-input rounded-xl text-sm" />
            </div>

            {/* Responsáveis */}
            {responsaveis.length > 0 && (
              <div className="space-y-1.5">
                <button onClick={() => setRespSel(respSel.length === responsaveis.length ? [] : responsaveis.map((r) => r.nome))}
                  className="flex items-center gap-2 text-slate-300 text-xs hover:text-white transition">
                  <Icon name={respSel.length === responsaveis.length ? "check" : "users"} size={14} />
                  {respSel.length === responsaveis.length ? "Desmarcar todos" : "Selecionar todos"}
                </button>
                <div className="space-y-0.5 max-h-44 overflow-auto pr-1">
                  {responsaveis.map((r) => {
                    const on = respSel.includes(r.nome);
                    return (
                      <button key={r.nome}
                        onClick={() => setRespSel(on ? respSel.filter((n) => n !== r.nome) : [...respSel, r.nome])}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition text-left ${on ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                        <span className={`w-4 h-4 rounded grid place-items-center border ${on ? "bg-[#00e7fc] border-[#00e7fc]" : "border-white/20"}`}>
                          {on && <Icon name="check" size={11} />}
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.cor }} />
                        <span className="text-slate-200 text-xs truncate flex-1">{r.nome}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status / Prioridade */}
            <div className="space-y-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full surface-soft rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00e7fc]">
                <option value="">Todos os status</option>
                {statusList.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={prioridadeFilter} onChange={(e) => setPrioridadeFilter(e.target.value)}
                className="w-full surface-soft rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00e7fc]">
                <option value="">Todas as prioridades</option>
                {prioridades.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {(search || statusFilter || prioridadeFilter || respSel.length > 0) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); setPrioridadeFilter(""); setRespSel([]); }}
                className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
                <Icon name="x" size={13} /> Limpar filtros
              </button>
            )}
          </div>
        </aside>

        {/* ===================== ÁREA PRINCIPAL ===================== */}
        <div className="space-y-4 min-w-0">
          {/* Toolbar */}
          <div className="surface-strong rounded-2xl p-3 flex flex-wrap items-center gap-3">
            <button onClick={irHoje}
              className="px-3 py-2 rounded-xl border border-white/10 text-slate-200 text-sm hover:bg-white/5 transition">Hoje</button>
            <div className="flex items-center gap-1">
              <button onClick={() => passo(-1)} aria-label="Anterior"
                className="p-2 rounded-xl text-slate-300 hover:bg-white/5 transition"><Icon name="chevronLeft" size={18} /></button>
              <button onClick={() => passo(1)} aria-label="Próximo"
                className="p-2 rounded-xl text-slate-300 hover:bg-white/5 transition"><Icon name="chevronRight" size={18} /></button>
            </div>
            <span className="text-white font-semibold capitalize">{periodo}</span>

            <div className="ml-auto flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-white/8 bg-black/20 p-1">
                {[["day", "Dia"], ["week", "Semana"], ["month", "Mês"], ["list", "Lista"]].map(([v, l]) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === v ? "bg-[#00e7fc]/15 text-[#00e7fc]" : "text-slate-400 hover:text-white"}`}>{l}</button>
                ))}
              </div>
              <button onClick={() => onNova(dKey(view === "month" ? hoje : selectedDay))}
                className="px-3 py-2 tech-button rounded-xl text-sm font-medium flex items-center gap-1.5">
                <Icon name="plus" size={15} /> Novo evento
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[#12e7ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : view === "month" ? (
            /* ===== MÊS ===== */
            <div className="surface-strong rounded-2xl p-3">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS_PT.map((w) => (
                  <div key={w} className="text-center text-slate-500 text-xs font-medium uppercase tracking-wider py-1">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {miniDays.map((d) => {
                  const lista = tarefasDoDia(d);
                  const foraMes = d.getMonth() !== mes;
                  const isHoje = sameYMD(d, hoje);
                  const isOver = dragOver === dKey(d);
                  return (
                    <div key={dKey(d)} onClick={() => onNova(dKey(d))}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(dKey(d)); }}
                      onDragLeave={() => setDragOver((p) => (p === dKey(d) ? null : p))}
                      onDrop={(e) => onDrop(e, d)}
                      className={`min-h-[108px] rounded-xl p-1.5 border cursor-pointer transition flex flex-col gap-1
                        ${isOver ? "border-[#00e7fc] bg-[#00e7fc]/10" : foraMes ? "border-white/5 bg-black/10 opacity-50" : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                      <div className="flex items-center justify-between">
                        <button onClick={(e) => { e.stopPropagation(); escolherDia(new Date(d)); setView("day"); }}
                          className={`text-xs w-6 h-6 grid place-items-center rounded-full transition ${isHoje ? "bg-[#00e7fc] text-black font-bold" : "text-slate-300 hover:bg-white/10"}`}>{d.getDate()}</button>
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {lista.slice(0, 3).map(EventBar)}
                        {lista.length > 3 && <div className="text-[10px] text-slate-400 pl-1">+{lista.length - 3} mais</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : view === "week" ? (
            /* ===== SEMANA ===== */
            <div className="surface-strong rounded-2xl p-3 overflow-x-auto">
              <div className="flex min-w-[760px]">
                {/* Pauta de horas (decorativa) */}
                <div className="w-12 shrink-0 pt-12">
                  {HORAS.map((h) => <div key={h} className="h-12 text-right pr-2 text-[10px] text-slate-600">{h}</div>)}
                </div>
                <div className="grid grid-cols-7 flex-1 gap-1.5">
                  {diasSemana.map((d) => {
                    const lista = tarefasDoDia(d);
                    const isHoje = sameYMD(d, hoje);
                    const isSel = sameYMD(d, selectedDay);
                    const isOver = dragOver === dKey(d);
                    return (
                      <div key={dKey(d)}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(dKey(d)); }}
                        onDragLeave={() => setDragOver((p) => (p === dKey(d) ? null : p))}
                        onDrop={(e) => onDrop(e, d)}
                        className={`rounded-xl border flex flex-col ${isOver ? "border-[#00e7fc] bg-[#00e7fc]/5" : isSel ? "border-[#00e7fc]/40 bg-white/[0.03]" : "border-white/8 bg-white/[0.02]"}`}>
                        <button onClick={() => escolherDia(d)}
                          className="px-2 py-2 border-b border-white/8 flex flex-col items-center hover:bg-white/5 transition rounded-t-xl">
                          <span className="text-slate-500 text-[10px] uppercase">{WEEKDAYS_PT[d.getDay()]}</span>
                          <span className={`text-sm font-semibold ${isHoje ? "text-[#00e7fc]" : "text-white"}`}>{d.getDate()}</span>
                          {lista.length > 0 && <span className="text-[9px] text-slate-500 mt-0.5">{lista.length} evento{lista.length > 1 ? "s" : ""}</span>}
                        </button>
                        <div className="p-1.5 space-y-1 flex-1 min-h-[260px]">
                          {lista.length === 0
                            ? <button onClick={() => onNova(dKey(d))} className="w-full h-full min-h-[60px] grid place-items-center text-slate-700 hover:text-[#00e7fc] transition"><Icon name="plus" size={16} /></button>
                            : lista.map(EventBlock)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : view === "day" ? (
            /* ===== DIA ===== */
            <div className="space-y-4">
              {/* Faixa da semana */}
              <div className="surface-strong rounded-2xl p-3">
                <div className="grid grid-cols-7 gap-2">
                  {diasSemana.map((d) => {
                    const isSel = sameYMD(d, selectedDay);
                    const isHoje = sameYMD(d, hoje);
                    return (
                      <button key={dKey(d)} onClick={() => escolherDia(d)}
                        className={`rounded-xl py-2 flex flex-col items-center gap-0.5 border transition ${isSel ? "border-[#00e7fc] bg-[#00e7fc]/10" : "border-white/8 hover:bg-white/5"}`}>
                        <span className="text-slate-500 text-[11px] uppercase">{WEEKDAYS_PT[d.getDay()]}</span>
                        <span className={`text-sm font-semibold ${isHoje ? "text-[#00e7fc]" : "text-white"}`}>{d.getDate()}</span>
                        {temTarefa(d) && <span className="w-1.5 h-1.5 rounded-full bg-[#00e7fc]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Timeline do dia */}
              <div className="surface-strong rounded-2xl p-4">
                {tarefasDoDia(selectedDay).length === 0 ? (
                  <div className="text-center py-14 space-y-3">
                    <span className="inline-grid place-items-center text-slate-600"><Icon name="calendar" size={34} /></span>
                    <div className="text-slate-400 text-sm">Nenhum evento neste dia.</div>
                    <button onClick={() => onNova(dKey(selectedDay))}
                      className="px-4 py-2 tech-button rounded-xl text-sm font-medium inline-flex items-center gap-2">
                      <Icon name="plus" size={14} /> Adicionar evento
                    </button>
                  </div>
                ) : (
                  <div className="flex">
                    <div className="w-12 shrink-0">
                      {HORAS.map((h) => <div key={h} className="h-12 text-right pr-2 text-[10px] text-slate-600">{h}</div>)}
                    </div>
                    <div className="flex-1 space-y-2 border-l border-white/8 pl-3 py-1">
                      {tarefasDoDia(selectedDay).map(EventBlock)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ===== LISTA (Schedule) ===== */
            <div className="surface-strong rounded-2xl p-4">
              {(() => {
                const grupos = Object.entries(porDia)
                  .map(([iso, lista]) => ({ iso, date: parseISO(iso), lista }))
                  .sort((a, b) => a.date - b.date);
                if (grupos.length === 0) {
                  return (
                    <div className="text-center py-14 space-y-3">
                      <span className="inline-grid place-items-center text-slate-600"><Icon name="calendar" size={34} /></span>
                      <div className="text-slate-400 text-sm">Nenhum evento agendado.</div>
                      <button onClick={() => onNova(dKey(hoje))}
                        className="px-4 py-2 tech-button rounded-xl text-sm font-medium inline-flex items-center gap-2">
                        <Icon name="plus" size={14} /> Criar evento
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="space-y-5">
                    {grupos.map(({ iso, date, lista }) => {
                      const isHoje = sameYMD(date, hoje);
                      return (
                        <div key={iso} className="flex gap-4">
                          <div className="w-14 shrink-0 text-center pt-1">
                            <div className="text-slate-500 text-[11px] uppercase">{WEEKDAYS_PT[date.getDay()]}</div>
                            <div className={`text-2xl font-semibold ${isHoje ? "text-[#00e7fc]" : "text-white"}`}>{date.getDate()}</div>
                            <div className="text-slate-600 text-[10px]">{MESES_PT[date.getMonth()].slice(0, 3)}</div>
                          </div>
                          <div className="flex-1 space-y-1.5 min-w-0">
                            {lista.map(EventBlock)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tarefas sem data de vencimento */}
          {!loading && semData.length > 0 && (
            <div className="surface-strong rounded-2xl p-4">
              <div className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-3">Sem data de vencimento ({semData.length})</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {semData.map(EventBlock)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
