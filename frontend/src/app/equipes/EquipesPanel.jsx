"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Users2, Plus, Pencil, X, Search, Mail, Phone,
  Trophy, BarChart3, TrendingUp, CheckCircle2, Power, Crown, Activity, Clock,
  History, Building2, Megaphone, MessageCircle, FileText, Map, ShieldCheck,
} from "lucide-react";

// Abas do módulo (sub-navegação interna, no padrão do DMC)
export const EQUIPES_NAV = [
  { key: "geral", label: "Visão Geral" },
  { key: "desempenho", label: "Desempenho" },
  { key: "colaboradores", label: "Colaboradores" },
  { key: "equipes", label: "Equipes" },
];

const FUNCAO_META = {
  dono: { label: "Dono", color: "#f59e0b", Icon: Crown },
  prospector: { label: "Prospector", color: "#12e7ff", Icon: Search },
  vendedor: { label: "Vendedor", color: "#00ff6a", Icon: TrendingUp },
  atendente: { label: "Atendente", color: "#a78bfa", Icon: Phone },
  auxiliar: { label: "Auxiliar do Sistema", color: "#94a3b8", Icon: Activity },
};
const FUNCOES = ["dono", "prospector", "vendedor", "atendente", "auxiliar"];
// Funções do TIME (sem "dono"): o gestor não é cadastrado nem medido como
// colaborador — esta tela é para gerir e acompanhar as pessoas do time.
const FUNCOES_TIME = FUNCOES.filter((f) => f !== "dono");

const fmtNum = (n) => (n ?? 0).toLocaleString("pt-BR");
const fmtDT = (v) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};
const fmtData = (v) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return "—"; }
};

const PERIODOS = [
  { key: "tudo", label: "Tudo" },
  { key: "mes", label: "30 dias" },
  { key: "semana", label: "7 dias" },
  { key: "hoje", label: "Hoje" },
];

// ---------- primitivos visuais ----------
const Card = ({ children, className = "" }) => (
  <div className={`surface-strong rounded-2xl p-5 ${className}`}>{children}</div>
);

const Stat = ({ label, value, sub, accent = "#12e7ff", Icon }) => (
  <div className="relative overflow-hidden rounded-2xl surface-strong p-5 group">
    <div className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl opacity-10"
      style={{ background: accent, transform: "translate(40%, -40%)" }} />
    <div className="flex items-start justify-between mb-3">
      <span className="text-slate-400 text-sm font-medium">{label}</span>
      {Icon && <div className="p-2 rounded-xl" style={{ background: `${accent}22`, color: accent }}><Icon size={16} /></div>}
    </div>
    <p className="text-3xl font-bold text-white tracking-tight">{value ?? "—"}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

const FuncaoBadge = ({ funcao }) => {
  const m = FUNCAO_META[funcao] || FUNCAO_META.auxiliar;
  const I = m.Icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
      style={{ background: `${m.color}1f`, color: m.color }}>
      <I size={12} /> {m.label}
    </span>
  );
};

const StatusDot = ({ status }) => {
  const map = {
    aprovado: ["#00ff6a", "Ativo"], ativa: ["#00ff6a", "Ativa"],
    inativo: ["#94a3b8", "Inativo"], inativa: ["#94a3b8", "Inativa"],
    pendente: ["#f59e0b", "Pendente"], externo: ["#64748b", "Externo"],
  };
  const [c, t] = map[status] || ["#64748b", status || "—"];
  return <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} /> {t}</span>;
};

const Modal = ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-lg surface-strong rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X size={18} /></button>
      </div>
      {children}
      {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[0.8rem] font-medium text-slate-300">{label}</label>
    {children}
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-2 border-[#12e7ff] border-t-transparent rounded-full animate-spin" />
  </div>
);

// Barra de ranking proporcional
const RankBar = ({ nome, valor, max, accent = "#12e7ff", right }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-200 truncate">{nome}</span>
        <span className="text-sm font-semibold text-white ml-3">{right ?? fmtNum(valor)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.max(4, (valor / max) * 100) : 0}%`, background: accent }} />
      </div>
    </div>
  </div>
);

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================
export default function EquipesPanel({ api, currentUser }) {
  const [aba, setAba] = useState("geral");
  const [periodo, setPeriodo] = useState("mes");

  const [dashboard, setDashboard] = useState(null);
  const [desempenho, setDesempenho] = useState(null);
  const [equipes, setEquipes] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [tipos, setTipos] = useState({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  // filtros colaboradores
  const [colBusca, setColBusca] = useState("");
  const [colFuncao, setColFuncao] = useState("");

  // modais
  const [equipeForm, setEquipeForm] = useState(null);   // {id?, nome, descricao, responsavel, status}
  const [colabForm, setColabForm] = useState(null);     // {id?, nome, email, telefone, funcao, equipe_id}
  const [perfil, setPerfil] = useState(null);           // dados do perfil aberto
  const [salvando, setSalvando] = useState(false);

  const flash = (setter, msg) => { setter(msg); setTimeout(() => setter(""), 4000); };

  // ---------- carregadores ----------
  const loadGeral = useCallback(async () => {
    setLoading(true); setErro("");
    try {
      const [d, dp] = await Promise.all([
        api("/api/equipes/dashboard"),
        api(`/api/equipes/desempenho?periodo=${periodo}`),
      ]);
      setDashboard(d);
      setDesempenho(dp); setTipos(dp.tipos || {});
    } catch (e) { setErro(e.message || "Falha ao carregar."); }
    finally { setLoading(false); }
  }, [api, periodo]);

  const loadDesempenho = useCallback(async () => {
    setLoading(true); setErro("");
    try {
      const dp = await api(`/api/equipes/desempenho?periodo=${periodo}`);
      setDesempenho(dp); setTipos(dp.tipos || {});
    } catch (e) { setErro(e.message || "Falha ao carregar."); }
    finally { setLoading(false); }
  }, [api, periodo]);

  const loadEquipes = useCallback(async () => {
    setLoading(true); setErro("");
    try { const d = await api("/api/equipes"); setEquipes(d.items || []); }
    catch (e) { setErro(e.message || "Falha ao carregar."); }
    finally { setLoading(false); }
  }, [api]);

  const loadColaboradores = useCallback(async () => {
    setLoading(true); setErro("");
    try {
      const params = new URLSearchParams({ periodo });
      if (colBusca) params.set("busca", colBusca);
      if (colFuncao) params.set("funcao", colFuncao);
      const d = await api(`/api/equipes/colaboradores?${params}`);
      setColaboradores(d.items || []); setTipos(d.tipos || {});
    } catch (e) { setErro(e.message || "Falha ao carregar."); }
    finally { setLoading(false); }
  }, [api, periodo, colBusca, colFuncao]);

  // garante a lista de equipes p/ os selects dos formulários
  const ensureEquipes = useCallback(async () => {
    if (equipes.length) return;
    try { const d = await api("/api/equipes"); setEquipes(d.items || []); } catch {}
  }, [api, equipes.length]);

  useEffect(() => {
    if (aba === "geral") loadGeral();
    if (aba === "desempenho") loadDesempenho();
    if (aba === "equipes") loadEquipes();
    if (aba === "colaboradores") { loadColaboradores(); ensureEquipes(); }
  }, [aba, loadGeral, loadDesempenho, loadEquipes, loadColaboradores, ensureEquipes]);

  // debounce na busca de colaboradores
  useEffect(() => {
    if (aba !== "colaboradores") return;
    const t = setTimeout(loadColaboradores, 300);
    return () => clearTimeout(t);
  }, [aba, colBusca, colFuncao, periodo, loadColaboradores]);

  // ---------- ações ----------
  const salvarEquipe = async () => {
    setSalvando(true); setErro("");
    try {
      const body = JSON.stringify({
        nome: equipeForm.nome, descricao: equipeForm.descricao,
        responsavel: equipeForm.responsavel, status: equipeForm.status || "ativa",
      });
      if (equipeForm.id) await api(`/api/equipes/${equipeForm.id}`, { method: "PATCH", body });
      else await api("/api/equipes", { method: "POST", body });
      setEquipeForm(null); flash(setOk, "Equipe salva.");
      await loadEquipes();
    } catch (e) { setErro(e.message || "Não foi possível salvar a equipe."); }
    finally { setSalvando(false); }
  };

  const toggleEquipe = async (eq) => {
    try {
      await api(`/api/equipes/${eq.id}`, { method: "PATCH", body: JSON.stringify({ status: eq.status === "ativa" ? "inativa" : "ativa" }) });
      await loadEquipes();
    } catch (e) { flash(setErro, e.message); }
  };

  const salvarColab = async () => {
    setSalvando(true); setErro("");
    try {
      if (colabForm.id) {
        await api(`/api/equipes/colaboradores/${colabForm.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            nome: colabForm.nome, telefone: colabForm.telefone,
            funcao: colabForm.funcao, equipe_id: colabForm.equipe_id || null,
          }),
        });
        flash(setOk, "Colaborador atualizado.");
      } else {
        const r = await api("/api/equipes/colaboradores", {
          method: "POST",
          body: JSON.stringify({
            nome: colabForm.nome, email: colabForm.email, telefone: colabForm.telefone,
            funcao: colabForm.funcao, equipe_id: colabForm.equipe_id || null,
          }),
        });
        flash(setOk, r.message || "Colaborador cadastrado.");
      }
      setColabForm(null);
      await loadColaboradores();
    } catch (e) { setErro(e.message || "Não foi possível salvar o colaborador."); }
    finally { setSalvando(false); }
  };

  const toggleColab = async (c) => {
    try {
      await api(`/api/equipes/colaboradores/${c.id}`, { method: "PATCH", body: JSON.stringify({ status: c.status === "aprovado" ? "inativo" : "aprovado" }) });
      await loadColaboradores();
    } catch (e) { flash(setErro, e.message); }
  };

  const abrirPerfil = async (id) => {
    setPerfil({ loading: true });
    try { const d = await api(`/api/equipes/colaboradores/${id}?periodo=${periodo}`); setPerfil(d); }
    catch (e) { setPerfil(null); flash(setErro, e.message); }
  };

  const nomeEquipe = (id) => equipes.find((e) => e.id === id)?.nome || "—";

  // ============================================================
  return (
    <div className="space-y-5">
      {/* Cabeçalho + sub-abas + período */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users2 size={22} className="text-[#12e7ff]" /> Equipes &amp; Colaboradores
          </h1>
          <p className="text-slate-400 text-sm mt-1">Organize o time e acompanhe a produtividade real do sistema.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {EQUIPES_NAV.map((n) => (
              <button key={n.key} onClick={() => setAba(n.key)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${aba === n.key ? "bg-[#0c3135] text-[#12e7ff] border border-[#12e7ff]/25" : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"}`}>
                {n.label}
              </button>
            ))}
          </div>
          {aba !== "equipes" && (
            <div className="flex gap-1 p-1 rounded-xl bg-black/30 border border-white/5">
              {PERIODOS.map((p) => (
                <button key={p.key} onClick={() => setPeriodo(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodo === p.key ? "bg-[#12e7ff]/15 text-[#12e7ff]" : "text-slate-400 hover:text-white"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {erro && <div className="px-4 py-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/25 text-rose-300 text-sm">{erro}</div>}
      {ok && <div className="px-4 py-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/25 text-emerald-300 text-sm">{ok}</div>}

      {loading ? <Spinner /> : (
        <>
          {aba === "geral" && <VisaoGeral dashboard={dashboard} desempenho={desempenho} tipos={tipos} />}
          {aba === "desempenho" && <Desempenho desempenho={desempenho} tipos={tipos} onPerfil={abrirPerfil} />}
          {aba === "colaboradores" && (
            <Colaboradores
              itens={colaboradores} tipos={tipos}
              busca={colBusca} setBusca={setColBusca} funcao={colFuncao} setFuncao={setColFuncao}
              onNovo={() => { ensureEquipes(); setColabForm({ nome: "", email: "", telefone: "", funcao: "vendedor", equipe_id: "" }); }}
              onEditar={(c) => { ensureEquipes(); setColabForm({ id: c.id, nome: c.nome, email: c.email, telefone: c.telefone || "", funcao: c.funcao, equipe_id: c.equipe_id || "" }); }}
              onPerfil={abrirPerfil} onToggle={toggleColab} nomeEquipe={nomeEquipe}
            />
          )}
          {aba === "equipes" && (
            <Equipes
              itens={equipes}
              onNovo={() => setEquipeForm({ nome: "", descricao: "", responsavel: "", status: "ativa" })}
              onEditar={(e) => setEquipeForm({ id: e.id, nome: e.nome, descricao: e.descricao || "", responsavel: e.responsavel || "", status: e.status })}
              onToggle={toggleEquipe}
            />
          )}
        </>
      )}

      {/* Modal equipe */}
      {equipeForm && (
        <Modal title={equipeForm.id ? "Editar equipe" : "Nova equipe"} onClose={() => setEquipeForm(null)}
          footer={<>
            <button onClick={() => setEquipeForm(null)} className="px-4 h-10 rounded-xl text-sm text-slate-300 hover:bg-white/5">Cancelar</button>
            <button onClick={salvarEquipe} disabled={salvando || !equipeForm.nome.trim()} className="px-5 h-10 rounded-xl tech-button text-sm disabled:opacity-50">{salvando ? "Salvando..." : "Salvar"}</button>
          </>}>
          <div className="space-y-4">
            <Field label="Nome da equipe"><input className="h-11 px-3 rounded-xl tech-input" value={equipeForm.nome} onChange={(e) => setEquipeForm({ ...equipeForm, nome: e.target.value })} placeholder="Ex.: Prospecção SP" /></Field>
            <Field label="Descrição"><textarea className="px-3 py-2 rounded-xl tech-input min-h-[72px]" value={equipeForm.descricao} onChange={(e) => setEquipeForm({ ...equipeForm, descricao: e.target.value })} placeholder="Objetivo / escopo da equipe" /></Field>
            <Field label="Responsável"><input className="h-11 px-3 rounded-xl tech-input" value={equipeForm.responsavel} onChange={(e) => setEquipeForm({ ...equipeForm, responsavel: e.target.value })} placeholder="Nome ou e-mail do responsável" /></Field>
            <Field label="Status">
              <div className="flex gap-2">
                {["ativa", "inativa"].map((s) => (
                  <button key={s} onClick={() => setEquipeForm({ ...equipeForm, status: s })}
                    className={`flex-1 h-10 rounded-xl text-sm font-medium border ${equipeForm.status === s ? "border-[#12e7ff]/40 bg-[#12e7ff]/10 text-[#12e7ff]" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>
                    {s === "ativa" ? "Ativa" : "Inativa"}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Modal>
      )}

      {/* Modal colaborador */}
      {colabForm && (
        <Modal title={colabForm.id ? "Editar colaborador" : "Novo colaborador"} onClose={() => setColabForm(null)}
          footer={<>
            <button onClick={() => setColabForm(null)} className="px-4 h-10 rounded-xl text-sm text-slate-300 hover:bg-white/5">Cancelar</button>
            <button onClick={salvarColab} disabled={salvando || !colabForm.nome.trim() || (!colabForm.id && !colabForm.email.trim())} className="px-5 h-10 rounded-xl tech-button text-sm disabled:opacity-50">{salvando ? "Salvando..." : (colabForm.id ? "Salvar" : "Cadastrar e convidar")}</button>
          </>}>
          <div className="space-y-4">
            <Field label="Nome"><input className="h-11 px-3 rounded-xl tech-input" value={colabForm.nome} onChange={(e) => setColabForm({ ...colabForm, nome: e.target.value })} placeholder="Nome completo" /></Field>
            <Field label="E-mail">
              <input className="h-11 px-3 rounded-xl tech-input disabled:opacity-60" value={colabForm.email} disabled={!!colabForm.id}
                onChange={(e) => setColabForm({ ...colabForm, email: e.target.value })} placeholder="email@empresa.com" />
            </Field>
            {!colabForm.id && <p className="-mt-2 text-[11px] text-slate-500">A pessoa receberá um e-mail para definir a própria senha e ativar o acesso.</p>}
            <Field label="Telefone"><input className="h-11 px-3 rounded-xl tech-input" value={colabForm.telefone} onChange={(e) => setColabForm({ ...colabForm, telefone: e.target.value })} placeholder="(opcional)" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Função">
                <select className="h-11 px-3 rounded-xl tech-input" value={colabForm.funcao} onChange={(e) => setColabForm({ ...colabForm, funcao: e.target.value })}>
                  {FUNCOES_TIME.map((f) => <option key={f} value={f}>{FUNCAO_META[f].label}</option>)}
                </select>
              </Field>
              <Field label="Equipe">
                <select className="h-11 px-3 rounded-xl tech-input" value={colabForm.equipe_id || ""} onChange={(e) => setColabForm({ ...colabForm, equipe_id: e.target.value })}>
                  <option value="">Sem equipe</option>
                  {equipes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {/* Perfil do colaborador */}
      {perfil && (
        <Modal title="Perfil do colaborador" onClose={() => setPerfil(null)}>
          {perfil.loading ? <Spinner /> : <PerfilColab api={api} data={perfil} tipos={perfil.tipos || tipos} />}
        </Modal>
      )}
    </div>
  );
}

// ---------- Visão Geral ----------
function VisaoGeral({ dashboard, desempenho, tipos }) {
  if (!dashboard) return null;
  const pf = dashboard.por_funcao || {};
  const topColab = (desempenho?.colaboradores || []).filter((c) => c.total > 0).slice(0, 5);
  const topEquipe = (desempenho?.equipes || []).filter((e) => e.total > 0).slice(0, 5);
  const maxC = Math.max(1, ...topColab.map((c) => c.total));
  const maxE = Math.max(1, ...topEquipe.map((e) => e.total));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Equipes" value={fmtNum(dashboard.total_equipes)} sub={`${fmtNum(dashboard.equipes_ativas)} ativas`} Icon={Users2} accent="#12e7ff" />
        <Stat label="Colaboradores" value={fmtNum(dashboard.total_colaboradores)} sub="no time" Icon={Users} accent="#00ff6a" />
        <Stat label="Ações do time" value={fmtNum((desempenho?.colaboradores || []).reduce((s, c) => s + c.total, 0))} sub="eventos reais" Icon={Activity} accent="#f59e0b" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FUNCOES_TIME.map((f) => {
          const m = FUNCAO_META[f]; const I = m.Icon;
          return (
            <Card key={f} className="!p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs"><span style={{ color: m.color }}><I size={15} /></span>{m.label}</div>
              <p className="text-2xl font-bold text-white mt-2">{fmtNum(pf[f])}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Trophy size={16} className="text-amber-400" /> Top colaboradores</h3>
          {topColab.length ? <div className="space-y-3">{topColab.map((c) => <RankBar key={c.email} nome={c.nome} valor={c.total} max={maxC} accent={FUNCAO_META[c.funcao]?.color || "#12e7ff"} />)}</div>
            : <p className="text-slate-500 text-sm">Sem produção registrada no período.</p>}
        </Card>
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-[#12e7ff]" /> Top equipes</h3>
          {topEquipe.length ? <div className="space-y-3">{topEquipe.map((e) => <RankBar key={e.id} nome={e.nome} valor={e.total} max={maxE} accent="#00ff6a" />)}</div>
            : <p className="text-slate-500 text-sm">Nenhuma equipe com produção no período.</p>}
        </Card>
      </div>

      <Card>
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-[#00ff6a]" /> Evolução diária (14 dias)</h3>
        <EvolucaoChart serie={desempenho?.evolucao || []} />
      </Card>
    </div>
  );
}

function EvolucaoChart({ serie }) {
  const max = Math.max(1, ...serie.map((s) => s.total));
  return (
    <div className="flex items-end gap-1.5 h-32">
      {serie.map((s) => (
        <div key={s.data} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="w-full rounded-t bg-gradient-to-t from-[#12e7ff]/40 to-[#00ff6a]/60 relative" style={{ height: `${(s.total / max) * 100}%`, minHeight: s.total ? 4 : 0 }}>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100">{s.total}</span>
          </div>
          <span className="text-[9px] text-slate-600">{s.data.slice(8)}/{s.data.slice(5, 7)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Desempenho ----------
function Desempenho({ desempenho, tipos, onPerfil }) {
  if (!desempenho) return null;
  const colab = desempenho.colaboradores || [];
  const eqs = desempenho.equipes || [];
  const maxC = Math.max(1, ...colab.map((c) => c.total));
  const maxE = Math.max(1, ...eqs.map((e) => e.total));
  const tipoKeys = Object.keys(tipos || {});

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Trophy size={16} className="text-amber-400" /> Ranking de colaboradores</h3>
        {colab.length ? (
          <div className="space-y-3">
            {colab.map((c, i) => (
              <div key={c.email} className="flex items-center gap-3">
                <span className={`w-6 text-center text-sm font-bold ${i < 3 ? "text-amber-400" : "text-slate-600"}`}>{i + 1}</span>
                <button onClick={() => c.id && onPerfil(c.id)} className="flex-1 text-left">
                  <RankBar nome={`${c.nome}`} valor={c.total} max={maxC} accent={FUNCAO_META[c.funcao]?.color || "#12e7ff"} />
                </button>
              </div>
            ))}
          </div>
        ) : <p className="text-slate-500 text-sm">Sem produção atribuída no período.</p>}
      </Card>

      <Card>
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-[#12e7ff]" /> Comparativo entre equipes</h3>
        {eqs.length ? <div className="space-y-3">{eqs.map((e) => <RankBar key={e.id} nome={`${e.nome} · ${e.membros} membro(s)`} valor={e.total} max={maxE} accent="#00ff6a" />)}</div>
          : <p className="text-slate-500 text-sm">Nenhuma equipe cadastrada.</p>}
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="text-white font-semibold mb-4">Produção por colaborador e tipo de ação</h3>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th className="text-left py-2 pr-3">Colaborador</th>
              <th className="text-left py-2 px-2">Função</th>
              {tipoKeys.map((t) => <th key={t} className="text-center py-2 px-1" title={tipos[t]}>{tipos[t].split(" ")[0]}</th>)}
              <th className="text-right py-2 pl-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {colab.map((c) => (
              <tr key={c.email} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2.5 pr-3">
                  <button onClick={() => c.id && onPerfil(c.id)} className="text-slate-200 hover:text-[#12e7ff] text-left">{c.nome}</button>
                  <div className="text-[11px] text-slate-500">{c.equipe_nome || "Sem equipe"}</div>
                </td>
                <td className="px-2"><FuncaoBadge funcao={c.funcao} /></td>
                {tipoKeys.map((t) => <td key={t} className="text-center px-1 text-slate-300">{c.por_tipo?.[t] || <span className="text-slate-700">0</span>}</td>)}
                <td className="text-right pl-3 font-semibold text-white">{fmtNum(c.total)}</td>
              </tr>
            ))}
            {!colab.length && <tr><td colSpan={tipoKeys.length + 3} className="py-8 text-center text-slate-500">Sem dados no período.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Colaboradores (CRUD) ----------
function Colaboradores({ itens, tipos, busca, setBusca, funcao, setFuncao, onNovo, onEditar, onPerfil, onToggle, nomeEquipe }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="w-full h-11 pl-10 pr-3 rounded-xl tech-input" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className="h-11 px-3 rounded-xl tech-input" value={funcao} onChange={(e) => setFuncao(e.target.value)}>
          <option value="">Todas as funções</option>
          {FUNCOES_TIME.map((f) => <option key={f} value={f}>{FUNCAO_META[f].label}</option>)}
        </select>
        <button onClick={onNovo} className="h-11 px-4 rounded-xl tech-button text-sm inline-flex items-center gap-2"><UserPlus size={16} /> Novo colaborador</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {itens.map((c) => (
          <Card key={c.id} className="!p-4">
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => onPerfil(c.id)} className="text-left min-w-0">
                <p className="text-white font-semibold truncate">{c.nome}</p>
                <p className="text-[12px] text-slate-500 truncate flex items-center gap-1"><Mail size={11} />{c.email}</p>
              </button>
              <div className="flex gap-1">
                <button onClick={() => onEditar(c)} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><Pencil size={14} /></button>
                <button onClick={() => onToggle(c)} title={c.status === "aprovado" ? "Desativar" : "Ativar"} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><Power size={14} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <FuncaoBadge funcao={c.funcao} />
              <StatusDot status={c.status} />
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500">{c.equipe_nome || "Sem equipe"}</span>
              <span className="text-white font-semibold">{fmtNum(c.total)} <span className="text-slate-500 font-normal">ações</span></span>
            </div>
          </Card>
        ))}
        {!itens.length && <div className="col-span-full py-12 text-center text-slate-500">Nenhum colaborador encontrado.</div>}
      </div>
    </div>
  );
}

// ---------- Equipes (CRUD) ----------
function Equipes({ itens, onNovo, onEditar, onToggle }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onNovo} className="h-11 px-4 rounded-xl tech-button text-sm inline-flex items-center gap-2"><Plus size={16} /> Nova equipe</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {itens.map((e) => (
          <Card key={e.id} className="!p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{e.nome}</p>
                {e.descricao && <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{e.descricao}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEditar(e)} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><Pencil size={14} /></button>
                <button onClick={() => onToggle(e)} title={e.status === "ativa" ? "Desativar" : "Ativar"} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><Power size={14} /></button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <StatusDot status={e.status} />
              <span className="inline-flex items-center gap-1.5 text-slate-300"><Users size={12} /> {fmtNum(e.membros)} membro(s)</span>
            </div>
            {e.responsavel && <div className="mt-2 text-[12px] text-slate-500">Resp.: <span className="text-slate-300">{e.responsavel}</span></div>}
            <div className="mt-2 text-[11px] text-slate-600">Criada em {fmtData(e.created_at)}</div>
          </Card>
        ))}
        {!itens.length && <div className="col-span-full py-12 text-center text-slate-500">Nenhuma equipe cadastrada ainda.</div>}
      </div>
    </div>
  );
}

// Ícone/cor por módulo do sistema, usado no registro completo de atividade.
const RECURSO_META = {
  empresas: { Icon: Building2, color: "#12e7ff" },
  decisores: { Icon: Users, color: "#a78bfa" },
  contatos: { Icon: Users, color: "#a78bfa" },
  campanhas: { Icon: Megaphone, color: "#f59e0b" },
  whatsapp: { Icon: MessageCircle, color: "#00ff6a" },
  templates: { Icon: FileText, color: "#38bdf8" },
  tarefas: { Icon: CheckCircle2, color: "#34d399" },
  mercado: { Icon: Map, color: "#f472b6" },
  dmc: { Icon: Building2, color: "#f59e0b" },
  equipes: { Icon: Users, color: "#12e7ff" },
};

// ---------- Perfil do colaborador ----------
function PerfilColab({ api, data, tipos }) {
  const c = data.colaborador;
  const tipoKeys = Object.keys(tipos || {});

  // Registro completo de atividade (auditoria, paginado)
  const PAGE = 40;
  const [ativ, setAtiv] = useState({ items: [], total: 0, skip: 0, tem_mais: false });
  const [ativLoading, setAtivLoading] = useState(true);
  const [ativErro, setAtivErro] = useState("");

  const carregarAtiv = useCallback(async (skip) => {
    setAtivLoading(true); setAtivErro("");
    try {
      const d = await api(`/api/equipes/colaboradores/${c.id}/atividades?limit=${PAGE}&skip=${skip}`);
      setAtiv((prev) => ({
        items: skip === 0 ? (d.items || []) : [...prev.items, ...(d.items || [])],
        total: d.total || 0, skip, tem_mais: !!d.tem_mais,
      }));
    } catch (e) { setAtivErro(e.message || "Falha ao carregar a atividade."); }
    finally { setAtivLoading(false); }
  }, [api, c.id]);

  useEffect(() => { carregarAtiv(0); }, [carregarAtiv]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#12e7ff]/15 text-[#12e7ff] grid place-items-center text-lg font-bold">{(c.nome || "?").slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0">
          <p className="text-white font-semibold">{c.nome}</p>
          <div className="flex items-center gap-2 mt-0.5"><FuncaoBadge funcao={c.funcao} /><StatusDot status={c.status} /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="E-mail" value={c.email} Icon={Mail} />
        <Info label="Telefone" value={c.telefone || "—"} Icon={Phone} />
        <Info label="Equipe" value={c.equipe_nome || "Sem equipe"} Icon={Users} />
        <Info label="Cadastrado em" value={fmtData(c.criado_em)} Icon={Clock} />
        <Info label="Último acesso" value={fmtDT(c.ultimo_acesso)} Icon={Activity} />
        <Info label="Total no período" value={`${fmtNum(data.total)} ações`} Icon={CheckCircle2} />
      </div>

      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Indicadores de produtividade</p>
        <div className="grid grid-cols-2 gap-2">
          {tipoKeys.filter((t) => (data.por_tipo?.[t] || 0) > 0).map((t) => (
            <div key={t} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
              <span className="text-[12px] text-slate-400">{tipos[t]}</span>
              <span className="text-white font-semibold">{fmtNum(data.por_tipo[t])}</span>
            </div>
          ))}
          {!tipoKeys.some((t) => (data.por_tipo?.[t] || 0) > 0) && <p className="col-span-2 text-slate-500 text-sm">Nenhuma ação registrada no período.</p>}
        </div>
      </div>

      {/* Registro completo — cada ação que a pessoa fez no sistema */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-slate-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <History size={13} className="text-[#12e7ff]" /> Registro completo de atividade
          </p>
          {ativ.total > 0 && <span className="text-[11px] text-slate-500">{fmtNum(ativ.total)} ações registradas</span>}
        </div>

        {ativErro && <p className="text-rose-300 text-sm mb-2">{ativErro}</p>}

        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {ativ.items.map((a) => {
            const m = RECURSO_META[a.recurso] || { Icon: ShieldCheck, color: "#94a3b8" };
            const I = m.Icon;
            return (
              <div key={a.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.02]">
                <span className="mt-0.5 w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: `${m.color}1f`, color: m.color }}>
                  <I size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-200 text-[13px]">{a.acao}</span>
                    {!a.ok && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">não concluída</span>}
                  </div>
                  <span className="text-slate-600 text-[11px]">{fmtDT(a.created_at)}</span>
                </div>
              </div>
            );
          })}

          {ativLoading && !ativ.items.length && <div className="py-6 flex justify-center"><div className="w-6 h-6 border-2 border-[#12e7ff] border-t-transparent rounded-full animate-spin" /></div>}
          {!ativLoading && !ativ.items.length && !ativErro && <p className="text-slate-500 text-sm py-2">Nenhuma ação registrada para esta pessoa ainda.</p>}
        </div>

        {ativ.tem_mais && (
          <button
            onClick={() => carregarAtiv(ativ.skip + PAGE)}
            disabled={ativLoading}
            className="mt-3 w-full h-10 rounded-xl text-sm font-medium text-[#12e7ff] border border-[#12e7ff]/25 hover:bg-[#12e7ff]/10 disabled:opacity-50"
          >
            {ativLoading ? "Carregando..." : "Carregar mais"}
          </button>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, Icon }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">{Icon && <Icon size={12} />} {label}</div>
      <div className="text-slate-200 mt-1 truncate">{value}</div>
    </div>
  );
}
