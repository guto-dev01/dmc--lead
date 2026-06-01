"use client";

import { useState, useEffect, useCallback } from "react";
import DMCPlatform, { DMC_NAV } from "./dmc/DMCPlatform";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? window.ENV_API_URL : undefined) ||
  "http://localhost:8001";

const TOKEN_KEY = "imobpro_token";

const getStoredToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
};

const setStoredToken = (token) => {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
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

const LoginScreen = ({ username, password, setUsername, setPassword, onSubmit, loading, error }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(0,231,252,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(0,255,77,0.12),_transparent_28%),linear-gradient(180deg,#020608_0%,#071418_100%)]">
    <div className="w-full max-w-md rounded-[28px] border border-white/8 bg-[#061215]/90 shadow-[0_30px_120px_rgba(0,0,0,0.55)] overflow-hidden backdrop-blur-xl">
      <div className="p-8 border-b border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00e7fc] to-[#00ff4d] flex items-center justify-center text-[#06262b] shadow-[0_0_24px_rgba(0,231,252,0.35)]">
            <Icon name="lock" size={20} />
          </div>
          <div>
            <h1 className="text-[#00ff6a] font-extrabold tracking-[0.35em] text-sm leading-none">IMOBPRO</h1>
            <p className="text-slate-500 text-xs mt-1">Acesso restrito ao sistema</p>
          </div>
        </div>
        <h2 className="text-white text-2xl font-semibold">Entrar no painel</h2>
        <p className="text-slate-400 text-sm mt-2">Use seu usuário e senha para acessar as empresas, mercado e WhatsApp.</p>
      </div>
      <form onSubmit={onSubmit} className="p-8 space-y-4">
        <div>
          <label className="text-slate-400 text-sm block mb-1.5">Usuário</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full tech-input rounded-xl px-4 py-3 text-white text-sm"
            placeholder="admin"
          />
        </div>
        <div>
          <label className="text-slate-400 text-sm block mb-1.5">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full tech-input rounded-xl px-4 py-3 text-white text-sm"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00e7fc] to-[#00ff4d] !text-[#06262b] font-bold disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Acessar sistema"}
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          Configure as credenciais em <span className="text-slate-300">ADMIN_USERNAME</span> e <span className="text-slate-300">ADMIN_PASSWORD</span>.
        </p>
      </form>
    </div>
  </div>
);

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
  const [numero, setNumero] = useState(empresa.whatsapp || empresa.telefone || "");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [discoveringWhatsApp, setDiscoveringWhatsApp] = useState(false);
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
      setNumero(novoNumero);
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

  const handleSendWA = async () => {
    if (!numero || !msg) return;
    setLoading(true);
    try {
      await api("/api/whatsapp/enviar", {
        method: "POST",
        body: JSON.stringify({ empresa_id: empresa.id, numero, mensagem: msg }),
      });
      alert("✅ Mensagem enviada!");
      setMsg("");
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
            <label className="text-slate-400 text-sm block mb-1.5">Número WhatsApp</label>
            <input
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full bg-white/5 border border-[#00e7fc]/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Se o número vier do site, ele já entra normalizado para uso no envio.
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
          <button onClick={handleSendWA} disabled={loading || !numero || !msg}
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
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  const [marketSummary, setMarketSummary] = useState(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [loading, setLoading] = useState(false);
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
  // Inbox / espelho WhatsApp
  const [convList, setConvList] = useState([]);
  const [convActive, setConvActive] = useState(null);
  const [convMsgs, setConvMsgs] = useState([]);
  const [convInput, setConvInput] = useState("");
  const [convSending, setConvSending] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [newEmpresa, setNewEmpresa] = useState({ nome: "", tipo: "incorporadora", bairro: "", cnpj: "" });
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ nome: "", categoria: "", conteudo: "" });
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [enriching, setEnriching] = useState(false);

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
  }, []);

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
      const data = await api("/api/whatsapp/status");
      setWaStatus(data);
      return data;
    } catch (e) {
      setWaStatus({ state: "error" });
      return null;
    }
  }, []);

  const loadQR = useCallback(async () => {
    setWaLoadingQR(true);
    try {
      // garante que a instância existe antes de pedir o QR
      await api("/api/whatsapp/instancia", { method: "POST" }).catch(() => {});
      const data = await api("/api/whatsapp/qrcode");
      const b64 = data?.base64 || data?.qrcode?.base64 || null;
      setWaQR(b64 ? (b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`) : null);
    } catch (e) {
      setWaQR(null);
    } finally {
      setWaLoadingQR(false);
    }
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const data = await api("/api/whatsapp/inbox");
      setConvList(Array.isArray(data) ? data : []);
    } catch (e) {}
  }, []);

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
    if (page === "templates") loadTemplates();
    if (page === "campanhas") { loadCampanhas(); loadTemplates(); }
    if (page === "mercado") loadMarket();
    if (page === "conversas") loadInbox();
  }, [isAuthed, page, loadEmpresas, loadTemplates, loadCampanhas, loadMarket, loadInbox]);

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
  }, [isAuthed, page, checkWA, loadQR, waQR, waLoadingQR]);

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

  const handleAddTemplate = async () => {
    try {
      await api("/api/templates", { method: "POST", body: JSON.stringify(newTemplate) });
      setShowTemplateModal(false);
      setNewTemplate({ nome: "", categoria: "", conteudo: "" });
      loadTemplates();
    } catch (e) {
      alert("Erro: " + e.message);
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
    return (
      <LoginScreen
        username={loginUsername}
        password={loginPassword}
        setUsername={setLoginUsername}
        setPassword={setLoginPassword}
        onSubmit={handleLogin}
        loading={loginLoading}
        error={loginError}
      />
    );
  }

  const navItems = [
    { id: "dashboard", icon: "home", label: "Dashboard" },
    { id: "empresas", icon: "building", label: "Empresas" },
    { id: "mercado", icon: "map", label: "Mercado" },
    { id: "campanhas", icon: "megaphone", label: "Campanhas" },
    { id: "templates", icon: "file", label: "Templates" },
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
            <h2 className="text-white font-semibold text-sm tracking-wide">{page === "dashboard" ? "Dashboard" : page === "empresas" ? "Empresas" : page === "mercado" ? "Mercado" : page === "campanhas" ? "Campanhas" : page === "templates" ? "Templates" : page === "conversas" ? "Conversas" : page === "whatsapp" ? "WhatsApp" : "Complexo DMC"}</h2>
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

          {/* CONVERSAS (espelho do WhatsApp) */}
          {page === "conversas" && (
            <div className="flex gap-4 h-[calc(100vh-180px)]">
              {/* Lista de conversas */}
              <div className="w-80 flex-shrink-0 surface-strong rounded-2xl flex flex-col overflow-hidden">
                <div className="p-3 border-b border-white/5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={14} /></span>
                    <input value={convSearch} onChange={e => setConvSearch(e.target.value)}
                      placeholder="Buscar conversa..." className="tech-input w-full rounded-full pl-9 pr-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {convList.filter(c => {
                    const q = convSearch.toLowerCase().trim();
                    return !q || (c.nome_exibicao || "").toLowerCase().includes(q) || (c.numero_whatsapp || "").includes(q);
                  }).map(c => (
                    <button key={c.id} onClick={() => openConversa(c)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${convActive?.id === c.id ? "bg-white/8" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
                          <Icon name="whatsapp" size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-white text-sm font-medium truncate">{c.nome_exibicao || c.numero_whatsapp}</span>
                            {c.nao_lidas > 0 && (
                              <span className="bg-emerald-500 text-[#052226] text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{c.nao_lidas}</span>
                            )}
                          </div>
                          <p className="text-slate-400 text-xs truncate">
                            {c.ultima_direcao === "outbound" ? "Você: " : ""}{c.ultima_mensagem || "—"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {convList.length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-sm">Nenhuma conversa ainda.<br />Elas aparecem aqui quando o robô envia ou recebe mensagens.</div>
                  )}
                </div>
              </div>

              {/* Thread de mensagens */}
              <div className="flex-1 surface-strong rounded-2xl flex flex-col overflow-hidden">
                {convActive ? (
                  <>
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center"><Icon name="whatsapp" size={16} /></div>
                      <div className="min-w-0">
                        <div className="text-white text-sm font-semibold truncate">{convActive.nome_exibicao || convActive.numero_whatsapp}</div>
                        <div className="text-slate-500 text-xs truncate">+{convActive.numero_whatsapp}{convActive.empresa_nome ? ` · ${convActive.empresa_nome}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-2 bg-black/15">
                      {convMsgs.map(m => (
                        <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-emerald-600/30 text-emerald-50 rounded-br-sm" : "bg-white/8 text-slate-100 rounded-bl-sm"}`}>
                            <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                            <div className="text-[10px] text-slate-400 mt-1 text-right">
                              {m.created_at ? new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                      {convMsgs.length === 0 && <div className="text-center text-slate-500 text-sm py-10">Sem mensagens nesta conversa</div>}
                    </div>
                    <div className="p-3 border-t border-white/5 flex items-center gap-2">
                      <input value={convInput} onChange={e => setConvInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        placeholder={waConnected ? "Digite uma mensagem..." : "Conecte o WhatsApp para enviar"}
                        disabled={!waConnected || convSending}
                        className="tech-input flex-1 rounded-full px-4 py-2.5 text-sm disabled:opacity-50" />
                      <button onClick={sendReply} disabled={!waConnected || convSending || !convInput.trim()}
                        className="tech-button rounded-full p-3 disabled:opacity-40"><Icon name="send" size={16} /></button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
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
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="CLIENTES" value={stats.stats.total_empresas} icon="building" accent="#12e7ff" sub="base cadastrada" />
                <StatCard label="DILIGÊNCIAS" value={stats.stats.com_cnpj} icon="check" accent="#00ff6a" sub="enriquecidas" />
                <StatCard label="PROCESSOS" value={stats.stats.total_conversas} icon="file" accent="#8b5cf6" sub="fluxos ativos" />
                <StatCard label="MINUTAS" value={stats.stats.msgs_hoje} icon="document" accent="#f59e0b" sub={`${stats.stats.total_mensagens} total`} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Por tipo */}
                <div className="surface-strong rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Icon name="chart" size={16} />
                    Prazo
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl bg-white/3 border border-white/5 p-4 text-slate-300">Nenhum prazo crítico no momento</div>
                    <div className="rounded-xl bg-white/3 border border-white/5 p-4 text-slate-400">Agenda e alertas podem ser ligados depois</div>
                  </div>
                </div>

                {/* Recentes */}
                <div className="xl:col-span-2 surface-strong rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Icon name="building" size={16} />
                    Empresas Recentes
                  </h3>
                  <div className="space-y-2">
                    {stats.recentes.map(e => (
                      <div key={e.nome} className="flex items-center justify-between py-2.5 border-b border-[#00e7fc]/8 last:border-0">
                        <div>
                          <p className="text-white text-sm font-medium">{e.nome}</p>
                          <p className="text-slate-500 text-xs">{e.bairro} · {e.tipo}</p>
                        </div>
                        {e.msgs > 0 && (
                          <Badge color="emerald">{e.msgs} msgs</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Atividades */}
              {stats.atividades?.length > 0 && (
                <div className="surface-strong rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4">Atividades Recentes</h3>
                  <div className="space-y-2">
                    {stats.atividades.map(a => (
                      <div key={a.id} className="flex items-center gap-3 py-2 border-b border-[#00e7fc]/8 last:border-0">
                        <div className="w-2 h-2 rounded-full bg-[#00ff4d] flex-shrink-0" />
                        <span className="text-slate-300 text-sm">{a.empresa_nome}</span>
                        <span className="text-slate-500 text-sm">·</span>
                        <span className="text-slate-400 text-sm">{a.descricao}</span>
                        <span className="ml-auto text-slate-600 text-xs">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(t => (
                <div key={t.id} className="surface-strong rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold">{t.nome}</h3>
                      {t.categoria && <Badge color="sky">{t.categoria}</Badge>}
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
          )}

          {/* CAMPANHAS */}
          {page === "campanhas" && (
            <div className="space-y-4">
              {campanhas.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
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
                    <Badge color={
                      c.status === "concluida" ? "emerald" :
                      c.status === "em_andamento" ? "amber" :
                      c.status === "rascunho" ? "slate" : "sky"
                    }>{c.status}</Badge>
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
                      {waConnected ? "Pronto para enviar mensagens" : "Escaneie o QR Code para conectar"}
                    </p>
                  </div>
                </div>
              </div>

              {!waConnected && (
                <div className="surface-strong rounded-2xl p-6 text-center">
                  <p className="text-slate-400 text-sm mb-4">
                    Abra o WhatsApp no celular → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e escaneie o código abaixo.
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

              <div className="surface-strong rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-3">Configurações</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-[#00e7fc]/8">
                    <span className="text-slate-500">Evolution API URL</span>
                    <span className="text-slate-300">http://evolution:8080</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Instância</span>
                    <span className="text-slate-300">imobpro</span>
                  </div>
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
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="Novo Template">
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
          <button onClick={handleAddTemplate} disabled={!newTemplate.nome || !newTemplate.conteudo}
            className="w-full py-2.5 tech-button rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <Icon name="plus" size={14} /> Criar template
          </button>
        </div>
      </Modal>
    </div>
  );
}
