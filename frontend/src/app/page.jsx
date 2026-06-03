"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import DMCPlatform, { DMC_NAV } from "./dmc/DMCPlatform";
import EquipesPanel from "./equipes/EquipesPanel";
import AgendaCalendar from "./agenda/AgendaCalendar";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? window.ENV_API_URL : undefined) ||
  "http://localhost:8001";

const TOKEN_KEY = "imobpro_token";
const PAGE_KEY = "imobpro_page";

const getStoredToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
};

const setStoredToken = (token) => {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
};

const getStoredPage = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PAGE_KEY) || "";
};

const setStoredPage = (page) => {
  if (typeof window === "undefined") return;
  if (page) window.localStorage.setItem(PAGE_KEY, page);
  else window.localStorage.removeItem(PAGE_KEY);
};

const isValidPage = (value) => {
  const basePages = new Set([
    "dashboard",
    "empresas",
    "decisores",
    "clientes",
    "mercado",
    "campanhas",
    "templates",
    "tarefas",
    "equipes",
    "conversas",
    "whatsapp",
  ]);
  if (basePages.has(value)) return true;
  return typeof value === "string" && value.startsWith("dmc:");
};

const api = async (path, opts = {}) => {
  const { auth = true, headers = {}, ...fetchOpts } = opts;
  const token = auth ? getStoredToken() : "";
  const r = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...fetchOpts,
  });
  if (!r.ok) {
    let detail = `API ${r.status}`;
    try {
      const j = await r.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch (_) {}
    throw new Error(detail);
  }
  return r.json();
};

// ---- ICONS ----
const Icon = ({ name, size = 18 }) => {
  const icons = {
    building: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7l9-4 9 4M4 21V7m16 14V7M9 21V11h6v10"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    whatsapp: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
    chart: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    mail: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    send: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>,
    info: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    map: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
    tag: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    megaphone: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg>,
    file: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    document: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>,
    home: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    phone: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 8.2a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.44 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.09 6.09l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    lock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>,
    server: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01"/><path d="M7 17h.01"/></svg>,
    database: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M4 17v2c0 1.7 3.6 3 8 3s8-1.3 8-3v-2"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    pulse: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>,
    layers: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 3 7 12 12 21 7 12 2"/><polyline points="3 12 12 17 21 12"/><polyline points="3 17 12 22 21 17"/></svg>,
    spark: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l1.9 5.8H20l-4.8 3.5 1.8 5.7L12 13.9 6.9 17l1.8-5.7L4 7.8h6.1z"/></svg>,
    tasks: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5h10M9 12h10M9 19h10"/><path d="m3 5 1.5 1.5L7 4"/><path d="m3 12 1.5 1.5L7 11"/><path d="m3 19 1.5 1.5L7 18"/></svg>,
    clock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
    eye: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
    alert: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    chevronLeft: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>,
    chevronRight: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  };
  return icons[name] || null;
};

// ---- BADGE ----
const Badge = ({ children, color = "slate" }) => {
  const colors = {
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    sky: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    violet: "bg-[#00e7fc]/15 text-[#00e7fc] border-[#00e7fc]/30",
    slate: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    orange: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
};

// Formata números grandes no padrão brasileiro (1.234)
const fmtNum = (n) => Number(n || 0).toLocaleString("pt-BR");

// ---- TAREFAS: rótulos e cores (alinhados ao backend) ----
const TAREFA_PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "slate" },
  { value: "media", label: "Média", color: "sky" },
  { value: "alta", label: "Alta", color: "amber" },
  { value: "urgente", label: "Urgente", color: "rose" },
];
const TAREFA_STATUS = [
  { value: "pendente", label: "Pendente", color: "amber" },
  { value: "em_andamento", label: "Em andamento", color: "sky" },
  { value: "concluida", label: "Concluída", color: "emerald" },
  { value: "cancelada", label: "Cancelada", color: "slate" },
];
const tarefaPrioridadeInfo = (v) => TAREFA_PRIORIDADES.find((p) => p.value === v) || TAREFA_PRIORIDADES[1];
const tarefaStatusInfo = (v) => TAREFA_STATUS.find((s) => s.value === v) || TAREFA_STATUS[0];
// Cor (hex) da tarefa no calendário: concluída/cancelada esmaecem; senão pela prioridade.
const tarefaCor = (t) => {
  if (t.status === "concluida") return "#34d399";
  if (t.status === "cancelada") return "#64748b";
  return { baixa: "#94a3b8", media: "#38bdf8", alta: "#f59e0b", urgente: "#fb7185" }[t.prioridade] || "#38bdf8";
};

// Data ISO (YYYY-MM-DD) -> dd/mm/aaaa, sem fuso (evita "voltar um dia")
const fmtData = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = String(iso).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
};

// ---- SITUAÇÃO DE CAMPANHAS (WhatsApp / e-mail) ----
// Exibe apenas dados reais vindos do dashboard; quando não há campanhas do canal,
// mostra um estado vazio amigável sem inventar métricas.
const CampanhaSituacao = ({ titulo, icon, data, unidade, vazioMsg }) => {
  const d = data || {};
  const criadas = Number(d.criadas || 0);
  const taxa = d.taxa_sucesso;
  const statusCards = [
    { label: "Criadas", value: d.criadas, color: "#12e7ff" },
    { label: "Em andamento", value: d.em_andamento, color: "#38bdf8" },
    { label: "Finalizadas", value: d.finalizadas, color: "#00ff6a" },
    { label: "Pausadas", value: d.pausadas, color: "#f59e0b" },
    { label: "Com erro", value: d.erro, color: "#fb7185" },
  ];
  const msgCards = [
    { label: `${unidade} enviados`, value: d.enviadas, color: "#00ff6a" },
    { label: `${unidade} pendentes`, value: d.pendentes, color: "#f59e0b" },
    { label: `${unidade} com falha`, value: d.falha, color: "#fb7185" },
  ];
  return (
    <div className="surface-strong rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Icon name={icon} size={16} /> {titulo}
        </h3>
        {taxa != null && <Badge color="emerald">{taxa}% de sucesso</Badge>}
      </div>
      {criadas > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statusCards.map(c => (
              <div key={c.label} className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                <div className="text-2xl font-semibold leading-none" style={{ color: c.color }}>{fmtNum(c.value)}</div>
                <div className="text-slate-400 text-xs mt-2">{c.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {msgCards.map(c => (
              <div key={c.label} className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-slate-500 text-xs uppercase tracking-[0.16em]">{c.label}</div>
                <div className="text-xl font-semibold text-white mt-1" style={{ color: c.color }}>{fmtNum(c.value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-5 text-slate-400 text-sm">
          {vazioMsg}
        </div>
      )}
    </div>
  );
};

const tipoColor = (tipo) => ({
  incorporadora: "violet",
  construtora: "amber",
  imobiliaria: "sky",
  corretora: "emerald",
  administradora: "orange",
}[tipo] || "slate");

// Funil de prospecção (planilha DMC)
const STATUS_PROSPECCAO = [
  { key: "nao_iniciado",     label: "Não iniciado",     color: "slate" },
  { key: "pesquisa_feita",   label: "Pesquisa feita",   color: "sky" },
  { key: "contato_feito",    label: "Contato feito",    color: "violet" },
  { key: "reuniao_agendada", label: "Reunião agendada", color: "amber" },
  { key: "proposta_enviada", label: "Proposta enviada", color: "orange" },
  { key: "parceria_fechada", label: "Parceria fechada", color: "emerald" },
];
const statusInfo = (k) => STATUS_PROSPECCAO.find(s => s.key === k) || STATUS_PROSPECCAO[0];

const PRIORIDADES = [
  { key: "alta",   label: "🔴 Alta",   color: "rose" },
  { key: "media",  label: "🟡 Média",  color: "amber" },
  { key: "normal", label: "🟢 Normal", color: "slate" },
];
const prioridadeInfo = (k) => PRIORIDADES.find(p => p.key === k) || PRIORIDADES[2];

// ---- MODAL ----
const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative surface-strong rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#00e7fc]/10">
          <h3 className="text-white font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <Icon name="x" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

const LOGIN_TRUST = [
  { icon: "lock", title: "Segurança de ponta", desc: "Acesso protegido por token" },
  { icon: "database", title: "Dados protegidos", desc: "Conformidade LGPD" },
  { icon: "pulse", title: "Disponibilidade 99,9%", desc: "Infraestrutura de alta disponibilidade" },
];

// Casca visual compartilhada das telas de acesso (login, cadastro, recuperação).
// Mantém o mesmo fundo, a coluna de marca e o cartão da tela de login original.
const AuthShell = ({ onBack, backLabel = "Voltar", badge = "Conexão segura", title, subtitle, error, children, footer }) => {
  const anoAtual = new Date().getFullYear();
  return (
    <section
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden isolate p-[clamp(1rem,3.5vw,2.5rem)]"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 75% 25%, rgba(0,231,252,0.12), transparent 60%)," +
          "radial-gradient(ellipse 60% 45% at 18% 85%, rgba(0,255,106,0.08), transparent 60%)," +
          "linear-gradient(180deg, #0a1418 0%, #04090b 100%)",
      }}
    >
      {/* Background ambiente */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.018) 1px, transparent 1px)," +
              "linear-gradient(to bottom, rgba(255,255,255,0.018) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 60% 65% at center, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 65% at center, black 20%, transparent 80%)",
          }}
        />
        <div
          className="absolute rounded-full blur-[90px] opacity-55 animate-pulse"
          style={{
            top: "-15%", right: "-10%", width: 600, height: 600,
            background: "radial-gradient(circle, rgba(0,231,252,0.30), transparent 65%)",
          }}
        />
        <div
          className="absolute rounded-full blur-[90px] opacity-55"
          style={{
            bottom: "-20%", left: "-12%", width: 520, height: 520,
            background: "radial-gradient(circle, rgba(0,255,106,0.16), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 90% 80% at center, transparent 50%, rgba(0,0,0,0.35) 100%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1100px] grid items-center gap-[clamp(2rem,4vw,3.75rem)] grid-cols-1 lg:grid-cols-[1fr_0.9fr]">
        {/* ───── Coluna esquerda · Marca ───── */}
        <aside className="hidden lg:flex flex-col">
          <div className="flex flex-col gap-9">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#00e7fc] to-[#00ff4d] flex items-center justify-center text-[#06262b] shadow-[0_0_40px_rgba(0,231,252,0.4)]">
                <Icon name="building" size={28} />
              </div>
              <h1 className="text-[#00ff6a] font-extrabold tracking-[0.35em] text-2xl leading-none">IMOBPRO</h1>
            </div>

            <div className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#00e7fc] w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00e7fc] shadow-[0_0_12px_rgba(0,231,252,0.6)] animate-pulse" />
                Plataforma de prospecção inteligente
              </span>
              <h2 className="text-[clamp(2.5rem,4.5vw,3.4rem)] font-bold leading-[0.95] tracking-tight text-gradient">
                ImobPro
              </h2>
              <p className="text-base leading-relaxed text-slate-300 max-w-[36ch]">
                Inteligência aplicada à prospecção imobiliária: empresas, mercado, decisores e WhatsApp num só lugar.
              </p>
            </div>

            <ul className="list-none p-0 m-0 flex flex-col border-t border-white/8 pt-2">
              {LOGIN_TRUST.map((t) => (
                <li key={t.title} className="group flex items-center gap-4 py-3.5 border-b border-white/8 last:border-b-0">
                  <span className="flex-shrink-0 w-9 h-9 grid place-items-center rounded-[10px] bg-[#00e7fc]/[0.06] text-[#00e7fc] shadow-[inset_0_0_0_1px_rgba(0,231,252,0.12)] transition-colors group-hover:bg-[#00e7fc]/15">
                    <Icon name={t.icon} size={16} />
                  </span>
                  <div className="flex flex-col gap-0.5 leading-tight">
                    <strong className="text-sm font-semibold text-white">{t.title}</strong>
                    <span className="text-xs text-slate-400">{t.desc}</span>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff6a] animate-pulse" />
              © {anoAtual} Complexo DMC · Todos os direitos reservados
            </footer>
          </div>
        </aside>

        {/* ───── Coluna direita · Card ───── */}
        <main className="relative w-full max-w-[440px] mx-auto lg:ml-auto lg:mr-0 overflow-hidden flex flex-col gap-5 rounded-[22px] p-[clamp(1.75rem,3.5vw,2.5rem)] border border-white/[0.07] backdrop-blur-2xl bg-[#0d181c]/[0.78] shadow-[0_24px_70px_-24px_rgba(0,0,0,0.7),0_8px_32px_-12px_rgba(0,231,252,0.15)]">
          <div
            className="pointer-events-none absolute top-0 left-[15%] right-[15%] h-px"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(0,231,252,0.5) 50%, transparent 100%)" }}
          />

          <header className="flex flex-col gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex w-fit items-center gap-1.5 text-[0.78rem] font-medium text-slate-400 transition-colors hover:text-slate-200"
              >
                <span className="text-base leading-none">‹</span> {backLabel}
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 w-fit px-2.5 py-1.5 mb-1 rounded-full bg-[#00e7fc]/[0.08] border border-[#00e7fc]/20 text-[#00e7fc] text-[0.7rem] font-semibold uppercase tracking-[0.1em]">
              <Icon name="lock" size={12} /> {badge}
            </span>
            <h2 className="text-[1.55rem] font-semibold tracking-tight text-white leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </header>

          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/25 text-rose-300 text-sm leading-snug" role="alert">
              <span className="shrink-0 mt-0.5"><Icon name="info" size={16} /></span>
              <span>{error}</span>
            </div>
          )}

          {children}

          {footer}
        </main>
      </div>
    </section>
  );
};

// Campo de senha reutilizável com botão de mostrar/ocultar.
const PasswordField = ({ id, label, value, onChange, placeholder = "••••••••", autoComplete = "current-password" }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.8rem] font-medium text-slate-300">{label}</label>
      <div className="relative flex items-center">
        <span className="absolute left-4 text-slate-500 pointer-events-none"><Icon name="lock" size={16} /></span>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full h-[54px] pl-11 pr-12 rounded-xl tech-input text-[0.95rem]"
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
          className="absolute right-2 w-9 h-9 grid place-items-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          {show ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
};

const LoginScreen = ({ username, password, setUsername, setPassword, onSubmit, loading, error, onBack, onRegister, onForgot }) => (
  <AuthShell
    onBack={onBack}
    backLabel="Voltar à página inicial"
    title="Bem-vindo de volta"
    subtitle="Acesse sua conta para continuar."
    error={error}
    footer={
      <p className="text-center text-[13px] text-slate-400">
        Ainda não tem acesso?{" "}
        <button type="button" onClick={onRegister} className="font-semibold text-[#00e7fc] hover:text-[#00ff6a] transition-colors">
          Cadastrar como dono
        </button>
      </p>
    }
  >
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {/* Usuário */}
      <div className="flex flex-col gap-2">
        <label htmlFor="login-user" className="text-[0.8rem] font-medium text-slate-300">Usuário ou e-mail</label>
        <div className="relative flex items-center">
          <span className="absolute left-4 text-slate-500 pointer-events-none"><Icon name="users" size={16} /></span>
          <input
            id="login-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full h-[54px] pl-11 pr-4 rounded-xl tech-input text-[0.95rem]"
            placeholder="seu e-mail ou usuário"
            required
          />
        </div>
      </div>

      <PasswordField id="login-pass" label="Senha" value={password} onChange={setPassword} autoComplete="current-password" />

      <div className="-mt-1 flex justify-end">
        <button type="button" onClick={onForgot} className="text-[0.78rem] font-medium text-slate-400 hover:text-[#00e7fc] transition-colors">
          Esqueci minha senha
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="relative w-full h-[54px] inline-flex items-center justify-center gap-2 rounded-xl tech-button text-[0.95rem] disabled:opacity-55 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-[#06262b]/40 border-t-[#06262b] animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            Entrar
            <Icon name="send" size={16} />
          </>
        )}
      </button>
    </form>
  </AuthShell>
);

// Tela de cadastro como dono — fica pendente de aprovação do administrador.
const RegisterScreen = ({ onBack }) => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (senha.length < 8) { setError("A senha deve ter ao menos 8 caracteres."); return; }
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          senha,
        }),
      });
      setDone(true);
    } catch (err) {
      setError(err.message || "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell onBack={onBack} backLabel="Voltar ao login" badge="Cadastro enviado" title="Solicitação enviada">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#00ff6a]/15 text-[#00ff6a] grid place-items-center">
            <Icon name="check" size={26} />
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            Cadastro enviado com sucesso. Aguarde a aprovação do administrador para acessar o sistema.
          </p>
          <button onClick={onBack} className="mt-1 w-full h-[50px] inline-flex items-center justify-center gap-2 rounded-xl tech-button text-[0.95rem]">
            Voltar ao login
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      onBack={onBack}
      backLabel="Voltar ao login"
      badge="Novo acesso"
      title="Cadastrar como dono"
      subtitle="Preencha seus dados. Seu acesso passa por aprovação do administrador."
      error={error}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="reg-nome" className="text-[0.8rem] font-medium text-slate-300">Nome</label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-500 pointer-events-none"><Icon name="users" size={16} /></span>
            <input id="reg-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name"
              className="w-full h-[54px] pl-11 pr-4 rounded-xl tech-input text-[0.95rem]" placeholder="Seu nome completo" required />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="reg-email" className="text-[0.8rem] font-medium text-slate-300">E-mail</label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-500 pointer-events-none"><Icon name="mail" size={16} /></span>
            <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              className="w-full h-[54px] pl-11 pr-4 rounded-xl tech-input text-[0.95rem]" placeholder="voce@empresa.com" required />
          </div>
        </div>

        <PasswordField id="reg-senha" label="Senha" value={senha} onChange={setSenha} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />

        <button type="submit" disabled={loading}
          className="relative w-full h-[54px] inline-flex items-center justify-center gap-2 rounded-xl tech-button text-[0.95rem] disabled:opacity-55 disabled:cursor-not-allowed">
          {loading ? (
            <><span className="w-4 h-4 rounded-full border-2 border-[#06262b]/40 border-t-[#06262b] animate-spin" /> Enviando...</>
          ) : (
            <>Solicitar acesso <Icon name="send" size={16} /></>
          )}
        </button>
      </form>
    </AuthShell>
  );
};

// Tela "esqueci minha senha" — solicita o e-mail e dispara o link de redefinição.
const ForgotPasswordScreen = ({ onBack }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/esqueci-senha", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch (_) {
      // Mensagem genérica independente do resultado (não revela se o e-mail existe).
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  return (
    <AuthShell
      onBack={onBack}
      backLabel="Voltar ao login"
      badge="Recuperar acesso"
      title="Redefinir senha"
      subtitle={done ? null : "Informe o e-mail cadastrado para receber o link de redefinição."}
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#00e7fc]/15 text-[#00e7fc] grid place-items-center">
            <Icon name="mail" size={26} />
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição.
          </p>
          <button onClick={onBack} className="mt-1 w-full h-[50px] inline-flex items-center justify-center gap-2 rounded-xl tech-button text-[0.95rem]">
            Voltar ao login
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="forgot-email" className="text-[0.8rem] font-medium text-slate-300">E-mail</label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-500 pointer-events-none"><Icon name="mail" size={16} /></span>
              <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                className="w-full h-[54px] pl-11 pr-4 rounded-xl tech-input text-[0.95rem]" placeholder="voce@empresa.com" required />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="relative w-full h-[54px] inline-flex items-center justify-center gap-2 rounded-xl tech-button text-[0.95rem] disabled:opacity-55 disabled:cursor-not-allowed">
            {loading ? (
              <><span className="w-4 h-4 rounded-full border-2 border-[#06262b]/40 border-t-[#06262b] animate-spin" /> Enviando...</>
            ) : (
              <>Enviar instruções <Icon name="send" size={16} /></>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

// ============================================================
//  LANDING — página institucional exibida antes do login
//  Apresenta apenas recursos que existem de fato no sistema.
// ============================================================
const LANDING_FEATURES = [
  { icon: "building", title: "Cadastro de empresas", desc: "Organize incorporadoras, construtoras e imobiliárias com consulta automática de dados por CNPJ." },
  { icon: "users", title: "Decisores", desc: "Identifique sócios e diretores a partir do quadro societário e enriqueça com contatos encontrados na web." },
  { icon: "phone", title: "Clientes", desc: "Centralize sua carteira de contatos com e-mails e telefones reunidos em massa." },
  { icon: "map", title: "Mapeamento de mercado", desc: "Levante o mercado de uma região e visualize a prospecção em mapa interativo." },
  { icon: "megaphone", title: "Campanhas", desc: "Dispare mensagens em massa por WhatsApp ou e-mail para empresas e clientes selecionados." },
  { icon: "file", title: "Templates", desc: "Modelos de mensagem com variáveis personalizadas para padronizar o atendimento." },
  { icon: "whatsapp", title: "WhatsApp integrado", desc: "Conecte sua conta, acompanhe conversas e fale com os decisores sem sair do sistema." },
  { icon: "layers", title: "Complexo DMC", desc: "Esteira de aquisição de ativos: empreendimentos, mapa de ativos, documentos e visão para fundos." },
];

const LANDING_BENEFITS = [
  { icon: "database", title: "Tudo centralizado", desc: "Empresas, decisores, clientes, mercado e conversas em um único lugar — sem planilhas espalhadas." },
  { icon: "spark", title: "Mais agilidade", desc: "Dados de contato e do CNPJ são reunidos automaticamente, reduzindo o trabalho manual de prospecção." },
  { icon: "chart", title: "Controle do funil", desc: "Acompanhe métricas e o andamento da prospecção pelo painel, com histórico das ações." },
  { icon: "check", title: "Operação padronizada", desc: "Templates e campanhas garantem comunicação consistente em toda a equipe." },
];

const LandingPage = ({ onEnter, onRegister }) => {
  const anoAtual = new Date().getFullYear();
  const nav = [
    { href: "#inicio", label: "Início" },
    { href: "#recursos", label: "Recursos" },
    { href: "#beneficios", label: "Benefícios" },
    { href: "#contato", label: "Contato" },
  ];

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden scroll-smooth text-white antialiased"
      style={{ background: "linear-gradient(180deg, #071417 0%, #04090b 100%)" }}
    >
      {/* ───────── Topo / navegação ───────── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#06121580]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#inicio" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#12e7ff] to-[#00ff6a] text-[#06262b] shadow-[0_0_20px_rgba(18,231,255,0.35)]">
              <Icon name="building" size={18} />
            </span>
            <span className="text-[#00ff6a] text-sm font-extrabold tracking-[0.32em] leading-none">IMOBPRO</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onRegister}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/12 px-4 text-sm font-medium text-slate-200 transition-colors hover:border-[#12e7ff]/40 hover:text-white"
            >
              Criar conta
            </button>
            <button
              onClick={onEnter}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm tech-button"
            >
              Entrar
              <Icon name="lock" size={14} />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ───────── Hero ───────── */}
        <section id="inicio" className="relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div
              className="absolute -right-[12%] -top-[18%] h-[560px] w-[560px] rounded-full opacity-50 blur-[110px]"
              style={{ background: "radial-gradient(circle, rgba(18,231,255,0.22), transparent 65%)" }}
            />
            <div
              className="absolute -bottom-[20%] -left-[12%] h-[460px] w-[460px] rounded-full opacity-40 blur-[110px]"
              style={{ background: "radial-gradient(circle, rgba(0,255,106,0.14), transparent 62%)" }}
            />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div className="flex flex-col gap-7">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#12e7ff]/25 bg-[#12e7ff]/[0.07] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#12e7ff]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#12e7ff] shadow-[0_0_10px_rgba(18,231,255,0.7)]" />
                Plataforma de prospecção imobiliária
              </span>

              <h1 className="text-[clamp(2.3rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-tight">
                A prospecção da sua imobiliária,
                <span className="text-gradient"> organizada de ponta a ponta.</span>
              </h1>

              <p className="max-w-[52ch] text-lg leading-relaxed text-slate-300">
                O ImobPro reúne empresas, decisores, clientes, mercado e WhatsApp em um só lugar.
                Pensado para incorporadoras, construtoras, imobiliárias e gestoras de ativos que
                querem prospectar com método e contexto — sem perder informação pelo caminho.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  onClick={onRegister}
                  className="inline-flex h-12 items-center gap-2 rounded-xl px-7 text-[0.95rem] tech-button"
                >
                  Criar conta
                  <Icon name="send" size={16} />
                </button>
                <button
                  onClick={onEnter}
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/12 px-6 text-[0.95rem] font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.04]"
                >
                  Já tenho conta
                  <Icon name="lock" size={15} />
                </button>
              </div>
            </div>

            {/* Painel demonstrativo abstrato — construído com a própria UI do sistema */}
            <div className="relative">
              <div className="surface-strong relative overflow-hidden rounded-2xl p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
                <div
                  className="pointer-events-none absolute left-[12%] right-[12%] top-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(18,231,255,0.5), transparent)" }}
                />
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#12e7ff]/15 text-[#12e7ff]"><Icon name="home" size={15} /></span>
                    <span className="text-sm font-semibold text-slate-200">Visão geral</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">Painel</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { l: "Empresas", v: "128", a: "#12e7ff", i: "building" },
                    { l: "Decisores", v: "342", a: "#00ff6a", i: "users" },
                    { l: "Campanhas", v: "17", a: "#f59e0b", i: "megaphone" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${s.a}22`, color: s.a }}>
                        <Icon name={s.i} size={13} />
                      </span>
                      <p className="mt-2 text-xl font-bold tracking-tight">{s.v}</p>
                      <p className="text-[11px] text-slate-500">{s.l}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    { n: "Mapeamento de mercado", t: "Consolação / Jardins", i: "map" },
                    { n: "Conversa no WhatsApp", t: "Decisor respondeu", i: "whatsapp" },
                    { n: "Esteira de aquisição", t: "Complexo DMC", i: "layers" },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#12e7ff]/10 text-[#12e7ff]"><Icon name={r.i} size={14} /></span>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[13px] font-medium text-slate-200">{r.n}</p>
                        <p className="truncate text-[11px] text-slate-500">{r.t}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── O que é / para quem ───────── */}
        <section className="border-y border-white/[0.05] bg-white/[0.012]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Feito para quem vive de prospecção</h2>
              <p className="mt-3 max-w-[48ch] leading-relaxed text-slate-400">
                Incorporadoras, construtoras, imobiliárias e gestoras de ativos lidam com muitas frentes ao
                mesmo tempo: empresas para abordar, decisores a encontrar, mercado a entender e conversas a
                acompanhar. O ImobPro junta tudo isso em um fluxo único.
              </p>
            </div>
            <div className="grid gap-4">
              {[
                "Informações de prospecção espalhadas em planilhas e anotações",
                "Dificuldade de chegar ao decisor certo dentro de cada empresa",
                "Falta de visão clara do mercado de uma região",
                "Contato manual, lento e sem padronização",
              ].map((p) => (
                <div key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#00ff6a]/12 text-[#00ff6a]"><Icon name="check" size={13} /></span>
                  <p className="text-sm leading-relaxed text-slate-300">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Recursos ───────── */}
        <section id="recursos" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="mb-12 max-w-2xl">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#12e7ff]">Recursos</span>
            <h2 className="mt-3 text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold tracking-tight">
              Tudo o que a prospecção precisa, em módulos integrados
            </h2>
            <p className="mt-3 leading-relaxed text-slate-400">
              Cada módulo resolve uma etapa do trabalho e conversa com os demais.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LANDING_FEATURES.map((f) => (
              <article
                key={f.title}
                className="group surface-strong rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#12e7ff]/20 bg-[#12e7ff]/[0.07] text-[#12e7ff] transition-colors group-hover:bg-[#12e7ff]/15">
                  <Icon name={f.icon} size={19} />
                </span>
                <h3 className="mt-4 text-[0.98rem] font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ───────── Benefícios ───────── */}
        <section id="beneficios" className="border-t border-white/[0.05] bg-white/[0.012]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <div className="mb-12 max-w-2xl">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#00ff6a]">Benefícios</span>
              <h2 className="mt-3 text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold tracking-tight">
                O que muda no dia a dia da equipe
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {LANDING_BENEFITS.map((b) => (
                <div key={b.title} className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#12e7ff]/18 to-[#00ff6a]/14 text-[#12e7ff]">
                    <Icon name={b.icon} size={19} />
                  </span>
                  <div>
                    <h3 className="text-[1.02rem] font-semibold text-white">{b.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Chamada final ───────── */}
        <section id="contato" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-[#12e7ff]/15 px-8 py-14 text-center"
            style={{ background: "radial-gradient(ellipse 80% 120% at 50% 0%, rgba(18,231,255,0.10), transparent 60%), linear-gradient(180deg, rgba(13,38,41,0.6), rgba(8,25,27,0.6))" }}
          >
            <h2 className="mx-auto max-w-2xl text-[clamp(1.9rem,3.8vw,2.6rem)] font-bold tracking-tight">
              Pronto para prospectar com mais método?
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate-300">
              Crie sua conta para solicitar acesso ou entre com suas credenciais e continue de onde parou.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={onRegister}
                className="inline-flex h-12 items-center gap-2 rounded-xl px-8 text-[0.95rem] tech-button"
              >
                Criar conta
                <Icon name="send" size={16} />
              </button>
              <button
                onClick={onEnter}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/12 px-7 text-[0.95rem] font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.04]"
              >
                Entrar
                <Icon name="lock" size={15} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ───────── Rodapé ───────── */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#12e7ff] to-[#00ff6a] text-[#06262b]">
              <Icon name="building" size={15} />
            </span>
            <div className="leading-tight">
              <p className="text-[#00ff6a] text-xs font-extrabold tracking-[0.3em]">IMOBPRO</p>
              <p className="text-[11px] text-slate-500">Prospecção imobiliária</p>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 sm:text-right">
            © {anoAtual} Complexo DMC · Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
};

// ---- STAT CARD ----
const StatCard = ({ label, value, icon, accent = "#00e7fc", sub }) => (
  <div className="relative overflow-hidden rounded-2xl surface-strong p-5 group hover:border-white/20 transition-all duration-300">
    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"
      style={{ background: accent, transform: "translate(40%, -40%)" }} />
    <div className="flex items-start justify-between mb-3">
      <span className="text-slate-400 text-sm font-medium">{label}</span>
      <div className="p-2 rounded-xl" style={{ background: `${accent}22` }}>
        <span style={{ color: accent }}><Icon name={icon} size={16} /></span>
      </div>
    </div>
    <p className="text-3xl font-bold text-white tracking-tight">{value ?? "—"}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

// ---- EMPRESA CARD ----
const EmpresaCard = ({ empresa, onSelect }) => (
  <div
    onClick={() => onSelect(empresa)}
    className="group surface-strong rounded-2xl p-4 hover:border-white/20 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
  >
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00e7fc]/25 to-[#00ff4d]/18 border border-[#00e7fc]/25 flex items-center justify-center flex-shrink-0">
        <span className="text-[#00e7fc]"><Icon name="building" size={16} /></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-white font-medium text-sm truncate">{empresa.nome}</h3>
          {empresa.tipo && <Badge color={tipoColor(empresa.tipo)}>{empresa.tipo}</Badge>}
          {empresa.prioridade && empresa.prioridade !== "normal" && (
            <Badge color={prioridadeInfo(empresa.prioridade).color}>{prioridadeInfo(empresa.prioridade).label}</Badge>
          )}
        </div>
        <p className="text-slate-500 text-xs">{empresa.eixo || empresa.bairro || empresa.regiao || "SP"}</p>
        {empresa.cargo_alvo && <p className="text-slate-600 text-xs mt-0.5">Alvo: {empresa.cargo_alvo}</p>}
        {empresa.cnpj && <p className="text-slate-600 text-xs mt-0.5">CNPJ: {empresa.cnpj}</p>}
      </div>
    </div>
    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#00e7fc]/8">
      <Badge color={statusInfo(empresa.status_prospeccao).color}>{statusInfo(empresa.status_prospeccao).label}</Badge>
      {empresa.whatsapp && (
        <span className="flex items-center gap-1 text-emerald-400 text-xs">
          <Icon name="whatsapp" size={12} /> {empresa.whatsapp}
        </span>
      )}
      {empresa.total_conversas > 0 && (
        <span className="text-xs text-slate-500">{empresa.total_conversas} conversa(s)</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {empresa.tags?.slice(0, 2).map(t => (
          <Badge key={t} color="slate">{t}</Badge>
        ))}
      </div>
    </div>
  </div>
);

// ---- EMPRESA DETAIL MODAL ----
const EmpresaModal = ({ empresa, templates = [], onClose, onRefreshCNPJ, onEmpresaUpdated, onSendWA }) => {
  const [numeros, setNumeros] = useState([empresa.whatsapp || empresa.telefone || ""]);
  const numerosValidos = numeros.map(n => (n || "").trim()).filter(Boolean);
  const setNumeroAt = (i, v) => setNumeros(arr => arr.map((n, idx) => (idx === i ? v : n)));
  const addNumero = () => setNumeros(arr => [...arr, ""]);
  const removeNumero = (i) => setNumeros(arr => (arr.length <= 1 ? [""] : arr.filter((_, idx) => idx !== i)));
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [discoveringWhatsApp, setDiscoveringWhatsApp] = useState(false);
  const [discoveringEmail, setDiscoveringEmail] = useState(false);
  const [emailInfo, setEmailInfo] = useState(null);
  const [cnpjInput, setCnpjInput] = useState(empresa.cnpj || "");
  const [cnpjData, setCnpjData] = useState(null);
  const [tab, setTab] = useState("info");
  const [templateAtivo, setTemplateAtivo] = useState(null);
  const [whatsappFonte, setWhatsappFonte] = useState(empresa.fonte_whatsapp || "");
  // Funil de prospecção
  const [prosp, setProsp] = useState({
    status_prospeccao: empresa.status_prospeccao || "nao_iniciado",
    prioridade: empresa.prioridade || "normal",
    proxima_acao: empresa.proxima_acao || "",
  });
  const [savingProsp, setSavingProsp] = useState(false);

  const aplicarTemplate = (template) => {
    if (!template) return;
    const replacements = {
      nome: empresa.nome || "",
      empresa: empresa.nome || "",
      razao_social: empresa.razao_social || empresa.nome || "",
      cargo_alvo: empresa.cargo_alvo || "",
      eixo: empresa.eixo || empresa.regiao || "",
      bairro: empresa.bairro || "",
      regiao: empresa.regiao || "",
      setor: empresa.tipo || "",
    };

    let conteudo = template.conteudo || "";
    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
      conteudo = conteudo.replace(regex, value);
    });

    setTemplateAtivo(template.id);
    setMsg(conteudo);
  };

  const salvarProspeccao = async () => {
    setSavingProsp(true);
    try {
      await api(`/api/empresas/${empresa.id}`, { method: "PATCH", body: JSON.stringify(prosp) });
      onRefreshCNPJ?.();
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSavingProsp(false);
    }
  };

  const handleEnrichCNPJ = async () => {
    if (!cnpjInput) return;
    setLoading(true);
    try {
      const data = await api(`/api/cnpj/consulta/${cnpjInput.replace(/\D/g, "")}`);
      setCnpjData(data);
    } catch (e) {
      alert("Erro ao consultar CNPJ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndEnrich = async () => {
    setLoading(true);
    try {
      await api(`/api/empresas/${empresa.id}`, {
        method: "PATCH",
        body: JSON.stringify({ cnpj: cnpjInput }),
      });
      await api(`/api/empresas/${empresa.id}/enrich-cnpj`, { method: "POST" });
      onRefreshCNPJ?.();
      onClose();
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverWhatsApp = async () => {
    setDiscoveringWhatsApp(true);
    try {
      const data = await api(`/api/empresas/${empresa.id}/discover-whatsapp`, { method: "POST" });
      const novoNumero = data?.whatsapp || data?.empresa?.whatsapp || "";
      if (!novoNumero) throw new Error("nenhum WhatsApp encontrado");
      setNumeros(arr => {
        if (arr.map(n => (n || "").trim()).includes(novoNumero.trim())) return arr;
        const i = arr.findIndex(n => !(n || "").trim());
        if (i === -1) return [...arr, novoNumero];
        return arr.map((n, idx) => (idx === i ? novoNumero : n));
      });
      setWhatsappFonte(data?.fonte_whatsapp || "");
      onEmpresaUpdated?.(data?.empresa || { ...empresa, whatsapp: novoNumero });
      onRefreshCNPJ?.();
      alert(`WhatsApp encontrado: ${novoNumero}`);
    } catch (e) {
      alert("Erro ao descobrir WhatsApp: " + e.message);
    } finally {
      setDiscoveringWhatsApp(false);
    }
  };

  const handleDiscoverEmail = async () => {
    setDiscoveringEmail(true);
    try {
      const data = await api(`/api/empresas/${empresa.id}/discover-email`, { method: "POST" });
      setEmailInfo(data);
      if (data?.empresa) onEmpresaUpdated?.(data.empresa);
      onRefreshCNPJ?.();
      const donos = (data?.donos || []).length;
      alert(
        `E-mail da empresa: ${data?.email_empresa || "não definido"}.` +
        (donos ? ` ${donos} e-mail(s) de dono(s) salvos como contato.` : "")
      );
    } catch (e) {
      alert("Erro ao buscar e-mails: " + e.message);
    } finally {
      setDiscoveringEmail(false);
    }
  };

  const handleSendWA = async () => {
    if (!numerosValidos.length || !msg) return;
    setLoading(true);
    try {
      const erros = [];
      for (const numero of numerosValidos) {
        try {
          await api("/api/whatsapp/enviar", {
            method: "POST",
            body: JSON.stringify({ empresa_id: empresa.id, numero, mensagem: msg }),
          });
        } catch (e) {
          erros.push(`${numero}: ${e.message}`);
        }
      }
      const enviados = numerosValidos.length - erros.length;
      if (erros.length) {
        alert(`Enviado para ${enviados}/${numerosValidos.length} número(s).\nFalhas:\n${erros.join("\n")}`);
      } else {
        alert(`✅ Mensagem enviada para ${enviados} número(s)!`);
        setMsg("");
      }
    } catch (e) {
      alert("Erro ao enviar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={empresa.nome}>
      <div className="flex gap-2 mb-5">
        {["info", "cnpj", "whatsapp"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t
              ? "bg-gradient-to-r from-[#00e7fc] to-[#00ff4d] !text-[#06262b]" : "text-slate-400 hover:text-white"}`}>
            {t === "info" ? "Informações" : t === "cnpj" ? "Receita Federal" : "WhatsApp"}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="space-y-3">
          {/* Editor de prospecção (funil) */}
          <div className="rounded-xl border border-[#00e7fc]/15 bg-[#00e7fc]/5 p-4 space-y-3">
            <h4 className="text-white text-sm font-semibold flex items-center gap-2"><Icon name="chart" size={14} /> Prospecção</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs block mb-1">Status do funil</label>
                <select value={prosp.status_prospeccao}
                  onChange={e => setProsp(p => ({ ...p, status_prospeccao: e.target.value }))}
                  className="w-full tech-input rounded-lg px-2 py-1.5 text-white text-sm">
                  {STATUS_PROSPECCAO.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">Prioridade</label>
                <select value={prosp.prioridade}
                  onChange={e => setProsp(p => ({ ...p, prioridade: e.target.value }))}
                  className="w-full tech-input rounded-lg px-2 py-1.5 text-white text-sm">
                  {PRIORIDADES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Próxima ação</label>
              <input value={prosp.proxima_acao}
                onChange={e => setProsp(p => ({ ...p, proxima_acao: e.target.value }))}
                placeholder="Ex: Ligar para o síndico, enviar proposta..."
                className="w-full tech-input rounded-lg px-2 py-1.5 text-white text-sm" />
            </div>
            <button onClick={salvarProspeccao} disabled={savingProsp}
              className="px-3 py-1.5 tech-button rounded-lg text-sm font-medium disabled:opacity-50">
              {savingProsp ? "Salvando..." : "Salvar prospecção"}
            </button>
          </div>

          {[
            ["Tipo", empresa.tipo],
            ["Eixo", empresa.eixo],
            ["Cargo-alvo", empresa.cargo_alvo],
            ["Administradora", empresa.administradora],
            ["Tel. Administradora", empresa.tel_administradora],
            ["Síndico", empresa.sindico],
            ["Tel. Síndico", empresa.tel_sindico],
            ["Portaria/Zelador", empresa.zelador],
            ["Tel. Portaria", empresa.tel_portaria],
            ["Razão Social", empresa.razao_social],
            ["Nome Fantasia", empresa.nome_fantasia],
            ["Bairro/Região", empresa.bairro || empresa.regiao],
            ["E-mail", empresa.email],
            ["Telefone", empresa.telefone],
            ["WhatsApp", empresa.whatsapp],
            ["LinkedIn", empresa.linkedin],
            ["Site", empresa.website],
            ["Situação", empresa.situacao_cadastral],
            ["Porte", empresa.porte],
            ["Fonte CNPJ", empresa.cnpj_fonte],
          ].map(([label, val]) => val ? (
            <div key={label} className="flex justify-between py-2 border-b border-[#00e7fc]/8">
              <span className="text-slate-500 text-sm">{label}</span>
              <span className="text-white text-sm font-medium">{val}</span>
            </div>
          ) : null)}
          {empresa.observacoes && (
            <div className="mt-3 p-3 bg-white/5 rounded-xl">
              <p className="text-slate-400 text-xs">{empresa.observacoes}</p>
            </div>
          )}

          {/* Captação de e-mails (empresa + donos) */}
          <div className="mt-3 p-3 rounded-xl border border-[#00e7fc]/15 bg-white/5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-white text-sm font-medium">Buscar e-mails no site</p>
                <p className="text-slate-500 text-xs">Pega o e-mail da empresa e tenta casar e-mails com os donos (QSA).</p>
              </div>
              <button onClick={handleDiscoverEmail} disabled={discoveringEmail}
                className="shrink-0 px-3 py-2 rounded-xl text-sm font-medium border border-sky-400/40 text-sky-300 hover:bg-sky-400/10 disabled:opacity-60 transition-colors flex items-center gap-2">
                <Icon name="mail" size={15} /> {discoveringEmail ? "Buscando…" : "Buscar"}
              </button>
            </div>
            {emailInfo && (
              <div className="space-y-1.5 pt-1">
                {emailInfo.email_empresa && (
                  <p className="text-xs text-slate-300"><span className="text-slate-500">Empresa:</span> {emailInfo.email_empresa}</p>
                )}
                {(emailInfo.donos || []).map((d, i) => (
                  <p key={i} className="text-xs text-emerald-300"><span className="text-slate-500">{d.qualificacao || "Dono"} · {d.nome}:</span> {d.email}</p>
                ))}
                {(emailInfo.emails || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {emailInfo.emails.map((e, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-slate-400">{e}</span>
                    ))}
                  </div>
                )}
                {(emailInfo.emails || []).length === 0 && (
                  <p className="text-xs text-slate-500">Nenhum e-mail encontrado.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "cnpj" && (
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">CNPJ</label>
            <div className="flex gap-2">
              <input
                value={cnpjInput}
                onChange={e => setCnpjInput(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="flex-1 bg-white/5 border border-[#00e7fc]/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00e7fc]"
              />
              <button onClick={handleEnrichCNPJ} disabled={loading}
                className="px-3 py-2 bg-gradient-to-r from-[#00e7fc] to-[#00ff4d] !text-[#06262b] hover:shadow-[0_0_18px_rgba(0,231,252,0.45)] rounded-xl text-white text-sm disabled:opacity-50 transition-colors">
                {loading ? "..." : <Icon name="search" size={16} />}
              </button>
            </div>
          </div>

          {cnpjData && (
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              {[
                ["Razão Social", cnpjData.razao_social],
                ["Situação", cnpjData.situacao_cadastral],
                ["Abertura", cnpjData.data_abertura],
                ["Natureza Jurídica", cnpjData.natureza_juridica],
                ["Porte", cnpjData.porte],
                ["CNAE", cnpjData.cnae_descricao],
                ["Endereço", [cnpjData.logradouro, cnpjData.numero, cnpjData.bairro, cnpjData.municipio].filter(Boolean).join(", ")],
                ["E-mail", cnpjData.email],
                ["Telefone", cnpjData.telefone],
              ].map(([l, v]) => v ? (
                <div key={l} className="flex justify-between gap-3">
                  <span className="text-slate-500 text-xs shrink-0">{l}</span>
                  <span className="text-white text-xs text-right">{v}</span>
                </div>
              ) : null)}

              {cnpjData.qsa?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#00e7fc]/15">
                  <p className="text-slate-400 text-xs font-medium mb-2">Quadro Societário</p>
                  {cnpjData.qsa.map((s, i) => (
                    <div key={i} className="text-xs text-slate-300">{s.nome_socio} — {s.qualificacao_socio}</div>
                  ))}
                </div>
              )}

              <button onClick={handleSaveAndEnrich} disabled={loading}
                className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                <Icon name="check" size={16} /> Salvar na empresa
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#00e7fc]/10 bg-[#00e7fc]/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white text-sm font-medium">Buscar WhatsApp no site</p>
                <p className="text-slate-500 text-xs mt-1">
                  O robô tenta encontrar um número válido no site oficial ou nas páginas de contato da empresa.
                </p>
              </div>
              <button
                onClick={handleDiscoverWhatsApp}
                disabled={discoveringWhatsApp}
                className="px-3 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#00e7fc] to-[#00ff4d] !text-[#06262b] disabled:opacity-50"
              >
                {discoveringWhatsApp ? "Buscando..." : "Buscar"}
              </button>
            </div>
            {whatsappFonte && (
              <p className="text-[11px] text-slate-500 mt-2 break-all">
                Fonte encontrada: {whatsappFonte}
              </p>
            )}
          </div>

          {templates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-slate-400 text-sm">Templates</label>
                {templateAtivo && (
                  <button
                    onClick={() => {
                      setTemplateAtivo(null);
                      setMsg("");
                    }}
                    className="text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => aplicarTemplate(template)}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      templateAtivo === template.id
                        ? "border-[#00e7fc]/35 bg-[#00e7fc]/10"
                        : "border-white/5 bg-white/3 hover:border-[#00e7fc]/20 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{template.nome}</div>
                        <div className="text-[11px] text-slate-500">{template.categoria || "sem categoria"}</div>
                      </div>
                      <Badge color="sky">usar</Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 line-clamp-2">{template.conteudo}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Números WhatsApp</label>
            <div className="space-y-2">
              {numeros.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={n}
                    onChange={e => setNumeroAt(i, e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="flex-1 bg-white/5 border border-[#00e7fc]/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeNumero(i)}
                    title="Descartar número"
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-rose-500/25 text-rose-300 hover:bg-rose-500/10 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addNumero}
              className="mt-2 text-xs text-[#00e7fc] hover:text-white transition-colors"
            >
              + Adicionar outro número
            </button>
            <p className="text-[11px] text-slate-500 mt-1">
              Se o número vier do site, ele já entra normalizado para uso no envio. A mensagem é enviada para todos os números preenchidos.
            </p>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Mensagem</label>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={5}
              className="w-full bg-white/5 border border-[#00e7fc]/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          <button onClick={handleSendWA} disabled={loading || !numerosValidos.length || !msg}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <Icon name="whatsapp" size={16} />
            {loading ? "Enviando..." : "Enviar via WhatsApp"}
          </button>
        </div>
      )}
    </Modal>
  );
};

// ---- MAIN APP ----
export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("admin123");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showLogin, setShowLogin] = useState(false); // landing institucional antes do login
  const [authMode, setAuthMode] = useState("login"); // "login" | "register" | "forgot"
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [campanhaTargets, setCampanhaTargets] = useState([]);
  const [campanhaTargetSearch, setCampanhaTargetSearch] = useState("");
  const [campanhaSelectedIds, setCampanhaSelectedIds] = useState([]);
  const [campanhaCanal, setCampanhaCanal] = useState("whatsapp"); // "whatsapp" | "email"
  const [campanhaFonte, setCampanhaFonte] = useState("empresas"); // "empresas" | "clientes"
  const [campanhaNome, setCampanhaNome] = useState("");
  const [campanhaDescricao, setCampanhaDescricao] = useState("");
  const [campanhaAssunto, setCampanhaAssunto] = useState("");
  const [campanhaMensagem, setCampanhaMensagem] = useState("");
  const [campanhaTemplateId, setCampanhaTemplateId] = useState("");
  const [campanhaMediaUrl, setCampanhaMediaUrl] = useState("");
  const [campanhaMediaNome, setCampanhaMediaNome] = useState("");
  const [campanhaMediaMime, setCampanhaMediaMime] = useState("");
  const [campanhaMediaType, setCampanhaMediaType] = useState("");
  const [campanhaMediaPreview, setCampanhaMediaPreview] = useState("");
  const [campanhaEnviando, setCampanhaEnviando] = useState(false);
  const [campanhaResultado, setCampanhaResultado] = useState(null);
  const [marketItems, setMarketItems] = useState([]);
  const [marketSummary, setMarketSummary] = useState(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [loading, setLoading] = useState(false);
  // ---- Decisores ----
  const [decisores, setDecisores] = useState([]);
  const [decisoresQuals, setDecisoresQuals] = useState([]);
  const [decisoresLoading, setDecisoresLoading] = useState(false);
  const [decBusca, setDecBusca] = useState("");
  const [decQual, setDecQual] = useState("");
  const [pesquisaEmpresa, setPesquisaEmpresa] = useState("");
  const [pesquisaTermo, setPesquisaTermo] = useState("");
  const [pesquisaResultado, setPesquisaResultado] = useState(null);
  const [pesquisando, setPesquisando] = useState(false);
  const [contatoForm, setContatoForm] = useState(null); // objeto = modal aberto
  const [contatoBusca, setContatoBusca] = useState({}); // { [idx]: {loading, emails, telefones, fontes, tem_provedor} }
  const [decMassaLoading, setDecMassaLoading] = useState(false);
  const [decMassaResult, setDecMassaResult] = useState(null);
  const [decMassaProgress, setDecMassaProgress] = useState(null); // { feito, total }
  // ---- Clientes ----
  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelectedIds, setClienteSelectedIds] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketScanning, setMarketScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [marketArea, setMarketArea] = useState("Consolação/Jardins/Bela Vista");
  const [marketTipo, setMarketTipo] = useState("");
  const [areaSugg, setAreaSugg] = useState([]);
  const [areaOpen, setAreaOpen] = useState(false);
  const [waStatus, setWaStatus] = useState(null);
  const [waQR, setWaQR] = useState(null);
  const [waLoadingQR, setWaLoadingQR] = useState(false);
  // Contas de WhatsApp (multi-instância)
  const [waContas, setWaContas] = useState([]);
  const [waInstance, setWaInstance] = useState("imobpro");
  const [waContasLoading, setWaContasLoading] = useState(false);
  const [waNovaConta, setWaNovaConta] = useState("");
  const [waAddingConta, setWaAddingConta] = useState(false);
  // Inbox / espelho WhatsApp
  const [convList, setConvList] = useState([]);
  const [convActive, setConvActive] = useState(null);
  const [convMsgs, setConvMsgs] = useState([]);
  const [convInput, setConvInput] = useState("");
  const [convSending, setConvSending] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [newEmpresa, setNewEmpresa] = useState({ nome: "", tipo: "incorporadora", bairro: "", cnpj: "" });
  const [showNewModal, setShowNewModal] = useState(false);
  const [discoveringAllWA, setDiscoveringAllWA] = useState(false);
  const [discoveringAllEmail, setDiscoveringAllEmail] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ nome: "", categoria: "", conteudo: "" });
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [enriching, setEnriching] = useState(false);
  // ---- Tarefas ----
  const TAREFA_FORM_VAZIO = { titulo: "", descricao: "", responsavel: "", prioridade: "media", status: "pendente", data_vencimento: "", observacoes: "" };
  const [tarefas, setTarefas] = useState([]);
  const [tarefasResumo, setTarefasResumo] = useState({ total: 0, pendentes: 0, em_andamento: 0, concluidas: 0, vencidas: 0 });
  const [tarefasLoading, setTarefasLoading] = useState(false);
  const [tarefaBusca, setTarefaBusca] = useState("");
  const [tarefaFiltroStatus, setTarefaFiltroStatus] = useState("");
  const [tarefaFiltroPrioridade, setTarefaFiltroPrioridade] = useState("");
  const [tarefaFiltroResponsavel, setTarefaFiltroResponsavel] = useState("");
  const [tarefaFiltroVenceAte, setTarefaFiltroVenceAte] = useState("");
  const [tarefaFiltroVencidas, setTarefaFiltroVencidas] = useState(false);
  const [tarefaForm, setTarefaForm] = useState(TAREFA_FORM_VAZIO);
  const [showTarefaModal, setShowTarefaModal] = useState(false);
  const [editingTarefaId, setEditingTarefaId] = useState(null);
  const [tarefaView, setTarefaView] = useState(null);
  const [tarefaSaving, setTarefaSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) setAuthChecked(true);
        return;
      }
      try {
        const data = await api("/api/auth/me");
        if (cancelled) return;
        setAuthUser(data?.user || null);
        setIsAuthed(true);
      } catch (e) {
        setStoredToken("");
        if (!cancelled) {
          setAuthUser(null);
          setIsAuthed(false);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    };
    initAuth();
    return () => {
      cancelled = true;
    };
  }, [campanhaMediaPreview]);

  useEffect(() => {
    if (!authChecked || !isAuthed) return;
    const savedPage = getStoredPage();
    if (savedPage && isValidPage(savedPage)) {
      setPage(savedPage);
    } else {
      setStoredPage(page);
    }
  }, [authChecked, isAuthed]);

  useEffect(() => {
    if (!isAuthed || !isValidPage(page)) return;
    setStoredPage(page);
  }, [isAuthed, page]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      setStoredToken(data.access_token);
      setAuthUser(data.user || null);
      setIsAuthed(true);
      setAuthChecked(true);
      setPage("dashboard");
    } catch (err) {
      setLoginError(err.message || "Falha ao autenticar");
      setStoredToken("");
      setIsAuthed(false);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    setStoredToken("");
    setIsAuthed(false);
    setAuthUser(null);
    setLoginError("");
    setPage("dashboard");
    setStats(null);
    setEmpresas([]);
    setTemplates([]);
    setCampanhas([]);
    setMarketItems([]);
    setMarketSummary(null);
    setSelectedEmpresa(null);
    setWaStatus(null);
    setWaQR(null);
    setConvList([]);
    setConvActive(null);
    setConvMsgs([]);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api("/api/dashboard");
      setStats(data);
    } catch (e) {}
  }, []);

  const loadEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("busca", search);
      if (filterTipo) params.set("tipo", filterTipo);
      const data = await api(`/api/empresas?${params}`);
      setEmpresas(data.items || []);
    } catch (e) {
      setEmpresas([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterTipo]);

  const loadDecisores = useCallback(async () => {
    setDecisoresLoading(true);
    try {
      const params = new URLSearchParams();
      if (decBusca) params.set("busca", decBusca);
      if (decQual) params.set("qualificacao", decQual);
      const data = await api(`/api/decisores?${params}`);
      setDecisores(data.items || []);
      setDecisoresQuals(data.qualificacoes || []);
    } catch (e) {
      setDecisores([]);
    } finally {
      setDecisoresLoading(false);
    }
  }, [decBusca, decQual]);

  const handlePesquisarDecisores = async () => {
    const alvo = pesquisaEmpresa.trim();
    if (!alvo) { alert("Informe o nome da empresa para pesquisar."); return; }
    setPesquisando(true);
    setPesquisaResultado(null);
    try {
      const r = await api("/api/decisores/pesquisar", {
        method: "POST",
        body: JSON.stringify({ empresa: alvo, termo: pesquisaTermo.trim() }),
      });
      setPesquisaResultado(r);
    } catch (e) {
      alert("Erro na pesquisa: " + e.message);
    } finally {
      setPesquisando(false);
    }
  };

  const handleSalvarContato = async () => {
    if (!contatoForm?.nome?.trim()) { alert("Informe o nome."); return; }
    if (!contatoForm?.empresa_id) { alert("Selecione a empresa do contato."); return; }
    try {
      await api("/api/decisores/contato", {
        method: "POST",
        body: JSON.stringify(contatoForm),
      });
      setContatoForm(null);
      await loadDecisores();
      alert("Contato salvo.");
    } catch (e) {
      alert("Erro ao salvar contato: " + e.message);
    }
  };

  const handleBuscarContato = async (idx, d) => {
    setContatoBusca(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), loading: true } }));
    try {
      const r = await api("/api/decisores/contato/buscar", {
        method: "POST",
        body: JSON.stringify({ nome: d.nome, empresa: d.empresa_nome, empresa_id: d.empresa_id, website: d.empresa_website }),
      });
      setContatoBusca(prev => ({ ...prev, [idx]: { loading: false, ...r } }));
    } catch (e) {
      setContatoBusca(prev => ({ ...prev, [idx]: { loading: false, erro: e.message } }));
    }
  };

  const loadClientes = useCallback(async () => {
    setClientesLoading(true);
    try {
      const params = new URLSearchParams();
      if (clienteBusca) params.set("busca", clienteBusca);
      const data = await api(`/api/decisores/clientes?${params}`);
      setClientes(data.items || []);
    } catch (e) {
      setClientes([]);
    } finally {
      setClientesLoading(false);
    }
  }, [clienteBusca]);

  const handleBuscarTodosContatos = async () => {
    if (!decisores.length) { alert("Não há decisores na lista para buscar."); return; }
    const alvos = decisores
      .filter(d => d.empresa_id && d.nome)
      .map(d => ({
        nome: d.nome,
        empresa_nome: d.empresa_nome,
        empresa_id: d.empresa_id,
        empresa_website: d.empresa_website,
        qualificacao: d.qualificacao,
      }));
    if (!alvos.length) { alert("Nenhum decisor com empresa vinculada para cadastrar."); return; }

    // agrupa por empresa (a busca é 1x por empresa) e envia em lotes de empresas
    const grupos = {};
    for (const a of alvos) { (grupos[a.empresa_id] = grupos[a.empresa_id] || []).push(a); }
    const empresasGrupos = Object.values(grupos);
    if (!confirm(`Buscar e-mail/telefone de ${alvos.length} decisor(es) de ${empresasGrupos.length} empresa(s) e cadastrar como clientes? Pode levar alguns minutos.`)) return;

    const LOTE = 4; // empresas por requisição (cada requisição leva ~20-30s)
    setDecMassaLoading(true);
    setDecMassaResult(null);
    setDecMassaProgress({ feito: 0, total: empresasGrupos.length });
    const acc = { total: 0, com_contato: 0, salvos: 0 };
    try {
      for (let i = 0; i < empresasGrupos.length; i += LOTE) {
        const fatia = empresasGrupos.slice(i, i + LOTE).flat();
        const r = await api("/api/decisores/contato/buscar-massa", {
          method: "POST",
          body: JSON.stringify({ alvos: fatia, salvar: true }),
        });
        acc.total += r.total || 0;
        acc.com_contato += r.com_contato || 0;
        acc.salvos += r.salvos || 0;
        setDecMassaResult({ ...acc });
        setDecMassaProgress({ feito: Math.min(i + LOTE, empresasGrupos.length), total: empresasGrupos.length });
        await loadClientes();
      }
      await loadDecisores();
    } catch (e) {
      alert("Erro na busca em massa: " + e.message);
    } finally {
      setDecMassaLoading(false);
      setDecMassaProgress(null);
    }
  };

  const toggleCliente = (id) => setClienteSelectedIds(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  ));

  const handleExcluirCliente = async (id) => {
    if (!confirm("Excluir este cliente?")) return;
    try {
      await api(`/api/decisores/contato/${id}`, { method: "DELETE" });
      setClienteSelectedIds(prev => prev.filter(x => x !== id));
      await loadClientes();
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  };

  const enviarClientesParaCampanha = (canal) => {
    const ids = clienteSelectedIds.length
      ? clienteSelectedIds
      : clientes
          .filter(c => (canal === "email" ? c.email : (c.whatsapp || c.telefone)))
          .map(c => c.id);
    if (!ids.length) {
      alert(canal === "email" ? "Nenhum cliente com e-mail." : "Nenhum cliente com WhatsApp/telefone.");
      return;
    }
    setCampanhaFonte("clientes");
    setCampanhaCanal(canal);
    setCampanhaSelectedIds(ids);
    setCampanhaResultado(null);
    setPage("campanhas");
  };

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api("/api/templates");
      setTemplates(data);
    } catch (e) {}
  }, []);

  const loadCampanhas = useCallback(async () => {
    try {
      const data = await api("/api/campanhas");
      setCampanhas(data);
    } catch (e) {}
  }, []);

  const excluirCampanha = useCallback(async (c) => {
    if (!confirm(`Excluir a campanha "${c.nome}"?`)) return;
    try {
      await api(`/api/campanhas/${c.id}`, { method: "DELETE" });
      setCampanhas(prev => prev.filter(x => x.id !== c.id));
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  }, []);

  const loadTarefas = useCallback(async () => {
    setTarefasLoading(true);
    try {
      const qs = new URLSearchParams();
      if (tarefaBusca.trim()) qs.set("busca", tarefaBusca.trim());
      if (tarefaFiltroStatus) qs.set("status", tarefaFiltroStatus);
      if (tarefaFiltroPrioridade) qs.set("prioridade", tarefaFiltroPrioridade);
      if (tarefaFiltroResponsavel) qs.set("responsavel", tarefaFiltroResponsavel);
      if (tarefaFiltroVenceAte) qs.set("vence_ate", tarefaFiltroVenceAte);
      if (tarefaFiltroVencidas) qs.set("vencidas", "true");
      const query = qs.toString();
      const [lista, resumo] = await Promise.all([
        api(`/api/tarefas${query ? `?${query}` : ""}`),
        api("/api/tarefas/resumo"),
      ]);
      setTarefas(Array.isArray(lista) ? lista : []);
      if (resumo) setTarefasResumo(resumo);
    } catch (e) {
    } finally {
      setTarefasLoading(false);
    }
  }, [tarefaBusca, tarefaFiltroStatus, tarefaFiltroPrioridade, tarefaFiltroResponsavel, tarefaFiltroVenceAte, tarefaFiltroVencidas]);

  const loadCampaignTargets = useCallback(async () => {
    try {
      const data = await api("/api/empresas?limit=200");
      const items = Array.isArray(data?.items) ? data.items : [];
      setCampanhaTargets(items.filter(item => item.whatsapp || item.telefone || item.email));
    } catch (e) {
      setCampanhaTargets([]);
    }
  }, []);

  const loadMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const params = new URLSearchParams();
      if (marketArea) params.set("area", marketArea);
      if (marketTipo) params.set("tipo", marketTipo);

      const [summary, items] = await Promise.all([
        api(`/api/mercado/summary?${new URLSearchParams(marketArea ? { area: marketArea } : {}).toString()}`),
        api(`/api/mercado/items?${params.toString()}`),
      ]);
      setMarketSummary(summary);
      setMarketItems(items.items || []);
    } catch (e) {
      setMarketSummary(null);
      setMarketItems([]);
    } finally {
      setMarketLoading(false);
    }
  }, [marketArea, marketTipo]);

  const checkWA = useCallback(async () => {
    try {
      const data = await api(`/api/whatsapp/status?instance=${encodeURIComponent(waInstance)}`);
      setWaStatus(data);
      return data;
    } catch (e) {
      setWaStatus({ state: "error" });
      return null;
    }
  }, [waInstance]);

  const loadQR = useCallback(async () => {
    setWaLoadingQR(true);
    try {
      const qs = `instance=${encodeURIComponent(waInstance)}`;
      // garante que a instância existe antes de pedir o QR
      await api(`/api/whatsapp/instancia?${qs}`, { method: "POST" }).catch(() => {});
      const data = await api(`/api/whatsapp/qrcode?${qs}`);
      const b64 = data?.base64 || data?.qrcode?.base64 || null;
      setWaQR(b64 ? (b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`) : null);
    } catch (e) {
      setWaQR(null);
    } finally {
      setWaLoadingQR(false);
    }
  }, [waInstance]);

  const loadContas = useCallback(async () => {
    setWaContasLoading(true);
    try {
      const data = await api("/api/whatsapp/instancias");
      setWaContas(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setWaContas([]);
    } finally {
      setWaContasLoading(false);
    }
  }, []);

  const selecionarConta = useCallback((nome) => {
    if (!nome || nome === waInstance) return;
    setWaInstance(nome);
    setWaQR(null);
    setWaStatus(null);
  }, [waInstance]);

  const addConta = useCallback(async () => {
    const nome = waNovaConta.trim();
    if (!nome) { alert("Informe um nome para a conta (ex: vendas, suporte)."); return; }
    setWaAddingConta(true);
    try {
      const r = await api("/api/whatsapp/instancias", {
        method: "POST",
        body: JSON.stringify({ nome }),
      });
      setWaNovaConta("");
      await loadContas();
      if (r?.instancia) selecionarConta(r.instancia);
    } catch (e) {
      alert("Erro ao criar conta: " + e.message);
    } finally {
      setWaAddingConta(false);
    }
  }, [waNovaConta, loadContas, selecionarConta]);

  const removeConta = useCallback(async (nome) => {
    if (!confirm(`Remover a conta de WhatsApp "${nome}"? Isso desconecta o aparelho.`)) return;
    try {
      await api(`/api/whatsapp/instancias/${encodeURIComponent(nome)}`, { method: "DELETE" });
      if (nome === waInstance) selecionarConta("imobpro");
      await loadContas();
    } catch (e) {
      alert("Erro ao remover conta: " + e.message);
    }
  }, [waInstance, loadContas, selecionarConta]);

  const loadInbox = useCallback(async () => {
    try {
      const data = await api("/api/whatsapp/inbox");
      setConvList(Array.isArray(data) ? data : []);
    } catch (e) {}
  }, []);

  const handleCampanhaTemplate = useCallback((templateId) => {
    setCampanhaTemplateId(templateId);
    const tmpl = templates.find(t => String(t.id) === String(templateId));
    if (tmpl?.conteudo) {
      setCampanhaMensagem(tmpl.conteudo);
    }
  }, [templates]);

  const handleCampanhaMedia = useCallback(async (file) => {
    if (!file) {
      if (campanhaMediaPreview.startsWith("blob:")) URL.revokeObjectURL(campanhaMediaPreview);
      setCampanhaMediaUrl("");
      setCampanhaMediaNome("");
      setCampanhaMediaMime("");
      setCampanhaMediaType("");
      setCampanhaMediaPreview("");
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Selecione apenas uma imagem ou um vídeo.");
      return;
    }
    if (campanhaMediaPreview.startsWith("blob:")) URL.revokeObjectURL(campanhaMediaPreview);
    const preview = URL.createObjectURL(file);
    setCampanhaMediaPreview(preview);
    setCampanhaMediaNome(file.name);
    setCampanhaMediaMime(file.type || "");
    setCampanhaMediaType(file.type.startsWith("video/") ? "video" : "image");

    const token = getStoredToken();
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API}/api/campanhas/upload-media`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      URL.revokeObjectURL(preview);
      setCampanhaMediaPreview("");
      throw new Error(data?.detail || "Falha ao enviar mídia.");
    }
    setCampanhaMediaUrl(data.url || "");
  }, []);

  const toggleCampanhaTarget = useCallback((id) => {
    setCampanhaSelectedIds(prev => (
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    ));
  }, []);

  // Clientes (contatos) no formato de "alvo de campanha", para reusar a mesma UI
  const clientesComoTargets = useMemo(() => clientes.map(c => ({
    id: c.id,
    nome: c.nome,
    tipo: c.cargo,
    email: c.email,
    telefone: c.telefone,
    whatsapp: c.whatsapp,
    bairro: c.empresa_nome,
  })), [clientes]);

  // Fonte ativa de destinatários da campanha (empresas ou clientes)
  const campanhaItensFonte = campanhaFonte === "clientes" ? clientesComoTargets : campanhaTargets;

  const selecionarTodosCampanha = useCallback(() => {
    const ids = campanhaItensFonte
      .filter(item => (campanhaCanal === "email" ? item.email : (item.whatsapp || item.telefone)))
      .map(item => String(item.id));
    setCampanhaSelectedIds(ids);
  }, [campanhaItensFonte, campanhaCanal]);

  const limparCampanha = useCallback(() => {
    setCampanhaNome("");
    setCampanhaDescricao("");
    setCampanhaAssunto("");
    setCampanhaMensagem("");
    setCampanhaTemplateId("");
    setCampanhaMediaUrl("");
    setCampanhaMediaNome("");
    setCampanhaMediaMime("");
    setCampanhaMediaType("");
    setCampanhaMediaPreview("");
    setCampanhaSelectedIds([]);
    setCampanhaResultado(null);
  }, []);

  const dispararCampanhaRapida = useCallback(async () => {
    if (!campanhaSelectedIds.length) {
      alert("Selecione ao menos um número para disparar.");
      return;
    }
    if (!campanhaMensagem.trim() && !campanhaMediaUrl) {
      alert("Escreva uma mensagem ou selecione uma mídia para enviar.");
      return;
    }
    setCampanhaEnviando(true);
    setCampanhaResultado(null);
    try {
      const result = await api("/api/campanhas/disparo-rapido", {
        method: "POST",
        body: JSON.stringify({
          nome: campanhaNome.trim() || "Disparo rápido",
          descricao: campanhaDescricao.trim() || undefined,
          empresa_ids: campanhaFonte === "clientes" ? [] : campanhaSelectedIds,
          contato_ids: campanhaFonte === "clientes" ? campanhaSelectedIds : [],
          mensagem: campanhaMensagem,
          media_url: campanhaMediaUrl || undefined,
          media_mimetype: campanhaMediaMime || undefined,
          media_filename: campanhaMediaNome || undefined,
          media_type: campanhaMediaType || undefined,
        }),
      });
      setCampanhaResultado(result);
      await loadCampanhas();
      await loadCampaignTargets();
    } catch (e) {
      alert("Erro ao disparar campanha: " + e.message);
    } finally {
      setCampanhaEnviando(false);
    }
  }, [
    campanhaSelectedIds,
    campanhaMensagem,
    campanhaMediaUrl,
    campanhaMediaMime,
    campanhaMediaNome,
    campanhaMediaType,
    campanhaNome,
    campanhaDescricao,
    campanhaFonte,
    loadCampanhas,
    loadCampaignTargets,
  ]);

  const dispararCampanhaEmail = useCallback(async () => {
    if (!campanhaSelectedIds.length) {
      alert("Selecione ao menos um destinatário para disparar.");
      return;
    }
    if (!campanhaAssunto.trim()) {
      alert("Informe o assunto do e-mail.");
      return;
    }
    if (!campanhaMensagem.trim()) {
      alert("Escreva a mensagem do e-mail.");
      return;
    }
    setCampanhaEnviando(true);
    setCampanhaResultado(null);
    try {
      const result = await api("/api/campanhas/disparo-email", {
        method: "POST",
        body: JSON.stringify({
          nome: campanhaNome.trim() || "Disparo de e-mail",
          descricao: campanhaDescricao.trim() || undefined,
          empresa_ids: campanhaFonte === "clientes" ? [] : campanhaSelectedIds,
          contato_ids: campanhaFonte === "clientes" ? campanhaSelectedIds : [],
          assunto: campanhaAssunto,
          mensagem: campanhaMensagem,
          media_url: campanhaMediaUrl || undefined,
          media_mimetype: campanhaMediaMime || undefined,
          media_filename: campanhaMediaNome || undefined,
        }),
      });
      setCampanhaResultado(result);
      await loadCampanhas();
      await loadCampaignTargets();
    } catch (e) {
      alert("Erro ao disparar e-mail: " + e.message);
    } finally {
      setCampanhaEnviando(false);
    }
  }, [
    campanhaSelectedIds,
    campanhaAssunto,
    campanhaMensagem,
    campanhaMediaUrl,
    campanhaMediaMime,
    campanhaMediaNome,
    campanhaNome,
    campanhaDescricao,
    campanhaFonte,
    loadCampanhas,
    loadCampaignTargets,
  ]);

  const loadMsgs = useCallback(async (conversaId) => {
    if (!conversaId) return;
    try {
      const data = await api(`/api/whatsapp/mensagens/${conversaId}`);
      setConvMsgs(Array.isArray(data) ? data : []);
    } catch (e) {}
  }, []);

  const openConversa = useCallback(async (c) => {
    setConvActive(c);
    setConvMsgs([]);
    await loadMsgs(c.id);
    api(`/api/whatsapp/conversas/${c.id}/ler`, { method: "POST" }).then(loadInbox).catch(() => {});
  }, [loadMsgs, loadInbox]);

  const sendReply = useCallback(async () => {
    if (!convActive || !convInput.trim()) return;
    const texto = convInput.trim();
    setConvSending(true);
    setConvInput("");
    try {
      await api("/api/whatsapp/enviar", {
        method: "POST",
        body: JSON.stringify({ numero: convActive.numero_whatsapp, mensagem: texto, conversa_id: convActive.id }),
      });
      await loadMsgs(convActive.id);
      loadInbox();
    } catch (e) {
      alert("Erro ao enviar: " + e.message);
      setConvInput(texto);
    } finally {
      setConvSending(false);
    }
  }, [convActive, convInput, loadMsgs, loadInbox]);

  useEffect(() => {
    if (!isAuthed) return;
    loadDashboard();
    loadTemplates();
    checkWA();
  }, [isAuthed, loadDashboard, loadTemplates, checkWA]);

  useEffect(() => {
    if (!isAuthed) return;
    if (page === "empresas") loadEmpresas();
    if (page === "decisores") loadDecisores();
    if (page === "clientes") loadClientes();
    if (page === "templates") loadTemplates();
    if (page === "tarefas") loadTarefas();
    if (page === "campanhas") { loadCampanhas(); loadTemplates(); loadCampaignTargets(); loadClientes(); }
    if (page === "mercado") loadMarket();
    if (page === "conversas") loadInbox();
  }, [isAuthed, page, loadEmpresas, loadDecisores, loadClientes, loadTemplates, loadTarefas, loadCampanhas, loadMarket, loadInbox, loadCampaignTargets]);

  // Tela Conversas: atualiza inbox e thread ativa ao vivo (espelho do WhatsApp)
  useEffect(() => {
    if (!isAuthed) return;
    if (page !== "conversas") return;
    const id = setInterval(() => {
      loadInbox();
      if (convActive) loadMsgs(convActive.id);
    }, 4000);
    return () => clearInterval(id);
  }, [isAuthed, page, convActive, loadInbox, loadMsgs]);

  useEffect(() => {
    if (!isAuthed) return;
    if (page === "empresas") {
      const t = setTimeout(loadEmpresas, 350);
      return () => clearTimeout(t);
    }
  }, [isAuthed, search, filterTipo, page, loadEmpresas]);

  useEffect(() => {
    if (!isAuthed) return;
    if (page === "decisores") {
      const t = setTimeout(loadDecisores, 350);
      return () => clearTimeout(t);
    }
  }, [isAuthed, decBusca, decQual, page, loadDecisores]);

  useEffect(() => {
    if (!isAuthed) return;
    if (page === "clientes") {
      const t = setTimeout(loadClientes, 350);
      return () => clearTimeout(t);
    }
  }, [isAuthed, clienteBusca, page, loadClientes]);

  useEffect(() => {
    if (!isAuthed) return;
    if (page === "mercado") {
      const t = setTimeout(loadMarket, 350);
      return () => clearTimeout(t);
    }
  }, [isAuthed, marketArea, marketTipo, page, loadMarket]);

  // Autocomplete da Área: sugere bairros/regiões enquanto a pessoa digita.
  // Trabalha sobre o último trecho (após a última "/" ou ",").
  const areaTermoAtual = (marketArea.split(/[\/,]/).pop() || "").trim();
  useEffect(() => {
    if (!isAuthed) return;
    if (page !== "mercado" || !areaOpen) return;
    const t = setTimeout(async () => {
      try {
        const data = await api(`/api/mercado/areas?q=${encodeURIComponent(areaTermoAtual)}`);
        setAreaSugg(Array.isArray(data) ? data : []);
      } catch {
        setAreaSugg([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [isAuthed, areaTermoAtual, areaOpen, page]);

  const escolherArea = useCallback((valor) => {
    setMarketArea(prev => {
      const partes = prev.split(/([\/,])/); // mantém separadores
      // substitui o último trecho de texto pelo valor escolhido
      for (let i = partes.length - 1; i >= 0; i--) {
        if (partes[i] !== "/" && partes[i] !== ",") { partes[i] = valor; break; }
      }
      return partes.join("").replace(/^[\s\/,]+/, "");
    });
    setAreaOpen(false);
    setAreaSugg([]);
  }, []);

  // Tela WhatsApp: ao abrir desconectado, busca o QR e fica verificando ate conectar
  useEffect(() => {
    if (!isAuthed) return;
    if (page !== "whatsapp") return;
    let cancel = false;
    loadContas();
    const tick = async () => {
      const st = await checkWA();
      const connected = st?.state === "open" || st?.instance?.state === "open";
      if (cancel) return;
      if (connected) { setWaQR(null); }
      else if (!waQR && !waLoadingQR) { loadQR(); }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancel = true; clearInterval(id); };
  }, [isAuthed, page, checkWA, loadQR, loadContas, waQR, waLoadingQR]);

  const dashboardStats = stats?.stats || {};
  const totalEmpresas = Number(dashboardStats.total_empresas || 0);
  const totalComCnpj = Number(dashboardStats.com_cnpj || 0);
  const totalComWhats = Number(dashboardStats.com_whatsapp || 0);
  const totalConversas = Number(dashboardStats.total_conversas || 0);
  const totalMensagens = Number(dashboardStats.total_mensagens || 0);
  const msgsHoje = Number(dashboardStats.msgs_hoje || 0);
  const campanhasAtivas = Number(dashboardStats.campanhas_ativas || 0);
  const empresasSemWhats = Math.max(totalEmpresas - totalComWhats, 0);
  const empresasEmAtendimento = Number(dashboardStats.empresas_em_atendimento || 0);
  const totalEmails = Number(dashboardStats.total_emails || 0);
  const totalTelefones = Number(dashboardStats.total_telefones || 0);
  const campanhasResumo = stats?.campanhas_resumo || {};
  const campWhats = campanhasResumo.whatsapp || {};
  const campEmail = campanhasResumo.email || {};
  const tiposBase = Array.isArray(stats?.por_tipo)
    ? [...stats.por_tipo].sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    : [];
  const maiorTipo = Math.max(...tiposBase.map(item => Number(item.total || 0)), 1);
  const empresasRecentes = Array.isArray(stats?.recentes) ? stats.recentes : [];
  const atividadesRecentes = Array.isArray(stats?.atividades) ? stats.atividades : [];

  const handleAddEmpresa = async () => {
    try {
      await api("/api/empresas", {
        method: "POST",
        body: JSON.stringify({ ...newEmpresa, municipio: "São Paulo", uf: "SP", regiao: "Consolação/Jardins/Bela Vista" }),
      });
      setShowNewModal(false);
      setNewEmpresa({ nome: "", tipo: "incorporadora", bairro: "", cnpj: "" });
      loadEmpresas();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const openNewTemplate = () => {
    setEditingTemplateId(null);
    setNewTemplate({ nome: "", categoria: "", conteudo: "" });
    setShowTemplateModal(true);
  };

  const openEditTemplate = (t) => {
    setEditingTemplateId(t.id);
    setNewTemplate({ nome: t.nome || "", categoria: t.categoria || "", conteudo: t.conteudo || "" });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const variaveis = [...new Set(
        [...(newTemplate.conteudo || "").matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)].map(m => m[1])
      )];
      const payload = JSON.stringify({ ...newTemplate, variaveis });
      if (editingTemplateId) {
        await api(`/api/templates/${editingTemplateId}`, { method: "PUT", body: payload });
      } else {
        await api("/api/templates", { method: "POST", body: payload });
      }
      setShowTemplateModal(false);
      setEditingTemplateId(null);
      setNewTemplate({ nome: "", categoria: "", conteudo: "" });
      loadTemplates();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Excluir este template?")) return;
    try {
      await api(`/api/templates/${id}`, { method: "DELETE" });
      loadTemplates();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // ---- Tarefas: abrir/editar/salvar/arquivar/concluir ----
  const openNovaTarefa = (presetData) => {
    setEditingTarefaId(null);
    setTarefaForm({ ...TAREFA_FORM_VAZIO, data_vencimento: typeof presetData === "string" ? presetData : "" });
    setShowTarefaModal(true);
  };

  const openEditarTarefa = (t) => {
    setEditingTarefaId(t.id);
    setTarefaForm({
      titulo: t.titulo || "",
      descricao: t.descricao || "",
      responsavel: t.responsavel || "",
      prioridade: t.prioridade || "media",
      status: t.status || "pendente",
      data_vencimento: t.data_vencimento || "",
      observacoes: t.observacoes || "",
    });
    setTarefaView(null);
    setShowTarefaModal(true);
  };

  const handleSalvarTarefa = async () => {
    if (!tarefaForm.titulo.trim()) {
      alert("Informe o título da tarefa.");
      return;
    }
    setTarefaSaving(true);
    try {
      const payload = JSON.stringify({
        ...tarefaForm,
        titulo: tarefaForm.titulo.trim(),
        data_vencimento: tarefaForm.data_vencimento || null,
      });
      if (editingTarefaId) {
        await api(`/api/tarefas/${editingTarefaId}`, { method: "PUT", body: payload });
      } else {
        await api("/api/tarefas", { method: "POST", body: payload });
      }
      setShowTarefaModal(false);
      setEditingTarefaId(null);
      setTarefaForm(TAREFA_FORM_VAZIO);
      loadTarefas();
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setTarefaSaving(false);
    }
  };

  const handleArquivarTarefa = async (t) => {
    if (!confirm(`Arquivar a tarefa "${t.titulo}"? Ela sai da lista, mas o histórico é preservado.`)) return;
    try {
      await api(`/api/tarefas/${t.id}`, { method: "DELETE" });
      setTarefaView(null);
      loadTarefas();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const handleMudarStatusTarefa = async (t, novoStatus) => {
    try {
      const atualizada = await api(`/api/tarefas/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: novoStatus }),
      });
      setTarefaView((v) => (v && v.id === t.id ? atualizada : v));
      loadTarefas();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  // Arrastar uma tarefa para outro dia no calendário (reagenda o vencimento).
  const handleMoverTarefa = async (t, novaData) => {
    // Atualização otimista para o arraste parecer instantâneo.
    setTarefas((lista) => lista.map((x) => (x.id === t.id ? { ...x, data_vencimento: novaData } : x)));
    try {
      await api(`/api/tarefas/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ data_vencimento: novaData }),
      });
      loadTarefas();
    } catch (e) {
      alert("Erro: " + e.message);
      loadTarefas();
    }
  };

  const handleEnrichAllCompanies = async () => {
    setEnriching(true);
    try {
      const result = await api("/api/empresas/enrich-all", {
        method: "POST",
        body: JSON.stringify({ only_missing: true, force: false }),
      });
      await loadEmpresas();
      await loadDashboard();
      alert(
        `Bot finalizou: ${result.enriched}/${result.processed} empresas enriquecidas. ` +
        `${result.discovered_cnpj} CNPJs descobertos automaticamente.`
      );
    } catch (e) {
      alert("Erro ao enriquecer empresas: " + e.message);
    } finally {
      setEnriching(false);
    }
  };

  const handleDiscoverWhatsAppAll = async () => {
    if (!confirm("Passar o pente fino e buscar o WhatsApp de todas as empresas sem número? Pode levar alguns minutos.")) return;
    setDiscoveringAllWA(true);
    try {
      const r = await api("/api/empresas/discover-whatsapp-all", {
        method: "POST",
        body: JSON.stringify({ only_missing: true }),
      });
      await loadEmpresas();
      await loadDashboard();
      alert(
        `Pente fino concluído: ${r.encontrados} WhatsApp(s) encontrado(s) de ${r.total} empresa(s) sem número. ` +
        `${r.nao_encontrados} não localizados.`
      );
    } catch (e) {
      alert("Erro no pente fino de WhatsApp: " + e.message);
    } finally {
      setDiscoveringAllWA(false);
    }
  };

  const handleDiscoverEmailAll = async () => {
    if (!confirm("Passar o pente fino e buscar os e-mails (empresa + donos) de todas as empresas sem e-mail? Pode levar alguns minutos.")) return;
    setDiscoveringAllEmail(true);
    try {
      const r = await api("/api/empresas/discover-email-all", {
        method: "POST",
        body: JSON.stringify({ only_missing: true }),
      });
      await loadEmpresas();
      await loadDashboard();
      alert(
        `Pente fino de e-mails: ${r.emails_empresa} e-mail(s) de empresa e ${r.emails_donos} e-mail(s) de donos encontrados ` +
        `(de ${r.total} empresa(s)). ${r.nao_encontrados} sem e-mail.`
      );
    } catch (e) {
      alert("Erro no pente fino de e-mails: " + e.message);
    } finally {
      setDiscoveringAllEmail(false);
    }
  };

  const handleScanMarket = async () => {
    setMarketScanning(true);
    try {
      await api("/api/mercado/scan", {
        method: "POST",
        body: JSON.stringify({
          area: marketArea,
          include_company_projects: true,
          include_area_listings: true,
          limit: 60,
        }),
      });
      await loadMarket();
      alert("Mercado da área atualizado com sucesso.");
    } catch (e) {
      alert("Erro ao mapear mercado: " + e.message);
    } finally {
      setMarketScanning(false);
    }
  };

  const waConnected = waStatus?.state === "open" || waStatus?.instance?.state === "open";

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#020608] flex items-center justify-center text-slate-400">
        Carregando acesso...
      </div>
    );
  }

  if (!isAuthed) {
    if (!showLogin) {
      return <LandingPage
        onEnter={() => { setAuthMode("login"); setShowLogin(true); }}
        onRegister={() => { setAuthMode("register"); setShowLogin(true); }}
      />;
    }
    if (authMode === "register") {
      return <RegisterScreen onBack={() => { setLoginError(""); setAuthMode("login"); }} />;
    }
    if (authMode === "forgot") {
      return <ForgotPasswordScreen onBack={() => { setLoginError(""); setAuthMode("login"); }} />;
    }
    return (
      <LoginScreen
        username={loginUsername}
        password={loginPassword}
        setUsername={setLoginUsername}
        setPassword={setLoginPassword}
        onSubmit={handleLogin}
        loading={loginLoading}
        error={loginError}
        onBack={() => setShowLogin(false)}
        onRegister={() => { setLoginError(""); setAuthMode("register"); }}
        onForgot={() => { setLoginError(""); setAuthMode("forgot"); }}
      />
    );
  }

  const navItems = [
    { id: "dashboard", icon: "home", label: "Dashboard" },
    { id: "empresas", icon: "building", label: "Empresas" },
    { id: "decisores", icon: "users", label: "Decisores" },
    { id: "clientes", icon: "users", label: "Clientes" },
    { id: "mercado", icon: "map", label: "Mercado" },
    { id: "campanhas", icon: "megaphone", label: "Campanhas" },
    { id: "templates", icon: "file", label: "Templates" },
    { id: "tarefas", icon: "tasks", label: "Tarefas" },
    { id: "equipes", icon: "users", label: "Equipes" },
    { id: "conversas", icon: "phone", label: "Conversas" },
    { id: "whatsapp", icon: "whatsapp", label: "WhatsApp" },
  ];

  return (
    <div className="flex h-screen bg-[var(--background)] text-white font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-black/90 border-r border-white/5">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00e7fc] to-[#00ff4d] flex items-center justify-center shadow-lg glow-cyan text-[#06262b]">
              <Icon name="map" size={16} />
            </div>
            <div>
              <h1 className="text-[#00ff6a] font-extrabold tracking-[0.35em] text-sm leading-none">IMOBPRO</h1>
              <p className="text-slate-500 text-[10px] mt-0.5">Prospeção imobiliária</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                page === item.id
                  ? "bg-[#0c3135] text-[#00e7fc] border border-[#00e7fc]/25 shadow-[inset_0_0_0_1px_rgba(18,231,255,0.08)]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}>
              <Icon name={item.icon} size={16} />
              {item.label}
              {item.id === "whatsapp" && (
                <span className={`ml-auto w-2 h-2 rounded-full ${waConnected ? "bg-emerald-400" : "bg-rose-400"}`} />
              )}
            </button>
          ))}

          {/* Seções do módulo DMC — integradas ao menu, sem rótulo de grupo */}
          {DMC_NAV.map(item => {
            const id = `dmc:${item.key}`;
            return (
              <button key={id} onClick={() => setPage(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  page === id
                    ? "bg-[#0c3135] text-[#00e7fc] border border-[#00e7fc]/25 shadow-[inset_0_0_0_1px_rgba(18,231,255,0.08)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}>
                <Icon name="building" size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* WA Status */}
        <div className="p-3 border-t border-white/5">
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${
            waConnected ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${waConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
            WhatsApp {waConnected ? "Conectado" : "Desconectado"}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="h-16 flex-shrink-0 px-8 lg:px-10 flex items-center justify-between border-b border-white/5 bg-black/15 backdrop-blur-sm">
          <div>
            <h2 className="text-white font-semibold text-sm tracking-wide">{page === "dashboard" ? "Dashboard" : page === "empresas" ? "Empresas" : page === "decisores" ? "Decisores" : page === "clientes" ? "Clientes" : page === "mercado" ? "Mercado" : page === "campanhas" ? "Campanhas" : page === "templates" ? "Templates" : page === "tarefas" ? "Tarefas" : page === "conversas" ? "Conversas" : page === "whatsapp" ? "WhatsApp" : "Complexo DMC"}</h2>
            <p className="text-slate-500 text-xs">Sistema autenticado</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00e7fc] to-[#00ff4d] text-[#06262b] flex items-center justify-center text-xs font-bold">
                {((authUser?.display_name || authUser?.username || "A").slice(0, 2) || "A").toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-white text-sm font-medium">{authUser?.display_name || authUser?.username || "Admin"}</div>
                <div className="text-slate-500 text-[11px]">Acesso liberado</div>
              </div>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 rounded-full border border-white/10 text-slate-300 text-sm hover:text-white hover:bg-white/5 transition-colors">
              Sair
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-10">

          {/* COMPLEXO DMC — seções nativas (mesmo tema do ImobPro) */}
          {page.startsWith("dmc:") && <DMCPlatform secaoControlada={page.slice(4)} />}

          {/* EQUIPES & COLABORADORES — produtividade a partir de eventos reais */}
          {page === "equipes" && <EquipesPanel api={api} currentUser={authUser} />}

          {/* CONVERSAS (espelho do WhatsApp — tema claro estilo WhatsApp Web) */}
          {page === "conversas" && (
            <div className="flex h-[calc(100vh-180px)] rounded-2xl overflow-hidden border border-[#d1d7db] shadow-lg">
              {/* Lista de conversas */}
              <div className="w-80 flex-shrink-0 bg-white flex flex-col overflow-hidden border-r border-[#e9edef]">
                <div className="p-2.5 bg-[#f0f2f5] border-b border-[#e9edef]">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f]"><Icon name="search" size={14} /></span>
                    <input value={convSearch} onChange={e => setConvSearch(e.target.value)}
                      placeholder="Buscar conversa..."
                      className="w-full rounded-lg pl-9 pr-3 py-2 text-sm bg-white text-[#111b21] placeholder-[#667781] border border-transparent focus:border-[#00a884] focus:outline-none" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {convList.filter(c => {
                    const q = convSearch.toLowerCase().trim();
                    return !q || (c.nome_exibicao || "").toLowerCase().includes(q) || (c.numero_whatsapp || "").includes(q);
                  }).map(c => (
                    <button key={c.id} onClick={() => openConversa(c)}
                      className={`w-full text-left px-3 py-3 border-b border-[#f0f2f5] hover:bg-[#f5f6f6] transition-colors ${convActive?.id === c.id ? "bg-[#f0f2f5]" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#dfe5e7] text-[#00a884] flex items-center justify-center flex-shrink-0">
                          <Icon name="whatsapp" size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#111b21] text-[15px] font-medium truncate">{c.nome_exibicao || c.numero_whatsapp}</span>
                            {c.nao_lidas > 0 && (
                              <span className="bg-[#25d366] text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{c.nao_lidas}</span>
                            )}
                          </div>
                          <p className="text-[#667781] text-[13px] truncate">
                            {c.ultima_direcao === "outbound" ? "Você: " : ""}{c.ultima_mensagem || "—"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {convList.length === 0 && (
                    <div className="p-6 text-center text-[#667781] text-sm">Nenhuma conversa ainda.<br />Elas aparecem aqui quando o robô envia ou recebe mensagens.</div>
                  )}
                </div>
              </div>

              {/* Thread de mensagens */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
                {convActive ? (
                  <>
                    <div className="px-4 py-2.5 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#dfe5e7] text-[#00a884] flex items-center justify-center"><Icon name="whatsapp" size={18} /></div>
                      <div className="min-w-0">
                        <div className="text-[#111b21] text-[16px] font-medium truncate">{convActive.nome_exibicao || convActive.numero_whatsapp}</div>
                        <div className="text-[#667781] text-xs truncate">+{convActive.numero_whatsapp}{convActive.empresa_nome ? ` · ${convActive.empresa_nome}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-8 py-5 space-y-1.5"
                      style={{ backgroundColor: "#efeae2", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='%23000000' fill-opacity='0.025'%3E%3Cpath d='M0 0h20v20H0zM20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E\")" }}>
                      {convMsgs.map(m => (
                        <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[65%] rounded-lg px-2.5 py-1.5 text-[14.2px] shadow-sm ${m.direction === "outbound" ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none" : "bg-white text-[#111b21] rounded-tl-none"}`}>
                            <p className="whitespace-pre-wrap break-words leading-[19px]">{m.conteudo}</p>
                            <div className="text-[11px] text-[#667781] mt-0.5 text-right">
                              {m.created_at ? new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                      {convMsgs.length === 0 && <div className="text-center text-[#667781] text-sm py-10">Sem mensagens nesta conversa</div>}
                    </div>
                    <div className="px-4 py-2.5 bg-[#f0f2f5] flex items-center gap-2">
                      <input value={convInput} onChange={e => setConvInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        placeholder={waConnected ? "Digite uma mensagem..." : "Conecte o WhatsApp para enviar"}
                        disabled={!waConnected || convSending}
                        className="flex-1 rounded-lg px-4 py-2.5 text-sm bg-white text-[#111b21] placeholder-[#667781] border border-transparent focus:outline-none disabled:opacity-60" />
                      <button onClick={sendReply} disabled={!waConnected || convSending || !convInput.trim()}
                        className="rounded-full p-3 bg-[#00a884] text-white hover:bg-[#017561] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Icon name="send" size={16} /></button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#667781] gap-3 bg-[#f0f2f5]">
                    <Icon name="whatsapp" size={48} />
                    <p className="text-sm">Selecione uma conversa para ver as mensagens</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {page === "dashboard" && stats && (
            <div className="space-y-6">
              <div className="relative overflow-hidden surface-strong rounded-[28px] p-6 lg:p-7">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(18,231,255,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(0,255,106,0.10),transparent_28%)]" />
                <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Badge color={waConnected ? "emerald" : "rose"}>{waConnected ? "WhatsApp conectado" : "WhatsApp desconectado"}</Badge>
                      <Badge color="sky">{campanhasAtivas} campanhas ativas</Badge>
                      <Badge color="violet">{templates.length} templates salvos</Badge>
                      <Badge color="amber">{empresasSemWhats} empresas sem WhatsApp</Badge>
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Painel operacional do ImobPro</h3>
                    <p className="mt-3 text-sm lg:text-base text-slate-300 max-w-2xl">
                      Sistema de prospecção imobiliária para Consolação, Jardins e Bela Vista, com base de empresas,
                      enriquecimento de CNPJ, campanhas, templates e WhatsApp integrado via Evolution API.
                    </p>
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { icon: "building", label: "Empresas", value: totalEmpresas, hint: "cadastradas na base", color: "#12e7ff" },
                        { icon: "whatsapp", label: "Atendimento", value: empresasEmAtendimento, hint: "empresas no WhatsApp", color: "#00ff6a" },
                        { icon: "mail", label: "E-mails", value: totalEmails, hint: "únicos na base", color: "#8b5cf6" },
                        { icon: "phone", label: "Telefones", value: totalTelefones, hint: "únicos na base", color: "#f59e0b" },
                      ].map(kpi => (
                        <div key={kpi.label} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-[0.18em]">
                            <span style={{ color: kpi.color }}><Icon name={kpi.icon} size={15} /></span>
                            {kpi.label}
                          </div>
                          <div className="text-white text-3xl font-semibold mt-2 leading-none">{fmtNum(kpi.value)}</div>
                          <div className="text-slate-400 text-xs mt-2">{kpi.hint}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              <CampanhaSituacao
                titulo="Campanhas de WhatsApp"
                icon="whatsapp"
                data={campWhats}
                unidade="Mensagens"
                vazioMsg="Nenhuma campanha de WhatsApp registrada ainda. A situação aparece automaticamente assim que houver disparos."
              />

              <CampanhaSituacao
                titulo="Campanhas de e-mail"
                icon="mail"
                data={campEmail}
                unidade="E-mails"
                vazioMsg="Nenhuma campanha de e-mail registrada ainda. A situação aparece automaticamente assim que houver disparos."
              />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="surface-strong rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Icon name="pulse" size={16} />
                    Indicadores
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: "Empresas cadastradas", value: totalEmpresas, hint: "base principal do sistema", color: "#12e7ff" },
                      { label: "Empresas com CNPJ", value: totalComCnpj, hint: "já enriquecidas", color: "#00ff6a" },
                      { label: "Empresas com WhatsApp", value: totalComWhats, hint: "canais prontos para contato", color: "#8b5cf6" },
                      { label: "Mensagens totais", value: totalMensagens, hint: "histórico acumulado", color: "#f59e0b" },
                      { label: "Mensagens hoje", value: msgsHoje, hint: "atividade do dia", color: "#38bdf8" },
                      { label: "Campanhas ativas", value: campanhasAtivas, hint: "fluxos em andamento", color: "#fb7185" },
                    ].map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-slate-400 text-xs uppercase tracking-[0.18em]">{item.label}</div>
                            <div className="text-slate-500 text-xs mt-1">{item.hint}</div>
                          </div>
                          <div className="text-2xl font-semibold text-white" style={{ color: item.color }}>{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-2 surface-strong rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Icon name="layers" size={16} />
                    Base por tipo
                  </h3>
                  <div className="space-y-4">
                    {tiposBase.length > 0 ? tiposBase.map(item => {
                      const percentual = Math.max(4, Math.round((Number(item.total || 0) / maiorTipo) * 100));
                      return (
                        <div key={item.tipo} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-white text-sm font-medium capitalize">{String(item.tipo || "sem tipo").replaceAll("_", " ")}</p>
                              <p className="text-slate-500 text-xs">participação na base</p>
                            </div>
                            <Badge color="sky">{item.total}</Badge>
                          </div>
                          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#12e7ff] to-[#00ff6a]" style={{ width: `${percentual}%` }} />
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-slate-400 text-sm">
                        Nenhum tipo de empresa disponível na base ainda.
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/6 bg-black/15 p-4 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">WhatsApp</div>
                        <div className="text-white text-lg font-semibold mt-1">{waConnected ? "Conectado" : "Desconectado"}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">Template</div>
                        <div className="text-white text-lg font-semibold mt-1">{templates.length} salvos</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">Conversas</div>
                        <div className="text-white text-lg font-semibold mt-1">{totalConversas}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">Mensagens</div>
                        <div className="text-white text-lg font-semibold mt-1">{totalMensagens}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="surface-strong rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Icon name="building" size={16} />
                    Empresas recentes
                  </h3>
                  <div className="space-y-2">
                    {empresasRecentes.length > 0 ? empresasRecentes.map(e => (
                      <div key={e.nome} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-white text-sm font-medium">{e.nome}</p>
                          <p className="text-slate-500 text-xs mt-1">
                            {[e.bairro, e.tipo].filter(Boolean).join(" · ") || "Sem classificação"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Number.isFinite(Number(e.score)) && <Badge color="amber">score {e.score}</Badge>}
                            {Number(e.msgs || 0) > 0 && <Badge color="emerald">{e.msgs} msgs</Badge>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-500 text-xs">Criada em</div>
                          <div className="text-slate-300 text-xs mt-1">
                            {e.created_at ? new Date(e.created_at).toLocaleDateString("pt-BR") : "sem data"}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-slate-400 text-sm">
                        Nenhuma empresa recente para exibir.
                      </div>
                    )}
                  </div>
                </div>

                <div className="surface-strong rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Icon name="spark" size={16} />
                    Atividades recentes
                  </h3>
                  <div className="space-y-2">
                    {atividadesRecentes.length > 0 ? atividadesRecentes.map(a => (
                      <div key={a.id} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#00ff4d] flex-shrink-0 mt-2" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">{a.empresa_nome}</p>
                            <p className="text-slate-400 text-sm mt-1">{a.descricao}</p>
                          </div>
                          <span className="text-slate-500 text-xs whitespace-nowrap">
                            {a.created_at ? new Date(a.created_at).toLocaleDateString("pt-BR") : ""}
                          </span>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-slate-400 text-sm">
                        Nenhuma atividade registrada ainda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMPRESAS */}
          {page === "empresas" && (
            <div className="space-y-5">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={16} /></span>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou CNPJ..."
                    className="w-full pl-9 pr-4 py-2.5 tech-input rounded-xl text-sm" />
                </div>
                <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
                  className="surface-soft rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e7fc]">
                  <option value="">Todos os tipos</option>
                  <option value="incorporadora">Incorporadora</option>
                  <option value="construtora">Construtora</option>
                  <option value="imobiliaria">Imobiliária</option>
                  <option value="corretora">Corretora</option>
                </select>
                <button onClick={handleDiscoverWhatsAppAll} disabled={discoveringAllWA}
                  title="Buscar WhatsApp de todas as empresas sem número"
                  className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-60 transition-colors">
                  <Icon name="whatsapp" size={16} />
                  {discoveringAllWA ? "Buscando…" : "Pente fino WhatsApp"}
                </button>
                <button onClick={handleDiscoverEmailAll} disabled={discoveringAllEmail}
                  title="Buscar e-mails (empresa + donos) de todas as empresas sem e-mail"
                  className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border border-sky-400/40 text-sky-300 hover:bg-sky-400/10 disabled:opacity-60 transition-colors">
                  <Icon name="mail" size={16} />
                  {discoveringAllEmail ? "Buscando…" : "Pente fino e-mails"}
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-[#12e7ff] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {empresas.map(e => (
                    <EmpresaCard key={e.id} empresa={e} onSelect={setSelectedEmpresa} />
                  ))}
                  {empresas.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-slate-500">
                      Nenhuma empresa encontrada
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DECISORES */}
          {page === "decisores" && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-white text-lg font-bold">Decisores</h2>
                  <p className="text-slate-500 text-sm">Donos, sócios e diretores das empresas (QSA da Receita Federal) e pesquisa na web por pessoas com quem fazer negócio.</p>
                </div>
                <button onClick={handleBuscarTodosContatos} disabled={decMassaLoading || !decisores.length}
                  className="shrink-0 tech-button rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                  <Icon name="mail" size={15} />
                  {decMassaLoading
                    ? (decMassaProgress ? `Buscando… (${decMassaProgress.feito}/${decMassaProgress.total} empresas)` : "Buscando e cadastrando…")
                    : "Buscar e-mail/tel de todos → Clientes"}
                </button>
              </div>

              {/* Progresso / resultado da busca em massa */}
              {(decMassaResult || decMassaLoading) && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100 space-y-2">
                  {decMassaProgress && decMassaProgress.total > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-black/20 overflow-hidden">
                      <div className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${Math.round((decMassaProgress.feito / decMassaProgress.total) * 100)}%` }} />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span>
                      {decMassaResult
                        ? <>{decMassaResult.com_contato}/{decMassaResult.total} com e-mail ou telefone · <strong>{decMassaResult.salvos}</strong> cadastrados em Clientes.{decMassaLoading ? " Continuando…" : ""}</>
                        : "Iniciando busca… isso roda em lotes e pode levar alguns minutos."}
                    </span>
                    {!decMassaLoading && decMassaResult && (
                      <button onClick={() => setPage("clientes")}
                        className="text-xs px-3 py-1.5 rounded-lg border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10 transition-colors">
                        Ver Clientes →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Pesquisa na web */}
              <div className="surface-strong rounded-2xl p-4 space-y-3">
                <p className="text-slate-300 text-sm font-semibold flex items-center gap-2"><Icon name="search" size={15} /> Pesquisar decisores na web</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <input value={pesquisaEmpresa} onChange={e => setPesquisaEmpresa(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePesquisarDecisores()}
                    placeholder="Nome da empresa (ex.: Cyrela)"
                    className="flex-1 tech-input rounded-xl px-3 py-2.5 text-sm" />
                  <input value={pesquisaTermo} onChange={e => setPesquisaTermo(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePesquisarDecisores()}
                    placeholder="Cargo/termo opcional (ex.: diretor incorporação)"
                    className="flex-1 tech-input rounded-xl px-3 py-2.5 text-sm" />
                  <button onClick={handlePesquisarDecisores} disabled={pesquisando}
                    className="shrink-0 tech-button rounded-xl px-5 py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                    <Icon name="search" size={15} /> {pesquisando ? "Buscando…" : "Pesquisar"}
                  </button>
                </div>

                {pesquisaResultado && (
                  <div className="space-y-3 pt-1">
                    {pesquisaResultado.tem_provedor === false && (
                      <p className="text-amber-300 text-xs">Provedor de busca não configurado no servidor (defina GOOGLE/SERPER/BRAVE). A lista de QSA abaixo continua funcionando.</p>
                    )}
                    {pesquisaResultado.linkedin?.length > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs font-medium mb-1.5">Perfis no LinkedIn</p>
                        <div className="flex flex-wrap gap-2">
                          {pesquisaResultado.linkedin.map((l, i) => (
                            <a key={i} href={l} target="_blank" rel="noreferrer"
                              className="text-xs px-2.5 py-1 rounded-full border border-sky-500/30 text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 transition-colors">
                              in/{l.split("/in/")[1]?.replace(/\/$/, "") || "perfil"}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {(pesquisaResultado.resultados || []).map((r, i) => (
                        <div key={i} className="surface-soft rounded-xl p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <a href={r.url} target="_blank" rel="noreferrer" className="text-[#00e7fc] text-sm font-medium hover:underline line-clamp-1">{r.titulo || r.url}</a>
                              <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{r.snippet}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-slate-600 text-[11px]">{r.fonte}</span>
                                {r.cargo && <Badge color="violet">{r.cargo}</Badge>}
                                {r.linkedin && <Badge color="sky">LinkedIn</Badge>}
                              </div>
                            </div>
                            <button onClick={() => setContatoForm({
                                empresa_id: (decisores.find(d => (d.empresa_nome || "").toLowerCase() === pesquisaEmpresa.trim().toLowerCase())?.empresa_id) || "",
                                nome: "", cargo: r.cargo || "", linkedin: r.linkedin || "",
                                email: "", telefone: "", whatsapp: "",
                                notas: `${r.titulo || ""}\n${r.url}`.trim(),
                              })}
                              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#00e7fc]/30 text-[#00e7fc] hover:bg-[#00e7fc]/10 transition-colors flex items-center gap-1">
                              <Icon name="plus" size={13} /> Contato
                            </button>
                          </div>
                        </div>
                      ))}
                      {(pesquisaResultado.resultados || []).length === 0 && pesquisaResultado.tem_provedor !== false && (
                        <p className="text-slate-500 text-xs">Nada encontrado para essa empresa.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Filtros */}
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={16} /></span>
                  <input value={decBusca} onChange={e => setDecBusca(e.target.value)}
                    placeholder="Buscar por pessoa, empresa ou cargo..."
                    className="w-full pl-9 pr-4 py-2.5 tech-input rounded-xl text-sm" />
                </div>
                {decisoresQuals.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDecQual("")}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!decQual ? "border-[#00e7fc]/40 text-[#00e7fc] bg-[#00e7fc]/10" : "border-white/10 text-slate-400 hover:text-white"}`}>
                      Todos
                    </button>
                    {decisoresQuals.slice(0, 12).map(q => (
                      <button key={q.label} onClick={() => setDecQual(decQual === q.label ? "" : q.label)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${decQual === q.label ? "border-[#00e7fc]/40 text-[#00e7fc] bg-[#00e7fc]/10" : "border-white/10 text-slate-400 hover:text-white"}`}>
                        {q.label} <span className="opacity-60">({q.total})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de decisores */}
              {decisoresLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#12e7ff] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {decisores.map((d, i) => (
                    <div key={i} className="surface-strong rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white font-semibold text-sm leading-tight">{d.nome}</p>
                        {d.salvo && <Badge color="emerald">salvo</Badge>}
                      </div>
                      <div><Badge color="violet">{d.qualificacao}</Badge></div>
                      <div className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                        <Icon name="building" size={13} /> {d.empresa_nome}{d.empresa_tipo ? ` · ${d.empresa_tipo}` : ""}
                      </div>
                      {(d.email || d.telefone || d.linkedin) && (
                        <div className="text-slate-400 text-xs space-y-0.5 mt-0.5">
                          {d.email && <a href={`mailto:${d.email}`} className="flex items-center gap-1.5 hover:text-white"><Icon name="mail" size={12} /> {d.email}</a>}
                          {d.telefone && <div className="flex items-center gap-1.5"><Icon name="phone" size={12} /> {d.telefone}</div>}
                          {d.linkedin && <a href={d.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sky-300 hover:underline"><Icon name="users" size={12} /> LinkedIn</a>}
                        </div>
                      )}

                      {/* Contato da empresa (fallback imediato) */}
                      {(d.empresa_telefone || d.empresa_whatsapp) && (
                        <div className="text-slate-500 text-[11px] space-y-0.5 mt-0.5">
                          {d.empresa_telefone && <div className="flex items-center gap-1.5"><Icon name="phone" size={11} /> {d.empresa_telefone} <span className="text-slate-600">· empresa</span></div>}
                          {d.empresa_whatsapp && d.empresa_whatsapp !== d.empresa_telefone && <div className="flex items-center gap-1.5"><Icon name="whatsapp" size={11} /> {d.empresa_whatsapp} <span className="text-slate-600">· empresa</span></div>}
                        </div>
                      )}

                      {/* Resultado da busca de contato na web */}
                      {contatoBusca[i] && !contatoBusca[i].loading && (
                        <div className="mt-1 rounded-lg border border-white/10 bg-black/20 p-2 space-y-1.5">
                          {contatoBusca[i].tem_provedor === false && (
                            <p className="text-amber-300 text-[11px]">Provedor de busca não configurado no servidor.</p>
                          )}
                          {contatoBusca[i].erro && (
                            <p className="text-rose-300 text-[11px]">Erro: {contatoBusca[i].erro}</p>
                          )}
                          {contatoBusca[i].hunter && (
                            <p className="text-[10px] text-emerald-400/70">Hunter.io · {contatoBusca[i].dominio || "sem domínio"}</p>
                          )}
                          {(contatoBusca[i].emails || []).map((em, k) => {
                            const eMail = typeof em === "string" ? em : em.email;
                            const score = typeof em === "object" ? em.score : null;
                            const cargo = typeof em === "object" ? em.cargo : null;
                            const viaHunter = typeof em === "object" && (em.fonte || "").includes("Hunter");
                            return (
                              <button key={`e${k}`} onClick={() => setContatoForm({
                                  empresa_id: d.empresa_id, nome: d.nome, cargo: cargo || d.qualificacao,
                                  email: eMail, telefone: "", whatsapp: "", linkedin: "", notas: "",
                                })}
                                className="w-full text-left flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200">
                                <Icon name="mail" size={12} />
                                <span className="truncate">{eMail}</span>
                                {viaHunter && <span className="text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-300/80 shrink-0">Hunter</span>}
                                {score != null && <span className="text-[9px] text-slate-500 shrink-0">{score}%</span>}
                              </button>
                            );
                          })}
                          {(contatoBusca[i].telefones || []).map((tel, k) => (
                            <button key={`t${k}`} onClick={() => setContatoForm({
                                empresa_id: d.empresa_id, nome: d.nome, cargo: d.qualificacao,
                                email: "", telefone: tel, whatsapp: tel, linkedin: "", notas: "",
                              })}
                              className="w-full text-left flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200">
                              <Icon name="phone" size={12} /> {tel}
                            </button>
                          ))}
                          {(contatoBusca[i].emails || []).length === 0 && (contatoBusca[i].telefones || []).length === 0 && !contatoBusca[i].erro && (
                            <p className="text-slate-500 text-[11px]">Nenhum e-mail/telefone encontrado na web.</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
                        <span className="text-slate-600 text-[10px] flex-1 truncate">{d.fonte}</span>
                        {!d.salvo && (
                          <button onClick={() => setContatoForm({
                              empresa_id: d.empresa_id, nome: d.nome, cargo: d.qualificacao,
                              email: "", telefone: "", whatsapp: "", linkedin: "", notas: "",
                            })}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#00e7fc]/30 text-[#00e7fc] hover:bg-[#00e7fc]/10 transition-colors flex items-center gap-1">
                            <Icon name="plus" size={12} /> Salvar
                          </button>
                        )}
                        <button onClick={() => handleBuscarContato(i, d)} disabled={contatoBusca[i]?.loading}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 disabled:opacity-60">
                          <Icon name="mail" size={12} /> {contatoBusca[i]?.loading ? "Buscando…" : "E-mail/Tel"}
                        </button>
                        <button onClick={() => { setPesquisaEmpresa(d.empresa_nome || ""); setPesquisaTermo(d.nome || ""); }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1">
                          <Icon name="search" size={12} /> Web
                        </button>
                      </div>
                    </div>
                  ))}
                  {decisores.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-slate-500">
                      Nenhum decisor ainda. Enriqueça empresas pelo CNPJ (aba Receita Federal) para puxar o quadro de sócios, ou use a pesquisa na web acima.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CLIENTES */}
          {page === "clientes" && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-white text-lg font-bold">Clientes</h2>
                  <p className="text-slate-500 text-sm">Pessoas cadastradas a partir dos decisores, com e-mail e telefone. Selecione e jogue numa campanha.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge color="sky">{clientes.length} clientes</Badge>
                  <Badge color="emerald">{clienteSelectedIds.length} selecionados</Badge>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={16} /></span>
                  <input value={clienteBusca} onChange={e => setClienteBusca(e.target.value)}
                    placeholder="Buscar por nome, empresa, e-mail ou telefone..."
                    className="w-full pl-9 pr-4 py-2.5 tech-input rounded-xl text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setClienteSelectedIds(clientes.map(c => c.id))}
                    className="px-3 py-2.5 rounded-xl text-sm border border-[#00e7fc]/25 text-[#00e7fc] hover:bg-[#00e7fc]/10 transition-colors">
                    Selecionar todos
                  </button>
                  <button onClick={() => setClienteSelectedIds([])}
                    className="px-3 py-2.5 rounded-xl text-sm border border-white/10 text-slate-300 hover:bg-white/5 transition-colors">
                    Limpar
                  </button>
                  <button onClick={() => enviarClientesParaCampanha("whatsapp")}
                    className="px-3 py-2.5 rounded-xl text-sm border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5">
                    <Icon name="send" size={14} /> Campanha WhatsApp
                  </button>
                  <button onClick={() => enviarClientesParaCampanha("email")}
                    className="px-3 py-2.5 rounded-xl text-sm border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 transition-colors flex items-center gap-1.5">
                    <Icon name="mail" size={14} /> Campanha E-mail
                  </button>
                </div>
              </div>

              {clientesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#12e7ff] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {clientes.map(c => {
                    const ativo = clienteSelectedIds.includes(c.id);
                    return (
                      <div key={c.id}
                        className={`surface-strong rounded-2xl p-4 flex flex-col gap-2 border transition-colors ${ativo ? "border-[#00e7fc]/40" : "border-transparent"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => toggleCliente(c.id)} className="text-left min-w-0 flex items-center gap-2">
                            <span className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center text-[11px] ${ativo ? "border-[#00e7fc] bg-[#00e7fc]/20 text-[#00e7fc]" : "border-white/20 text-transparent"}`}>✓</span>
                            <span className="text-white font-semibold text-sm leading-tight truncate">{c.nome}</span>
                          </button>
                          <button onClick={() => handleExcluirCliente(c.id)} className="shrink-0 text-slate-500 hover:text-rose-300 transition-colors">
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                        {c.cargo && <div><Badge color="violet">{c.cargo}</Badge></div>}
                        {c.empresa_nome && (
                          <div className="text-slate-400 text-xs flex items-center gap-1.5">
                            <Icon name="building" size={13} /> {c.empresa_nome}
                          </div>
                        )}
                        <div className="text-slate-400 text-xs space-y-0.5 mt-0.5">
                          {c.email
                            ? <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-white"><Icon name="mail" size={12} /> {c.email}</a>
                            : <div className="flex items-center gap-1.5 text-slate-600"><Icon name="mail" size={12} /> sem e-mail</div>}
                          {(c.whatsapp || c.telefone)
                            ? <div className="flex items-center gap-1.5"><Icon name="phone" size={12} /> {c.whatsapp || c.telefone}</div>
                            : <div className="flex items-center gap-1.5 text-slate-600"><Icon name="phone" size={12} /> sem telefone</div>}
                        </div>
                      </div>
                    );
                  })}
                  {clientes.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-slate-500">
                      Nenhum cliente ainda. Vá em <button onClick={() => setPage("decisores")} className="text-[#00e7fc] hover:underline">Decisores</button> e use “Buscar e-mail/tel de todos → Clientes”.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MERCADO */}
          {page === "mercado" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="surface-strong rounded-2xl p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-[0.2em]">Área</p>
                  <div className="relative">
                    <input
                      value={marketArea}
                      onChange={e => { setMarketArea(e.target.value); setAreaOpen(true); }}
                      onFocus={() => setAreaOpen(true)}
                      onBlur={() => setTimeout(() => setAreaOpen(false), 150)}
                      className="mt-3 w-full tech-input rounded-xl px-3 py-2 text-sm"
                      placeholder="Consolação/Jardins/Bela Vista"
                      autoComplete="off"
                    />
                    {areaOpen && areaSugg.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 surface-strong border border-white/10 rounded-xl overflow-hidden shadow-xl max-h-60 overflow-y-auto">
                        {areaSugg.map(s => (
                          <button
                            key={s}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); escolherArea(s); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors flex items-center gap-2"
                          >
                            <Icon name="map" size={13} />
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">Dica: separe vários bairros com “/”.</p>
                </div>
                <div className="surface-strong rounded-2xl p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-[0.2em]">Filtro</p>
                  <select
                    value={marketTipo}
                    onChange={e => setMarketTipo(e.target.value)}
                    className="mt-3 w-full surface-soft rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="">Todos os itens</option>
                    <option value="construtora">Incorporadoras/Construtoras</option>
                    <option value="imobiliaria">Imobiliárias</option>
                    <option value="empreendimento">Empreendimentos</option>
                    <option value="imovel">Imóveis</option>
                    <option value="outro">Outros</option>
                  </select>
                </div>
                <div className="surface-strong rounded-2xl p-4 flex flex-col justify-between gap-3">
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-[0.2em]">Ação</p>
                    <p className="text-sm text-slate-300 mt-2">Varrer sites e anúncios públicos da região</p>
                  </div>
                  <button
                    onClick={handleScanMarket}
                    disabled={marketScanning}
                    className="tech-button rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    {marketScanning ? "Mapeando..." : "Mapear mercado"}
                  </button>
                </div>
              </div>

              {marketSummary && (
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="ITENS" value={marketSummary.total} icon="map" accent="#12e7ff" sub="capturados" />
                  <StatCard
                    label="EMPREENDIMENTOS"
                    value={marketSummary.por_tipo?.find(t => t.tipo === "empreendimento")?.total || 0}
                    icon="building"
                    accent="#00ff6a"
                    sub="da região"
                  />
                  <StatCard
                    label="IMÓVEIS"
                    value={marketSummary.por_tipo?.find(t => t.tipo === "imovel")?.total || 0}
                    icon="home"
                    accent="#8b5cf6"
                    sub="anúncios e ofertas"
                  />
                  <StatCard
                    label="FONTES"
                    value={marketSummary?.por_empresa?.length || marketSummary.recentes?.length || 0}
                    icon="file"
                    accent="#f59e0b"
                    sub="sites varridos"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 surface-strong rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold">Itens encontrados</h3>
                      <p className="text-slate-500 text-xs mt-0.5">Empreendimentos e imóveis públicos ligados à área</p>
                    </div>
                    {marketLoading && <div className="w-5 h-5 border-2 border-[#12e7ff] border-t-transparent rounded-full animate-spin" />}
                  </div>

                  <div className="space-y-3">
                    {marketItems.map(item => (
                      <div key={`${item.id || item.url}-${item.nome}`} className="rounded-2xl border border-white/5 bg-white/3 p-4 hover:border-[#12e7ff]/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-white font-medium truncate">{item.nome}</h4>
                              <Badge color={item.tipo === "empreendimento" ? "emerald" : item.tipo === "imovel" ? "sky" : "slate"}>{item.tipo}</Badge>
                            </div>
                            <p className="text-slate-400 text-xs mt-1">
                              {item.empresa_nome ? `${item.empresa_nome} · ` : ""}
                              {item.area || marketArea}
                            </p>
                            <p className="text-slate-500 text-xs mt-1">
                              {[item.endereco, item.bairro, item.municipio, item.uf].filter(Boolean).join(" · ")}
                            </p>
                            <p className="text-slate-500 text-xs mt-1 line-clamp-2">
                              {item.subtitulo || item.dados?.description || item.dados?.snippet || ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {item.valor_venda && <Badge color="amber">{item.valor_venda}</Badge>}
                            {item.valor_locacao && <Badge color="sky">{item.valor_locacao}</Badge>}
                            {item.score ? <span className="text-xs text-slate-500">score {item.score}</span> : null}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-white/5">
                          <span className="text-slate-500 text-xs">{item.fonte || item.url}</span>
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-[#12e7ff] text-xs hover:underline">
                            abrir fonte
                          </a>
                        </div>
                      </div>
                    ))}
                    {!marketLoading && marketItems.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        Nenhum item capturado ainda. Clique em "Mapear mercado".
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="surface-strong rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-4">Principais empresas</h3>
                    <div className="space-y-3">
                      {(marketSummary?.por_empresa || []).map(row => (
                        <div key={row.nome} className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="text-slate-300">{row.nome}</span>
                          <Badge color="violet">{row.total}</Badge>
                        </div>
                      ))}
                      {(!marketSummary?.por_empresa || marketSummary.por_empresa.length === 0) && (
                        <p className="text-slate-500 text-sm">Sem dados ainda.</p>
                      )}
                    </div>
                  </div>

                  <div className="surface-strong rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-4">Tipos capturados</h3>
                    <div className="space-y-3">
                      {(marketSummary?.por_tipo || []).map(row => (
                        <div key={row.tipo}>
                          <div className="flex justify-between mb-1 text-sm">
                            <span className="text-slate-300 capitalize">{row.tipo}</span>
                            <span className="text-slate-500">{row.total}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#12e7ff] to-[#00ff6a] rounded-full" style={{ width: `${Math.min(100, (row.total / Math.max(1, marketSummary.total)) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATES */}
          {page === "templates" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-white font-semibold text-lg">Templates de mensagem</h3>
                  <p className="text-slate-400 text-sm mt-1">{templates.length} salvos · use {`{{variavel}}`} para personalizar.</p>
                </div>
                <button
                  onClick={openNewTemplate}
                  className="px-4 py-2.5 tech-button rounded-xl text-white text-sm font-medium flex items-center gap-2"
                >
                  <Icon name="plus" size={14} /> Novo template
                </button>
              </div>
              {templates.length === 0 && (
                <div className="surface-strong rounded-2xl p-8 text-center text-slate-400 text-sm">
                  Nenhum template ainda. Clique em <span className="text-white">Novo template</span> para criar o primeiro.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(t => (
                <div key={t.id} className="surface-strong rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold">{t.nome}</h3>
                      {t.categoria && <Badge color="sky">{t.categoria}</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditTemplate(t)}
                        title="Editar template"
                        className="text-slate-500 hover:text-[#00e7fc] transition-colors p-1"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        title="Excluir template"
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm whitespace-pre-line leading-relaxed">{t.conteudo}</p>
                  {t.variaveis?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#00e7fc]/8 flex flex-wrap gap-1">
                      {t.variaveis.map(v => (
                        <Badge key={v} color="violet">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          )}

          {/* TAREFAS */}
          {page === "tarefas" && (
            <div className="space-y-5">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-white font-semibold text-lg">Tarefas</h3>
                  <p className="text-slate-400 text-sm mt-1">Agenda inteligente das atividades internas: visualize por dia, semana, mês ou lista, filtre por responsável, status e prioridade. Clique num dia para criar e arraste uma tarefa para reagendá-la.</p>
                </div>
                <button onClick={openNovaTarefa}
                  className="px-4 py-2.5 tech-button rounded-xl text-white text-sm font-medium flex items-center gap-2">
                  <Icon name="plus" size={14} /> Nova tarefa
                </button>
              </div>

              {/* Cards de resumo */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {[
                  { label: "Total", value: tarefasResumo.total, icon: "tasks", color: "#12e7ff" },
                  { label: "Pendentes", value: tarefasResumo.pendentes, icon: "clock", color: "#f59e0b" },
                  { label: "Em andamento", value: tarefasResumo.em_andamento, icon: "refresh", color: "#38bdf8" },
                  { label: "Concluídas", value: tarefasResumo.concluidas, icon: "check", color: "#00ff6a" },
                  { label: "Vencidas", value: tarefasResumo.vencidas, icon: "alert", color: "#fb7185" },
                ].map((c) => (
                  <div key={c.label} className="surface-strong rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-[0.16em]">
                      <span style={{ color: c.color }}><Icon name={c.icon} size={15} /></span>
                      {c.label}
                    </div>
                    <div className="text-white text-3xl font-semibold mt-2 leading-none">{fmtNum(c.value)}</div>
                  </div>
                ))}
              </div>

              {/* Filtros e pesquisa */}
              <div className="surface-strong rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={16} /></span>
                    <input value={tarefaBusca} onChange={(e) => setTarefaBusca(e.target.value)}
                      placeholder="Pesquisar por título ou descrição..."
                      className="w-full pl-9 pr-4 py-2.5 tech-input rounded-xl text-sm" />
                  </div>
                  <select value={tarefaFiltroStatus} onChange={(e) => setTarefaFiltroStatus(e.target.value)}
                    className="surface-soft rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e7fc]">
                    <option value="">Todos os status</option>
                    {TAREFA_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select value={tarefaFiltroPrioridade} onChange={(e) => setTarefaFiltroPrioridade(e.target.value)}
                    className="surface-soft rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e7fc]">
                    <option value="">Todas as prioridades</option>
                    {TAREFA_PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <select value={tarefaFiltroResponsavel} onChange={(e) => setTarefaFiltroResponsavel(e.target.value)}
                    className="surface-soft rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e7fc]">
                    <option value="">Todos os responsáveis</option>
                    <option value="__sem__">Sem responsável</option>
                    {[...new Set(tarefas.map((t) => t.responsavel).filter(Boolean))].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-slate-400 text-sm flex items-center gap-2">
                    Vence até:
                    <input type="date" value={tarefaFiltroVenceAte} onChange={(e) => setTarefaFiltroVenceAte(e.target.value)}
                      className="tech-input rounded-xl px-3 py-2 text-sm text-white" />
                  </label>
                  <label className="text-slate-300 text-sm flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={tarefaFiltroVencidas} onChange={(e) => setTarefaFiltroVencidas(e.target.checked)}
                      className="accent-[#fb7185] w-4 h-4" />
                    Somente vencidas
                  </label>
                  {(tarefaBusca || tarefaFiltroStatus || tarefaFiltroPrioridade || tarefaFiltroResponsavel || tarefaFiltroVenceAte || tarefaFiltroVencidas) && (
                    <button onClick={() => { setTarefaBusca(""); setTarefaFiltroStatus(""); setTarefaFiltroPrioridade(""); setTarefaFiltroResponsavel(""); setTarefaFiltroVenceAte(""); setTarefaFiltroVencidas(false); }}
                      className="ml-auto text-slate-400 hover:text-white text-sm flex items-center gap-1">
                      <Icon name="x" size={14} /> Limpar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Agenda / calendário das tarefas */}
              <AgendaCalendar
                tarefas={tarefas}
                loading={tarefasLoading}
                Icon={Icon}
                corDaTarefa={tarefaCor}
                prioridades={TAREFA_PRIORIDADES}
                statusList={TAREFA_STATUS}
                onNova={openNovaTarefa}
                onAbrir={setTarefaView}
                onMover={handleMoverTarefa}
              />
            </div>
          )}

          {/* CAMPANHAS */}
          {page === "campanhas" && (
            <div className="space-y-5">
              <div className="surface-strong rounded-3xl p-5 lg:p-6 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      {campanhaCanal === "email" ? "Disparo de E-mail" : "Disparo de WhatsApp"}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                      {campanhaCanal === "email"
                        ? "Escolha os destinatários da base, defina o assunto e escreva a mensagem. Você pode anexar um arquivo."
                        : "Primeiro escolha os números da base, depois escreva a mensagem e selecione a imagem ou vídeo."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge color="sky">
                      {campanhaCanal === "email"
                        ? `${campanhaItensFonte.filter(i => i.email).length} e-mails disponíveis`
                        : `${campanhaItensFonte.filter(i => i.whatsapp || i.telefone).length} números disponíveis`}
                    </Badge>
                    <Badge color="emerald">{campanhaSelectedIds.length} selecionados</Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-2xl border border-white/8 bg-black/20 p-1 self-start">
                    <button
                      type="button"
                      onClick={() => { setCampanhaCanal("whatsapp"); setCampanhaSelectedIds([]); setCampanhaResultado(null); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${campanhaCanal === "whatsapp" ? "bg-[#00e7fc]/15 text-[#00e7fc]" : "text-slate-400 hover:text-white"}`}
                    >
                      <Icon name="send" size={15} /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCampanhaCanal("email"); setCampanhaSelectedIds([]); setCampanhaResultado(null); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${campanhaCanal === "email" ? "bg-[#00e7fc]/15 text-[#00e7fc]" : "text-slate-400 hover:text-white"}`}
                    >
                      <Icon name="mail" size={15} /> E-mail
                    </button>
                  </div>

                  <div className="inline-flex rounded-2xl border border-white/8 bg-black/20 p-1 self-start">
                    <button
                      type="button"
                      onClick={() => { setCampanhaFonte("empresas"); setCampanhaSelectedIds([]); setCampanhaResultado(null); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${campanhaFonte === "empresas" ? "bg-[#00e7fc]/15 text-[#00e7fc]" : "text-slate-400 hover:text-white"}`}
                    >
                      <Icon name="building" size={15} /> Empresas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCampanhaFonte("clientes"); setCampanhaSelectedIds([]); setCampanhaResultado(null); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${campanhaFonte === "clientes" ? "bg-[#00e7fc]/15 text-[#00e7fc]" : "text-slate-400 hover:text-white"}`}
                    >
                      <Icon name="users" size={15} /> Clientes
                    </button>
                  </div>
                </div>

                {campanhaResultado && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    Disparo concluído: {campanhaResultado.enviados}/{campanhaResultado.total} enviados
                    {campanhaResultado.media ? " com mídia/anexo" : ""}
                    {campanhaResultado.sem_email ? ` · ${campanhaResultado.sem_email} sem e-mail` : ""}
                    {campanhaResultado.erros ? ` · ${campanhaResultado.erros} com erro` : ""}.
                    {Array.isArray(campanhaResultado.erros_detalhes) && campanhaResultado.erros_detalhes.length > 0 && (
                      <div className="mt-3 space-y-2 text-xs text-emerald-50/90">
                        {campanhaResultado.erros_detalhes.map((item, idx) => (
                          <div key={`${item?.empresa || "erro"}-${idx}`} className="rounded-xl border border-emerald-400/20 bg-black/10 px-3 py-2">
                            <div className="font-medium text-white">{item?.empresa || "Destinatário"}</div>
                            <div className="text-emerald-100/80 mt-0.5">
                              {item?.numero ? `+${item.numero} · ` : ""}{item?.erro || "Falha no envio"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-white font-semibold">
                            {campanhaCanal === "email" ? "1. Selecione os destinatários" : "1. Selecione os números"}
                          </p>
                          <p className="text-slate-500 text-sm">
                            {campanhaFonte === "clientes"
                              ? (campanhaCanal === "email" ? "A lista abaixo mostra clientes com e-mail cadastrado." : "A lista abaixo mostra clientes com WhatsApp ou telefone cadastrado.")
                              : (campanhaCanal === "email" ? "A lista abaixo mostra empresas com e-mail cadastrado." : "A lista abaixo mostra empresas com WhatsApp ou telefone cadastrado.")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={selecionarTodosCampanha}
                            className="px-3 py-2 rounded-xl text-sm border border-[#00e7fc]/25 text-[#00e7fc] hover:bg-[#00e7fc]/10 transition-colors"
                          >
                            Selecionar todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setCampanhaSelectedIds([])}
                            className="px-3 py-2 rounded-xl text-sm border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            <Icon name="search" size={16} />
                          </span>
                          <input
                            value={campanhaTargetSearch}
                            onChange={e => setCampanhaTargetSearch(e.target.value)}
                            placeholder={campanhaCanal === "email" ? "Buscar empresa ou e-mail..." : "Buscar empresa ou número..."}
                            className="w-full pl-9 pr-4 py-2.5 tech-input rounded-xl text-sm"
                          />
                        </div>
                      </div>

                      <div className="mt-4 max-h-[360px] overflow-y-auto space-y-2 pr-1">
                        {(() => {
                          const lista = campanhaItensFonte.filter(item => {
                            const contato = campanhaCanal === "email"
                              ? (item.email || "")
                              : (item.whatsapp || item.telefone || "");
                            if (!contato) return false;
                            const termo = campanhaTargetSearch.trim().toLowerCase();
                            if (!termo) return true;
                            return (
                              String(item.nome || "").toLowerCase().includes(termo) ||
                              String(contato).toLowerCase().includes(termo) ||
                              String(item.tipo || "").toLowerCase().includes(termo)
                            );
                          });
                          if (lista.length === 0) {
                            return (
                              <div className="rounded-2xl border border-white/6 bg-black/10 p-4 text-slate-500 text-sm">
                                {campanhaCanal === "email" ? "Nenhum e-mail encontrado." : "Nenhum número encontrado."}
                              </div>
                            );
                          }
                          return lista.map(item => {
                            const contato = campanhaCanal === "email"
                              ? (item.email || "")
                              : (item.whatsapp || item.telefone || "");
                            const possuiWhatsApp = Boolean(item.whatsapp);
                            const possuiTelefone = Boolean(item.telefone);
                            const badgeContato = campanhaCanal === "email"
                              ? (contato ? "E-mail" : "Sem e-mail")
                              : (possuiWhatsApp ? "WhatsApp" : (possuiTelefone ? "Telefone" : "Sem número"));
                            const ativo = campanhaSelectedIds.includes(String(item.id));
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleCampanhaTarget(String(item.id))}
                                className={`w-full text-left rounded-2xl border p-4 transition-colors ${ativo
                                  ? "border-[#00e7fc]/35 bg-[#00e7fc]/10"
                                  : "border-white/6 bg-black/10 hover:bg-white/[0.04]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-white text-sm font-medium truncate">{item.nome}</p>
                                      {item.tipo && <Badge color="sky">{item.tipo}</Badge>}
                                      <Badge color={campanhaCanal === "email" ? "sky" : (possuiWhatsApp ? "emerald" : "amber")}>
                                        {badgeContato}
                                      </Badge>
                                    </div>
                                    <p className="text-slate-400 text-xs mt-1 truncate">
                                      {contato || (campanhaCanal === "email" ? "Sem e-mail" : "Sem número")}
                                      {item.bairro ? ` · ${item.bairro}` : ""}
                                    </p>
                                    {campanhaCanal === "whatsapp" && !possuiWhatsApp && possuiTelefone && (
                                      <p className="text-amber-300/90 text-[11px] mt-1">
                                        Este contato está cadastrado só com telefone. Pode não receber no WhatsApp.
                                      </p>
                                    )}
                                  </div>
                                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${ativo ? "border-[#00e7fc] bg-[#00e7fc]/20 text-[#00e7fc]" : "border-white/20 text-transparent"}`}>
                                    ✓
                                  </div>
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                      <p className="text-white font-semibold">2. Escolha a mensagem</p>
                      <p className="text-slate-500 text-sm mt-1">Você pode usar um template existente ou escrever uma mensagem personalizada.</p>

                      <div className="mt-4">
                        <label className="text-slate-400 text-sm block mb-1.5">Template</label>
                        <select
                          value={campanhaTemplateId}
                          onChange={e => handleCampanhaTemplate(e.target.value)}
                          className="w-full surface-soft rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e7fc]"
                        >
                          <option value="">Mensagem personalizada</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      {campanhaCanal === "email" && (
                        <div className="mt-4">
                          <label className="text-slate-400 text-sm block mb-1.5">Assunto do e-mail</label>
                          <input
                            value={campanhaAssunto}
                            onChange={e => setCampanhaAssunto(e.target.value)}
                            placeholder="Ex: Proposta de parceria - {{empresa}}"
                            className="w-full tech-input rounded-xl px-3 py-2.5 text-sm"
                          />
                        </div>
                      )}

                      <div className="mt-4">
                        <label className="text-slate-400 text-sm block mb-1.5">Título da campanha</label>
                        <input
                          value={campanhaNome}
                          onChange={e => setCampanhaNome(e.target.value)}
                          placeholder="Ex: Disparo Jardins - Julho"
                          className="w-full tech-input rounded-xl px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="text-slate-400 text-sm block mb-1.5">Descrição</label>
                        <input
                          value={campanhaDescricao}
                          onChange={e => setCampanhaDescricao(e.target.value)}
                          placeholder="Resumo da campanha"
                          className="w-full tech-input rounded-xl px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="text-slate-400 text-sm block mb-1.5">Mensagem</label>
                        <textarea
                          value={campanhaMensagem}
                          onChange={e => setCampanhaMensagem(e.target.value)}
                          placeholder="Digite a mensagem que vai ser enviada..."
                          rows={8}
                          className="w-full tech-input rounded-xl px-3 py-2.5 text-sm resize-none"
                        />
                        <p className="text-[11px] text-slate-500 mt-2">
                          Use <span className="text-slate-300">{"{{empresa}}"}</span> para personalizar o nome da empresa.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                      <p className="text-white font-semibold">
                        {campanhaCanal === "email" ? "3. Adicione um anexo" : "3. Adicione uma mídia"}
                      </p>
                      <p className="text-slate-500 text-sm mt-1">
                        {campanhaCanal === "email"
                          ? "Anexe uma imagem ou vídeo ao e-mail (opcional)."
                          : "Envie uma imagem ou um vídeo junto com a mensagem."}
                      </p>

                      <div className="mt-4">
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={async e => {
                            try {
                              await handleCampanhaMedia(e.target.files?.[0] || null);
                            } catch (err) {
                              alert(err.message || "Falha ao enviar mídia.");
                            }
                          }}
                          className="w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00e7fc]/15 file:px-4 file:py-2 file:text-[#00e7fc] hover:file:bg-[#00e7fc]/20"
                        />
                        <p className="text-[11px] text-slate-500 mt-2">
                          Aceita imagens e vídeos. Se você trocar o arquivo, a prévia é atualizada automaticamente.
                        </p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/6 bg-black/15 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400 text-sm">Arquivo</span>
                          <button
                            type="button"
                            onClick={() => handleCampanhaMedia(null)}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Remover
                          </button>
                        </div>
                        <p className="text-white text-sm">{campanhaMediaNome || "Nenhum arquivo selecionado"}</p>
                        <p className="text-slate-500 text-xs">{campanhaMediaMime || "image/* ou video/*"}</p>
                      </div>

                      {campanhaMediaPreview && (
                        <div className="mt-4 rounded-2xl border border-white/6 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="text-slate-400 text-sm">Prévia</span>
                            <Badge color={campanhaMediaType === "video" ? "violet" : "sky"}>
                              {campanhaMediaType === "video" ? "Vídeo" : "Imagem"}
                            </Badge>
                          </div>
                          {campanhaMediaType === "video" ? (
                            <video
                              controls
                              src={campanhaMediaPreview}
                              className="w-full max-h-64 rounded-xl border border-white/10 bg-black"
                            />
                          ) : (
                            <img
                              src={campanhaMediaPreview}
                              alt="Prévia da mídia da campanha"
                              className="w-full max-h-64 object-contain rounded-xl border border-white/10 bg-black"
                            />
                          )}
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/6 bg-black/10 p-3">
                          <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">Selecionados</div>
                          <div className="text-white text-2xl font-semibold mt-2">{campanhaSelectedIds.length}</div>
                        </div>
                        <div className="rounded-2xl border border-white/6 bg-black/10 p-3">
                        <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">{campanhaCanal === "email" ? "E-mails" : "Números"}</div>
                        <div className="text-white text-2xl font-semibold mt-2">
                          {campanhaCanal === "email"
                            ? campanhaItensFonte.filter(i => i.email).length
                            : campanhaItensFonte.filter(i => i.whatsapp || i.telefone).length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/6 bg-black/10 p-3 col-span-2">
                        <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">Arquivo</div>
                        <div className="text-white text-sm font-medium mt-2">
                          {campanhaMediaNome || "Nenhum arquivo selecionado"}
                        </div>
                      </div>
                    </div>

                      <button
                        type="button"
                        onClick={campanhaCanal === "email" ? dispararCampanhaEmail : dispararCampanhaRapida}
                        disabled={campanhaEnviando}
                        className="mt-4 w-full py-3 tech-button rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Icon name={campanhaCanal === "email" ? "mail" : "send"} size={16} />
                        {campanhaEnviando
                          ? "Disparando..."
                          : campanhaCanal === "email" ? "Disparar E-mail" : "Disparar WhatsApp"}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                      <p className="text-white font-semibold">Resumo do disparo</p>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Canal</span>
                          <span className="text-white">{campanhaCanal === "email" ? "E-mail" : "WhatsApp"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Selecionados</span>
                          <span className="text-white">{campanhaSelectedIds.length}</span>
                        </div>
                        {campanhaCanal === "email" && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Assunto</span>
                            <span className="text-white">{campanhaAssunto.trim() ? "pronto" : "vazio"}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Mensagem</span>
                          <span className="text-white">{campanhaMensagem.trim() ? "pronta" : "vazia"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">{campanhaCanal === "email" ? "Anexo" : "Mídia"}</span>
                          <span className="text-white">{campanhaMediaNome ? "anexado" : (campanhaCanal === "email" ? "sem anexo" : "sem mídia")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {campanhas.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 surface-strong rounded-2xl">
                    <Icon name="megaphone" size={40} />
                    <p className="mt-3">Nenhuma campanha criada ainda</p>
                  </div>
                ) : campanhas.map(c => (
                  <div key={c.id} className="surface-strong rounded-2xl p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-semibold">{c.nome}</h3>
                        <p className="text-slate-500 text-sm mt-0.5">{c.descricao}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={
                          c.status === "concluida" ? "emerald" :
                          c.status === "em_andamento" ? "amber" :
                          c.status === "rascunho" ? "slate" : "sky"
                        }>{c.status}</Badge>
                        <button
                          onClick={() => excluirCampanha(c)}
                          title="Excluir campanha"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-6 mt-4 pt-4 border-t border-[#00e7fc]/8">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{c.total_envios}</p>
                        <p className="text-slate-500 text-xs">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-400">{c.enviados}</p>
                        <p className="text-slate-500 text-xs">Enviados</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-[#00ff4d]">{c.respondidos}</p>
                        <p className="text-slate-500 text-xs">Respondidos</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WHATSAPP */}
          {page === "whatsapp" && (
            <div className="max-w-lg space-y-5">
              <div className={`rounded-2xl border p-6 ${waConnected
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-rose-500/10 border-rose-500/30"}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    waConnected ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                    <Icon name="whatsapp" size={24} />
                  </div>
                  <div>
                    <h3 className={`font-semibold text-lg ${waConnected ? "text-emerald-300" : "text-rose-300"}`}>
                      {waConnected ? "WhatsApp Conectado ✓" : "WhatsApp Desconectado"}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Conta: <span className="text-slate-200 font-medium">{waInstance}</span>
                      {" · "}
                      {waConnected ? "pronto para enviar mensagens" : "escaneie o QR Code para conectar"}
                    </p>
                  </div>
                </div>
              </div>

              {!waConnected && (
                <div className="surface-strong rounded-2xl p-6 text-center">
                  <p className="text-slate-400 text-sm mb-4">
                    Conectando a conta <b className="text-[#00e7fc]">{waInstance}</b>. Abra o WhatsApp no celular → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e escaneie o código abaixo.
                  </p>
                  <div className="flex justify-center mb-4">
                    {waQR ? (
                      <img src={waQR} alt="QR Code WhatsApp" className="w-60 h-60 rounded-xl bg-white p-2" />
                    ) : (
                      <div className="w-60 h-60 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-500 text-sm">
                        {waLoadingQR ? "Gerando QR Code..." : "QR Code indisponível"}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { loadQR(); checkWA(); }} className="px-4 py-2 tech-button rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto">
                    <Icon name="refresh" size={14} /> Gerar novo QR / Verificar
                  </button>
                </div>
              )}

              {/* Contas de WhatsApp (multi-instância) */}
              <div className="surface-strong rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Icon name="users" size={16} /> Contas de WhatsApp
                  </h3>
                  <button onClick={loadContas} title="Atualizar"
                    className="text-slate-400 hover:text-white transition-colors">
                    <Icon name="refresh" size={15} />
                  </button>
                </div>
                <p className="text-slate-500 text-xs mb-4">
                  Conecte vários números. Selecione uma conta para gerar o QR Code dela.
                </p>

                <div className="space-y-2">
                  {waContas.length === 0 && (
                    <p className="text-slate-500 text-sm py-2">
                      {waContasLoading ? "Carregando contas..." : "Nenhuma conta encontrada."}
                    </p>
                  )}
                  {waContas.map((conta) => {
                    const ativa = conta.nome === waInstance;
                    return (
                      <div key={conta.nome}
                        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${ativa
                          ? "border-[#00e7fc]/40 bg-[#00e7fc]/10"
                          : "border-white/5 bg-white/3 hover:border-[#00e7fc]/20"}`}>
                        <button onClick={() => selecionarConta(conta.nome)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            conta.conectado ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>
                            <Icon name="whatsapp" size={15} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium truncate">{conta.nome}</span>
                              {conta.padrao && <Badge color="slate">padrão</Badge>}
                              {ativa && <Badge color="violet">selecionada</Badge>}
                            </div>
                            <span className={`text-xs ${conta.conectado ? "text-emerald-400" : "text-slate-500"}`}>
                              {conta.conectado ? "● Conectado" : "○ Desconectado"}
                            </span>
                          </div>
                        </button>
                        {!conta.conectado && (
                          <button onClick={() => selecionarConta(conta.nome)}
                            className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-[#00e7fc]/30 text-[#00e7fc] hover:bg-[#00e7fc]/10 transition-colors">
                            Conectar
                          </button>
                        )}
                        {!conta.padrao && (
                          <button onClick={() => removeConta(conta.nome)} title="Remover conta"
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-rose-500/25 text-rose-300 hover:bg-rose-500/10 transition-colors">
                            <Icon name="x" size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-[#00e7fc]/8">
                  <label className="text-slate-400 text-xs block mb-1.5">Adicionar nova conta</label>
                  <div className="flex gap-2">
                    <input
                      value={waNovaConta}
                      onChange={(e) => setWaNovaConta(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addConta(); }}
                      placeholder="ex: vendas, suporte, locação..."
                      className="flex-1 tech-input rounded-xl px-3 py-2 text-white text-sm"
                    />
                    <button onClick={addConta} disabled={waAddingConta || !waNovaConta.trim()}
                      className="shrink-0 px-3 py-2 tech-button rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
                      <Icon name="plus" size={15} /> {waAddingConta ? "Criando..." : "Adicionar"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    O nome é normalizado (minúsculas, sem espaços). Depois de criar, selecione a conta e escaneie o QR.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* EMPRESA DETAIL MODAL */}
      {selectedEmpresa && (
        <EmpresaModal
          empresa={selectedEmpresa}
          templates={templates}
          onClose={() => setSelectedEmpresa(null)}
          onRefreshCNPJ={loadEmpresas}
          onEmpresaUpdated={setSelectedEmpresa}
        />
      )}

      {/* NEW EMPRESA MODAL */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Nova Empresa">
        <div className="space-y-4">
          {[
            { label: "Nome", key: "nome", placeholder: "Nome da empresa" },
            { label: "CNPJ", key: "cnpj", placeholder: "00.000.000/0001-00" },
            { label: "Bairro", key: "bairro", placeholder: "Consolação, Jardins..." },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-slate-400 text-sm block mb-1.5">{label}</label>
              <input
                value={newEmpresa[key]}
                onChange={e => setNewEmpresa(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>
          ))}
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Tipo</label>
            <select value={newEmpresa.tipo} onChange={e => setNewEmpresa(p => ({ ...p, tipo: e.target.value }))}
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm">
              <option value="incorporadora">Incorporadora</option>
              <option value="construtora">Construtora</option>
              <option value="imobiliaria">Imobiliária</option>
              <option value="corretora">Corretora</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <button onClick={handleAddEmpresa} disabled={!newEmpresa.nome}
            className="w-full py-2.5 tech-button rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <Icon name="plus" size={14} /> Adicionar empresa
          </button>
        </div>
      </Modal>

      {/* NEW TEMPLATE MODAL */}
      <Modal open={showTemplateModal} onClose={() => { setShowTemplateModal(false); setEditingTemplateId(null); }} title={editingTemplateId ? "Editar Template" : "Novo Template"}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Nome</label>
            <input value={newTemplate.nome} onChange={e => setNewTemplate(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Apresentação Inicial"
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Categoria</label>
            <input value={newTemplate.categoria} onChange={e => setNewTemplate(p => ({ ...p, categoria: e.target.value }))}
              placeholder="prospecção, follow-up, comercial..."
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Conteúdo <span className="text-slate-600">(use {`{{variavel}}`} para personalizar)</span></label>
            <textarea value={newTemplate.conteudo} onChange={e => setNewTemplate(p => ({ ...p, conteudo: e.target.value }))}
              placeholder="Olá, {{nome}}! ..."
              rows={6}
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm resize-none" />
          </div>
          <button onClick={handleSaveTemplate} disabled={!newTemplate.nome || !newTemplate.conteudo}
            className="w-full py-2.5 tech-button rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <Icon name={editingTemplateId ? "check" : "plus"} size={14} /> {editingTemplateId ? "Salvar alterações" : "Criar template"}
          </button>
        </div>
      </Modal>

      {/* NOVA / EDITAR TAREFA */}
      <Modal open={showTarefaModal} onClose={() => { setShowTarefaModal(false); setEditingTarefaId(null); }} title={editingTarefaId ? "Editar tarefa" : "Nova tarefa"}>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Título <span className="text-rose-400">*</span></label>
            <input value={tarefaForm.titulo} onChange={(e) => setTarefaForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Ex: Ligar para o cliente X"
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Descrição</label>
            <textarea value={tarefaForm.descricao} onChange={(e) => setTarefaForm((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Detalhes da tarefa..." rows={3}
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm resize-none" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Responsável</label>
            <input value={tarefaForm.responsavel} onChange={(e) => setTarefaForm((p) => ({ ...p, responsavel: e.target.value }))}
              placeholder="Nome do responsável (deixe em branco para “Sem responsável”)"
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Prioridade <span className="text-rose-400">*</span></label>
              <select value={tarefaForm.prioridade} onChange={(e) => setTarefaForm((p) => ({ ...p, prioridade: e.target.value }))}
                className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm">
                {TAREFA_PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Status <span className="text-rose-400">*</span></label>
              <select value={tarefaForm.status} onChange={(e) => setTarefaForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm">
                {TAREFA_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Data de vencimento</label>
            <input type="date" value={tarefaForm.data_vencimento} onChange={(e) => setTarefaForm((p) => ({ ...p, data_vencimento: e.target.value }))}
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1.5">Observações</label>
            <textarea value={tarefaForm.observacoes} onChange={(e) => setTarefaForm((p) => ({ ...p, observacoes: e.target.value }))}
              placeholder="Anotações adicionais..." rows={2}
              className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm resize-none" />
          </div>
          <button onClick={handleSalvarTarefa} disabled={!tarefaForm.titulo.trim() || tarefaSaving}
            className="w-full py-2.5 tech-button rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <Icon name={editingTarefaId ? "check" : "plus"} size={14} /> {tarefaSaving ? "Salvando…" : (editingTarefaId ? "Salvar alterações" : "Criar tarefa")}
          </button>
        </div>
      </Modal>

      {/* VISUALIZAR TAREFA */}
      <Modal open={!!tarefaView} onClose={() => setTarefaView(null)} title={tarefaView?.titulo || "Tarefa"}>
        {tarefaView && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={tarefaPrioridadeInfo(tarefaView.prioridade).color}>Prioridade: {tarefaPrioridadeInfo(tarefaView.prioridade).label}</Badge>
              <Badge color={tarefaStatusInfo(tarefaView.status).color}>{tarefaStatusInfo(tarefaView.status).label}</Badge>
              {tarefaView.vencida && <Badge color="rose">Vencida</Badge>}
            </div>
            {tarefaView.descricao && (
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Descrição</div>
                <p className="text-slate-200 text-sm whitespace-pre-line">{tarefaView.descricao}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Responsável</div>
                <div className="text-slate-200">{tarefaView.responsavel || "Sem responsável"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Vencimento</div>
                <div className={tarefaView.vencida ? "text-rose-400" : "text-slate-200"}>{fmtData(tarefaView.data_vencimento)}</div>
              </div>
            </div>
            {tarefaView.observacoes && (
              <div>
                <div className="text-slate-500 text-xs uppercase tracking-[0.14em] mb-1">Observações</div>
                <p className="text-slate-200 text-sm whitespace-pre-line">{tarefaView.observacoes}</p>
              </div>
            )}
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Alterar status</label>
              <select value={tarefaView.status} onChange={(e) => handleMudarStatusTarefa(tarefaView, e.target.value)}
                className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm">
                {TAREFA_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => openEditarTarefa(tarefaView)}
                className="flex-1 py-2.5 tech-button rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
                <Icon name="edit" size={14} /> Editar
              </button>
              <button onClick={() => handleArquivarTarefa(tarefaView)}
                className="px-4 py-2.5 rounded-xl border border-rose-400/40 text-rose-300 text-sm hover:bg-rose-400/10 transition-colors flex items-center gap-2">
                <Icon name="trash" size={14} /> Arquivar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* SALVAR DECISOR COMO CONTATO */}
      <Modal open={!!contatoForm} onClose={() => setContatoForm(null)} title="Salvar decisor como contato">
        {contatoForm && (
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Empresa</label>
              <select value={contatoForm.empresa_id} onChange={e => setContatoForm(p => ({ ...p, empresa_id: e.target.value }))}
                className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm">
                <option value="">Selecione a empresa…</option>
                {Array.from(new Map(decisores.map(d => [d.empresa_id, d.empresa_nome])).entries())
                  .sort((a, b) => (a[1] || "").localeCompare(b[1] || ""))
                  .map(([id, nome]) => (<option key={id} value={id}>{nome}</option>))}
              </select>
              {!contatoForm.empresa_id && <p className="text-slate-600 text-[11px] mt-1">O contato é vinculado a uma empresa cadastrada.</p>}
            </div>
            {[
              { label: "Nome", key: "nome", ph: "Nome da pessoa" },
              { label: "Cargo", key: "cargo", ph: "Diretor, sócio, fundador..." },
              { label: "E-mail", key: "email", ph: "email@empresa.com" },
              { label: "Telefone", key: "telefone", ph: "(11) 0000-0000" },
              { label: "WhatsApp", key: "whatsapp", ph: "(11) 90000-0000" },
              { label: "LinkedIn", key: "linkedin", ph: "https://linkedin.com/in/..." },
            ].map(({ label, key, ph }) => (
              <div key={key}>
                <label className="text-slate-400 text-sm block mb-1.5">{label}</label>
                <input value={contatoForm[key] || ""} onChange={e => setContatoForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={ph} className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm" />
              </div>
            ))}
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Notas</label>
              <textarea value={contatoForm.notas || ""} onChange={e => setContatoForm(p => ({ ...p, notas: e.target.value }))}
                rows={3} className="w-full tech-input rounded-xl px-3 py-2 text-white text-sm resize-none" />
            </div>
            <button onClick={handleSalvarContato} disabled={!contatoForm.nome?.trim() || !contatoForm.empresa_id}
              className="w-full py-2.5 tech-button rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              <Icon name="check" size={14} /> Salvar contato
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
