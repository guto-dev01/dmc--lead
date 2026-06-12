"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Building2, MapPin, ShieldCheck, Users, Briefcase,
  Search, Plus, Pencil, Trash2, X, ExternalLink, CheckCircle2, FileText,
  Phone, Mail, Scale,
} from "lucide-react";

const DMCMapa = dynamic(() => import("./DMCMapa"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[300px] grid place-items-center text-slate-500 text-sm">Carregando mapa…</div>
  ),
});

const apiBase = () =>
  (typeof window !== "undefined" && window.ENV_API_URL) ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8001";
const TOKEN_KEY = "imobpro_token";

const getStoredToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
};

async function api(path, opts = {}) {
  const token = getStoredToken();
  const r = await fetch(`${apiBase()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!r.ok) {
    let detail = `API ${r.status}`;
    try {
      const j = await r.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch (_) {
      try {
        detail = await r.text();
      } catch (_) {}
    }
    throw new Error(detail);
  }
  return r.status === 204 ? null : r.json();
}

/* Seções expostas para o menu lateral do ImobPro */
export const DMC_NAV = [
  { key: "empreendimentos", label: "Empreendimentos" },
  { key: "mapa", label: "Mapa de Ativos" },
  { key: "esteira", label: "Esteira de Aquisição" },
  { key: "padrao", label: "Padrão & Documentos" },
  { key: "equipe", label: "Equipe" },
  { key: "fundos", label: "Para Fundos" },
];

const TIPOLOGIAS = [
  "Imóvel Comercial", "Terreno", "Galpão Logístico", "Retail", "Hotel",
  "Residencial", "Loteamento", "Industrial", "Multiuso",
];
const STATUS = [
  "Originação", "Análise Preliminar", "Due Diligence", "Avaliação & Estruturação",
  "Negociação", "Comitê de Investimento", "Closing",
];

const fmtBRL = (v) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtCompact = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(1).replace(".", ",")} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)} mil`;
  return fmtBRL(n);
};
const fmtNum = (v, suf = "") => (v == null || v === "" ? "—" : `${Number(v).toLocaleString("pt-BR")}${suf}`);
const fmtLocal = (e) => [e.cidade, e.uf].filter(Boolean).join("/") || "Localização pendente";

const EMPTY = {
  nome: "", tipologia: "", parceiro_id: "", prospector: "", status: "Originação",
  cidade: "", uf: "", bairro: "", endereco: "", cep: "",
  area_terreno: "", area_construida: "", valor_venda: "", valor_locacao: "",
  iptu: "", condominio: "", cap_rate: "", ocupacao: "", inquilinos: "", ano_construcao: "",
  matricula: "", cartorio: "", inscricao_imobiliaria: "", zoneamento: "",
  url_fonte: "", foto_url: "", lat: "", lng: "", observacoes: "",
};
const NUMF = ["area_terreno", "area_construida", "valor_venda", "valor_locacao", "iptu", "condominio", "cap_rate", "ocupacao", "lat", "lng"];
const INTF = ["inquilinos", "ano_construcao"];

function toPayload(form) {
  const o = { ...form };
  for (const k of NUMF) o[k] = o[k] === "" || o[k] == null ? null : Number(String(o[k]).replace(",", "."));
  for (const k of INTF) o[k] = o[k] === "" || o[k] == null ? null : parseInt(o[k], 10);
  for (const k in o) if (o[k] === "") o[k] = null;
  return o;
}
function fromEmp(e) {
  const f = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) f[k] = e[k] == null ? "" : e[k];
  return f;
}

export default function DMCPlatform({ secaoControlada }) {
  const secao = secaoControlada || "empreendimentos";
  const [parceiros, setParceiros] = useState([]);
  const [emps, setEmps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fParceiro, setFParceiro] = useState("");

  const [form, setForm] = useState(null);   // objeto = modal aberto
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [p, e, s] = await Promise.all([
        api("/api/dmc/parceiros"),
        api("/api/dmc/empreendimentos"),
        api("/api/dmc/summary"),
      ]);
      setParceiros(p); setEmps(e); setSummary(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const lista = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return emps.filter((e) => {
      const mq = !q || (e.nome || "").toLowerCase().includes(q) || (e.cidade || "").toLowerCase().includes(q) || (e.codigo || "").toLowerCase().includes(q);
      const mt = !fTipo || e.tipologia === fTipo;
      const mp = !fParceiro || e.parceiro_id === fParceiro;
      return mq && mt && mp;
    });
  }, [emps, busca, fTipo, fParceiro]);

  const abrirNovo = () => { setEditId(null); setForm({ ...EMPTY }); };
  const abrirEdicao = (e) => { setEditId(e.id); setForm(fromEmp(e)); setDetalhe(null); };

  const salvar = async () => {
    if (!form.nome.trim()) { alert("Informe o nome do empreendimento."); return; }
    setSalvando(true);
    try {
      const body = JSON.stringify(toPayload(form));
      if (editId) await api(`/api/dmc/empreendimentos/${editId}`, { method: "PUT", body });
      else await api("/api/dmc/empreendimentos", { method: "POST", body });
      setForm(null); setEditId(null);
      await carregar();
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (e) => {
    if (!confirm(`Excluir "${e.nome}"? Essa ação não pode ser desfeita.`)) return;
    try { await api(`/api/dmc/empreendimentos/${e.id}`, { method: "DELETE" }); await carregar(); }
    catch (err) { alert("Erro ao excluir: " + err.message); }
  };

  const moverStatus = async (e, status) => {
    try { await api(`/api/dmc/empreendimentos/${e.id}`, { method: "PUT", body: JSON.stringify(toPayload({ ...fromEmp(e), status })) }); await carregar(); }
    catch (err) { alert("Erro: " + err.message); }
  };

  const [importando, setImportando] = useState(false);
  const importarEmpresas = async () => {
    if (!confirm("Importar todas as empresas cadastradas como empreendimentos? Empresas já importadas (mesmo nome) são ignoradas.")) return;
    setImportando(true);
    try {
      const r = await api("/api/dmc/empreendimentos/importar-empresas", { method: "POST" });
      alert(`${r.criados} empresa(s) importada(s).${r.pulados ? ` ${r.pulados} já existia(m).` : ""}`);
      await carregar();
    } catch (err) {
      alert("Erro ao importar: " + err.message);
    } finally {
      setImportando(false);
    }
  };

  const novoParceiro = async () => {
    const nome = prompt("Nome do novo parceiro intermediador:");
    if (!nome) return;
    try {
      const p = await api("/api/dmc/parceiros", { method: "POST", body: JSON.stringify({ nome, sigla: nome.slice(0, 3).toUpperCase() }) });
      const ps = await api("/api/dmc/parceiros"); setParceiros(ps);
      if (form) setForm({ ...form, parceiro_id: p.id });
    } catch (err) { alert("Erro: " + err.message); }
  };

  const titulo = DMC_NAV.find((n) => n.key === secao)?.label || "Complexo DMC";

  return (
    <div className="space-y-6 text-slate-200">
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">Complexo DMC · Intermediação Institucional</p>
          <h2 className="text-2xl font-bold text-white mt-1">{titulo}</h2>
        </div>
        {(secao === "empreendimentos" || secao === "mapa") && (
          <div className="flex items-center gap-2">
            {secao === "empreendimentos" && (
              <button onClick={importarEmpresas} disabled={importando}
                className="rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 border border-amber-400/40 text-amber-300 hover:bg-amber-400/10 disabled:opacity-60">
                <Building2 size={16} /> {importando ? "Importando…" : "Importar empresas"}
              </button>
            )}
            <button onClick={abrirNovo} className="tech-button rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2">
              <Plus size={16} /> Novo empreendimento
            </button>
          </div>
        )}
      </div>

      {secao === "empreendimentos" && (
        <Empreendimentos
          lista={lista} parceiros={parceiros} loading={loading}
          busca={busca} setBusca={setBusca} fTipo={fTipo} setFTipo={setFTipo}
          fParceiro={fParceiro} setFParceiro={setFParceiro}
          onRow={setDetalhe} onEdit={abrirEdicao} onDelete={excluir} onNovo={abrirNovo}
        />
      )}
      {secao === "mapa" && <SecaoMapa emps={emps} onSelect={setDetalhe} />}
      {secao === "esteira" && <Esteira emps={emps} stages={summary?.esteira || STATUS} onSelect={setDetalhe} onMove={moverStatus} />}
      {secao === "padrao" && <PadraoDocumentos />}
      {secao === "equipe" && <Equipe />}
      {secao === "fundos" && <ParaFundos summary={summary} />}

      {form && (
        <FormModal
          form={form} setForm={setForm} parceiros={parceiros} editId={editId}
          salvando={salvando} onSalvar={salvar} onFechar={() => { setForm(null); setEditId(null); }}
          onNovoParceiro={novoParceiro}
        />
      )}
      {detalhe && <DetalheModal e={detalhe} onFechar={() => setDetalhe(null)} onEdit={abrirEdicao} />}
    </div>
  );
}

/* ---------- EMPREENDIMENTOS ---------- */
function Empreendimentos(p) {
  const { lista, parceiros, loading, busca, setBusca, fTipo, setFTipo, fParceiro, setFParceiro, onRow, onEdit, onDelete, onNovo } = p;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={15} /></span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, cidade ou código..."
            className="w-full pl-9 pr-3 py-2.5 tech-input rounded-xl text-sm" />
        </div>
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="surface-soft rounded-xl px-3 py-2.5 text-sm text-white">
          <option value="">Todas as tipologias</option>
          {TIPOLOGIAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={fParceiro} onChange={(e) => setFParceiro(e.target.value)} className="surface-soft rounded-xl px-3 py-2.5 text-sm text-white">
          <option value="">Todos os parceiros</option>
          {parceiros.map((pp) => <option key={pp.id} value={pp.id}>{pp.nome}</option>)}
        </select>
      </div>

      <div className="surface-strong rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Empreendimento</th>
                <th className="px-4 py-3">Localização</th>
                <th className="px-4 py-3 text-right">Área</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Cap rate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => onRow(e)}>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{e.codigo}</td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{e.nome}</div>
                    <div className="text-slate-500 text-xs">{e.tipologia || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{fmtLocal(e)}{e.bairro ? <span className="text-slate-500 text-xs block">{e.bairro}</span> : null}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{fmtNum(e.area_construida || e.area_terreno, " m²")}</td>
                  <td className="px-4 py-3 text-right text-white">{fmtCompact(e.valor_venda)}</td>
                  <td className="px-4 py-3 text-right">{e.cap_rate_efetivo ? <span className={e.cap_rate_efetivo >= 7.5 ? "text-emerald-400" : "text-amber-400"}>{e.cap_rate_efetivo}%</span> : <span className="text-slate-500">—</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-3">{e.parceiro_nome ? <span className="inline-flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full" style={{ background: e.parceiro_cor || "#888" }} />{e.parceiro_nome}</span> : <span className="text-slate-500 text-xs">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                      <button onClick={() => onEdit(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#00e7fc] hover:bg-white/5"><Pencil size={15} /></button>
                      <button onClick={() => onDelete(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && lista.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-slate-500 text-sm mb-3">Nenhum empreendimento.</p>
            <button onClick={onNovo} className="tech-button rounded-xl px-4 py-2 text-sm font-bold inline-flex items-center gap-2"><Plus size={15} /> Cadastrar o primeiro</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const closing = status === "Closing";
  const adv = ["Negociação", "Comitê de Investimento", "Closing"].includes(status);
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap ${closing ? "bg-emerald-500/15 text-emerald-300" : adv ? "bg-amber-500/15 text-amber-300" : "bg-white/5 text-slate-400"}`}>{status}</span>
  );
}

/* ---------- MAPA ---------- */
const STATUS_BUCKETS = [
  ["#ff4d4d", "Não contatado"],
  ["#f5c518", "Aguardando resposta"],
  ["#3b82f6", "Em negociação"],
  ["#00ff6a", "Fechando / Fechado"],
];
function statusBucket(s) {
  if (s === "parceria_fechada") return STATUS_BUCKETS[3];
  if (s === "proposta_enviada") return STATUS_BUCKETS[2];
  if (s === "contato_feito" || s === "reuniao_agendada") return STATUS_BUCKETS[1];
  return STATUS_BUCKETS[0]; // nao_iniciado, pesquisa_feita
}

function SecaoMapa({ emps, onSelect }) {
  const [empresas, setEmpresas] = useState([]);
  const [info, setInfo] = useState({ sem_coords: 0, com_coords: 0 });
  const [geocod, setGeocod] = useState(false);
  const [empresaSel, setEmpresaSel] = useState(null);

  const carregarEmpresas = useCallback(async () => {
    try {
      const d = await api("/api/empresas/geo");
      setEmpresas(d.empresas || []); setInfo(d);
    } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  const geocodificar = async () => {
    setGeocod(true);
    try { await api("/api/empresas/geocodificar", { method: "POST" }); await carregarEmpresas(); }
    catch (e) { alert("Erro ao localizar: " + e.message); }
    finally { setGeocod(false); }
  };

  // Empresas: cor pelo status. Empilhadas no mesmo ponto se espalham em espiral.
  const vistos = {};
  const markersEmpresas = empresas.filter((e) => e.lat && e.lng).map((e) => {
    const [cor, rotulo] = statusBucket(e.status_prospeccao);
    const k = `${Number(e.lat).toFixed(4)},${Number(e.lng).toFixed(4)}`;
    const n = vistos[k] || 0; vistos[k] = n + 1;
    // espiral (ângulo áureo) para separar marcadores no mesmo ponto sem virar linha
    const ang = n * 2.399963;
    const rad = n === 0 ? 0 : 0.0006 * Math.sqrt(n);
    return {
      id: "emp-" + e.id, nome: e.nome,
      lat: Number(e.lat) + rad * Math.cos(ang),
      lng: Number(e.lng) + rad * Math.sin(ang),
      cor, valor_venda: 0, label: `${rotulo}${e.bairro ? ` · ${e.bairro}` : ""}`,
      onClick: () => setEmpresaSel(e),
    };
  });
  // Empreendimentos DMC (se houver): cor do parceiro
  const markersEmp = emps.filter((e) => e.lat && e.lng).map((e) => ({
    id: e.id, nome: e.nome, lat: e.lat, lng: e.lng, cor: e.parceiro_cor || "#00e7fc",
    valor_venda: e.valor_venda, label: fmtCompact(e.valor_venda), onClick: () => onSelect(e),
  }));
  const markers = [...markersEmpresas, ...markersEmp];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-4">
          {STATUS_BUCKETS.map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="w-3 h-3 rounded-full" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
        {info.sem_coords > 0 && (
          <button onClick={geocodificar} disabled={geocod} className="tech-button rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50">
            {geocod ? "Localizando empresas..." : `Localizar ${info.sem_coords} empresa(s) no mapa`}
          </button>
        )}
      </div>
      <div className="surface-strong rounded-2xl p-2">
        <DMCMapa markers={markers} height={520} />
      </div>
      <p className="text-xs text-slate-500">
        {info.com_coords} empresa(s) prospectada(s) no mapa
        {emps.filter((e) => e.lat && e.lng).length > 0 ? ` · ${emps.filter((e) => e.lat && e.lng).length} empreendimento(s) DMC` : ""}.
        {markers.length === 0 && " Clique em “Localizar empresas” para posicioná-las pelo endereço."}
      </p>
      {empresaSel && <EmpresaMapaModal empresa={empresaSel} onFechar={() => setEmpresaSel(null)} />}
    </div>
  );
}

/* Modal acionado ao clicar numa empresa no Mapa de Ativos.
   Busca o detalhe completo (/api/empresas/{id}: dados + contatos do cliente). */
function EmpresaMapaModal({ empresa, onFechar }) {
  const [dados, setDados] = useState(empresa);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    api(`/api/empresas/${empresa.id}`)
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => console.error(e))
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [empresa.id]);

  const [cor, rotulo] = statusBucket(dados.status_prospeccao);
  const contatos = dados.contatos || [];
  const endereco = [
    [dados.logradouro, dados.numero].filter(Boolean).join(", "),
    dados.bairro || dados.regiao, dados.municipio, dados.uf,
  ].filter(Boolean).join(" · ");
  const waLink = dados.whatsapp ? `https://wa.me/${String(dados.whatsapp).replace(/\D/g, "")}` : null;

  const item = (label, valor, render) => (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm mt-0.5 text-slate-200 break-words">{render ? render : (valor || "—")}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1100] bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div className="surface-strong rounded-2xl w-full max-w-2xl my-6 border border-white/10" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ background: cor }} title={rotulo} />
            <div>
              <h3 className="text-white font-semibold text-lg leading-tight">{dados.nome}</h3>
              <p className="text-slate-500 text-xs">
                {[dados.tipo, dados.eixo || dados.regiao].filter(Boolean).join(" · ") || "Cliente"}
                {carregando ? " · carregando…" : ""}
              </p>
            </div>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {item("Status", null, <span className="font-semibold" style={{ color: cor }}>{rotulo}</span>)}
          {item("Prioridade", dados.prioridade)}
          {item("Cargo-alvo", dados.cargo_alvo)}
          {item("Telefone", null, dados.telefone
            ? <a href={`tel:${dados.telefone}`} className="text-[#00e7fc] hover:underline flex items-center gap-1.5"><Phone size={13} />{dados.telefone}</a>
            : "—")}
          {item("WhatsApp", null, waLink
            ? <a href={waLink} target="_blank" rel="noreferrer" className="text-[#00ff6a] hover:underline flex items-center gap-1.5"><Phone size={13} />{dados.whatsapp}</a>
            : "—")}
          {item("E-mail", null, dados.email
            ? <a href={`mailto:${dados.email}`} className="text-[#00e7fc] hover:underline flex items-center gap-1.5 break-all"><Mail size={13} />{dados.email}</a>
            : "—")}
          {item("Website", null, dados.website
            ? <a href={dados.website.startsWith("http") ? dados.website : `https://${dados.website}`} target="_blank" rel="noreferrer" className="text-[#00e7fc] hover:underline flex items-center gap-1.5 break-all"><ExternalLink size={13} />{dados.website}</a>
            : "—")}
          {item("CNPJ", dados.cnpj)}
          {item("Administradora", dados.administradora)}
          <div className="col-span-full">{item("Localização", null,
            <span className="flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />{endereco || "—"}</span>)}</div>
          {dados.proxima_acao && <div className="col-span-full">{item("Próxima ação", dados.proxima_acao)}</div>}
          {dados.observacoes && <div className="col-span-full">{item("Observações", dados.observacoes)}</div>}
        </div>

        <div className="px-5 pb-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Users size={12} /> Contatos do cliente ({contatos.length})</div>
          {contatos.length === 0 ? (
            <p className="text-slate-600 text-sm">Nenhum contato cadastrado. Use os Decisores para enriquecer este cliente.</p>
          ) : (
            <div className="space-y-2">
              {contatos.map((c) => (
                <div key={c.id} className="surface-soft rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm text-white">{c.nome}{c.cargo ? <span className="text-slate-500"> · {c.cargo}</span> : ""}</div>
                    <div className="text-xs text-slate-400 flex flex-wrap gap-3 mt-0.5">
                      {c.telefone && <a href={`tel:${c.telefone}`} className="hover:text-[#00e7fc] flex items-center gap-1"><Phone size={11} />{c.telefone}</a>}
                      {c.whatsapp && <a href={`https://wa.me/${String(c.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:text-[#00ff6a] flex items-center gap-1"><Phone size={11} />{c.whatsapp}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="hover:text-[#00e7fc] flex items-center gap-1 break-all"><Mail size={11} />{c.email}</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ESTEIRA ---------- */
function Esteira({ emps, stages, onSelect, onMove }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {stages.map((st) => {
          const itens = emps.filter((e) => (e.status || "Originação") === st);
          return (
            <div key={st} className="w-64 flex-shrink-0 surface-strong rounded-2xl p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white">{st}</span>
                <span className="text-[10px] text-slate-500 bg-white/5 rounded-full px-2 py-0.5">{itens.length}</span>
              </div>
              <div className="space-y-2">
                {itens.map((e) => (
                  <div key={e.id} className="surface-soft rounded-xl p-3 hover:bg-white/5 cursor-pointer" onClick={() => onSelect(e)}>
                    <div className="text-white text-sm font-medium truncate">{e.nome}</div>
                    <div className="text-slate-500 text-xs">{fmtLocal(e)} · {fmtCompact(e.valor_venda)}</div>
                    <select value={e.status || "Originação"} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => onMove(e, ev.target.value)}
                      className="mt-2 w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-slate-300">
                      {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
                {itens.length === 0 && <p className="text-slate-600 text-xs text-center py-3">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- PADRÃO & DOCUMENTOS ---------- */
function PadraoDocumentos() {
  const criterios = [
    ["Cap rate mínimo", "Lajes comerciais A ≥ 7,5% · Logístico ≥ 8,5% · Retail ≥ 9%"],
    ["Ticket-alvo", "R$ 50M a R$ 500M por ativo"],
    ["Idade do ativo", "≤ 15 anos, ou retrofit recente comprovado"],
    ["Ocupação", "≥ 80% no closing, ou contrato BTS/atípico firmado"],
    ["Estruturação", "Aquisição via SPE — segrega risco e facilita o exit"],
    ["Tese de exit", "Obrigatória pré-comitê: 5–7 anos (venda direta, FII ou securitização)"],
    ["Documentação", "Matrícula atualizada + certidões negativas como condição"],
    ["Comissionamento", "Atrelado ao closing efetivo (êxito), não à originação"],
  ];
  const checklist = {
    "Cartorial": ["Matrícula atualizada (30 dias)", "Certidão de ônus reais", "Certidão de ações reais e pessoais reipersecutórias", "Averbações de construção"],
    "Tributário": ["Certidão negativa de IPTU", "CND federal / estadual / municipal", "Inscrição imobiliária", "Histórico de IPTU (5 anos)"],
    "Técnico": ["Habite-se / AVCB", "Laudo de avaliação (IBAPE)", "Plantas aprovadas", "Laudo de engenharia / vistoria"],
    "Vendedor PJ": ["Contrato social + alterações", "Certidão simplificada da Junta", "CND trabalhista (TST)", "Ata de aprovação da venda"],
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="surface-strong rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4"><ShieldCheck size={16} className="text-amber-400" /><p className="text-white font-semibold text-sm">Padrão de Aquisição</p></div>
        <div className="space-y-3">
          {criterios.map(([t, d]) => (
            <div key={t} className="border-b border-white/5 pb-3 last:border-0">
              <p className="text-[#00e7fc] text-xs uppercase tracking-wide">{t}</p>
              <p className="text-slate-300 text-sm mt-0.5">{d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="surface-strong rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4"><FileText size={16} className="text-amber-400" /><p className="text-white font-semibold text-sm">Checklist Documental (Due Diligence)</p></div>
        <div className="space-y-4">
          {Object.entries(checklist).map(([grupo, itens]) => (
            <div key={grupo}>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">{grupo}</p>
              <ul className="space-y-1.5">
                {itens.map((i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 size={14} className="text-slate-600 flex-shrink-0" />{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- EQUIPE ---------- */
function Equipe() {
  const time = [
    { nome: "Daniel Mathias Chagas", cargo: "Diretor de Originação", reg: "CRA-SP 159039", email: "danielc@complexodmc.com.br", icon: Briefcase },
    { nome: "Dr. Matheus Vital Gomes", cargo: "Jurídico · Real Estate", reg: "OAB 521.104", email: null, icon: Scale },
    { nome: "Araken", cargo: "Prospector / Originação", reg: null, email: null, icon: Users },
    { nome: "Sidney Coelho", cargo: "Prospector / Originação", reg: null, email: null, icon: Users },
    { nome: "Geraldo Alves", cargo: "Prospector / Originação", reg: null, email: null, icon: Users },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {time.map((m) => (
        <div key={m.nome} className="surface-strong rounded-2xl p-5">
          <div className="w-11 h-11 rounded-xl bg-amber-400/10 text-amber-300 flex items-center justify-center mb-3"><m.icon size={18} /></div>
          <p className="text-white font-semibold">{m.nome}</p>
          <p className="text-[#00e7fc] text-xs mt-0.5">{m.cargo}</p>
          {m.reg && <p className="text-slate-500 text-xs mt-1">{m.reg}</p>}
          {m.email && <p className="text-slate-400 text-xs mt-2 flex items-center gap-1.5"><Mail size={12} />{m.email}</p>}
        </div>
      ))}
    </div>
  );
}

/* ---------- PARA FUNDOS ---------- */
function ParaFundos({ summary }) {
  const passos = [
    ["01", "NDA", "Acordo de confidencialidade para acesso ao dataroom"],
    ["02", "Mandato", "Mandato de originação com tese e mandato de busca"],
    ["03", "Curadoria", "Apresentação de ativos pré-filtrados pelo padrão DMC"],
    ["04", "Closing", "Estruturação via SPE, due diligence e fechamento"],
  ];
  const difs = [
    "Curadoria pelo padrão de aquisição (cap rate, idade, ocupação, exit)",
    "Estruturação via SPE — risco segregado por ativo",
    "Tese de exit definida antes do comitê",
    "Comissionamento atrelado ao êxito (closing)",
    "Dataroom com trilha de auditoria de acesso",
    "Conformidade CVM 175 e PLD/FT",
  ];
  return (
    <div className="space-y-4">
      <div className="surface-strong rounded-2xl p-6">
        <p className="text-amber-400/80 text-[10px] uppercase tracking-[0.3em]">Tese institucional</p>
        <p className="text-white text-lg mt-2 max-w-3xl leading-relaxed">
          A Complexo DMC intermedia a aquisição de ativos imobiliários institucionais para fundos, family offices e gestoras —
          com curadoria criteriosa, estruturação via SPE e tese de saída definida antes do comitê.
        </p>
        {summary && summary.qtd > 0 && (
          <div className="flex flex-wrap gap-6 mt-5 text-sm">
            <span className="text-slate-400">Portfólio ativo: <b className="text-white">{fmtCompact(summary.total_valor)}</b></span>
            <span className="text-slate-400">Ativos: <b className="text-white">{summary.qtd}</b></span>
            <span className="text-slate-400">Cap rate médio: <b className="text-white">{summary.cap_medio || "—"}%</b></span>
          </div>
        )}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface-strong rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Diferenciais</p>
          <ul className="space-y-2">
            {difs.map((d) => <li key={d} className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle2 size={15} className="text-emerald-400 mt-0.5 flex-shrink-0" />{d}</li>)}
          </ul>
        </div>
        <div className="surface-strong rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Fluxo de relacionamento</p>
          <div className="space-y-3">
            {passos.map(([n, t, d]) => (
              <div key={n} className="flex gap-3">
                <span className="text-amber-400 font-bold text-lg leading-none w-7">{n}</span>
                <div><p className="text-white text-sm font-medium">{t}</p><p className="text-slate-400 text-xs">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-600 tracking-wider">
        COMPLEXO DMC LTDA · CNPJ 61.877.895/0001-31 · Material confidencial — uso restrito a investidores qualificados
      </p>
    </div>
  );
}

/* ---------- MODAL DE CADASTRO/EDIÇÃO ---------- */
function FormModal({ form, setForm, parceiros, editId, salvando, onSalvar, onFechar, onNovoParceiro }) {
  const set = (k, v) => setForm({ ...form, [k]: v });
  const F = ({ label, k, type = "text", placeholder, full }) => (
    <label className={full ? "block sm:col-span-2" : "block"}>
      <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      <input type={type} value={form[k] ?? ""} placeholder={placeholder} onChange={(e) => set(k, e.target.value)}
        className="mt-1 w-full tech-input rounded-xl px-3 py-2 text-sm" />
    </label>
  );
  const picked = form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null;
  return (
    <div className="fixed inset-0 z-[1100] bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div className="surface-strong rounded-2xl w-full max-w-3xl my-6 border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#0a1418]/95 rounded-t-2xl">
          <h3 className="text-white font-semibold">{editId ? "Editar empreendimento" : "Novo empreendimento"}</h3>
          <button onClick={onFechar} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          <Grupo titulo="Identificação">
            <F label="Nome / referência *" k="nome" full />
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Tipologia</span>
              <select value={form.tipologia ?? ""} onChange={(e) => set("tipologia", e.target.value)} className="mt-1 w-full surface-soft rounded-xl px-3 py-2 text-sm text-white">
                <option value="">—</option>{TIPOLOGIAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Status (esteira)</span>
              <select value={form.status ?? "Originação"} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full surface-soft rounded-xl px-3 py-2 text-sm text-white">
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Parceiro intermediador</span>
              <div className="flex gap-2 mt-1">
                <select value={form.parceiro_id ?? ""} onChange={(e) => set("parceiro_id", e.target.value)} className="flex-1 surface-soft rounded-xl px-3 py-2 text-sm text-white">
                  <option value="">—</option>{parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <button type="button" onClick={onNovoParceiro} className="px-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5"><Plus size={14} /></button>
              </div>
            </label>
            <F label="Prospector" k="prospector" />
          </Grupo>

          <Grupo titulo="Localização">
            <F label="Cidade" k="cidade" /><F label="UF" k="uf" /><F label="Bairro" k="bairro" />
            <F label="Endereço" k="endereco" full /><F label="CEP" k="cep" />
            <F label="Latitude" k="lat" /><F label="Longitude" k="lng" />
            <div className="sm:col-span-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Clique no mapa para definir a localização</span>
              <div className="mt-1 rounded-xl overflow-hidden">
                <DMCMapa markers={[]} picked={picked} height={220} onPick={(la, ln) => setForm({ ...form, lat: la, lng: ln })} />
              </div>
            </div>
          </Grupo>

          <Grupo titulo="Áreas & Valores">
            <F label="Área terreno (m²)" k="area_terreno" /><F label="Área construída (m²)" k="area_construida" />
            <F label="Valor de venda (R$)" k="valor_venda" /><F label="Locação mensal (R$)" k="valor_locacao" />
            <F label="IPTU (R$)" k="iptu" /><F label="Condomínio (R$)" k="condominio" />
            <F label="Cap rate (%) — vazio = calcula" k="cap_rate" /><F label="Ocupação (%)" k="ocupacao" />
            <F label="Nº inquilinos" k="inquilinos" /><F label="Ano de construção" k="ano_construcao" />
          </Grupo>

          <Grupo titulo="Documentação & Origem">
            <F label="Matrícula" k="matricula" /><F label="Cartório de registro" k="cartorio" />
            <F label="Inscrição imobiliária" k="inscricao_imobiliaria" /><F label="Zoneamento / uso" k="zoneamento" />
            <F label="URL / fonte do anúncio" k="url_fonte" full /><F label="URL da foto (fachada)" k="foto_url" full />
            <label className="block sm:col-span-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Observações</span>
              <textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} rows={3} className="mt-1 w-full tech-input rounded-xl px-3 py-2 text-sm" />
            </label>
          </Grupo>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/5 sticky bottom-0 bg-[#0a1418]/95 rounded-b-2xl">
          <button onClick={onFechar} className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-white/5">Cancelar</button>
          <button onClick={onSalvar} disabled={salvando} className="tech-button rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50">
            {salvando ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-amber-400/70 mb-2">{titulo}</p>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

/* ---------- MODAL DE DETALHE ---------- */
function DetalheModal({ e, onFechar, onEdit }) {
  const item = (label, valor, destaque) => (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm mt-0.5 ${destaque ? "text-[#00e7fc] font-semibold" : "text-slate-200"}`}>{valor ?? "—"}</div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[1100] bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div className="surface-strong rounded-2xl w-full max-w-2xl my-6 border border-white/10" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <p className="text-slate-500 font-mono text-xs">{e.codigo}</p>
            <h3 className="text-white font-semibold text-lg">{e.nome}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(e)} className="px-3 py-1.5 rounded-lg text-xs text-[#00e7fc] hover:bg-white/5 flex items-center gap-1.5"><Pencil size={13} /> Editar</button>
            <button onClick={onFechar} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
        </div>
        {e.foto_url && <img src={e.foto_url} alt={e.nome} className="w-full max-h-56 object-cover" />}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {item("Tipologia", e.tipologia)}
          {item("Status", e.status)}
          {item("Parceiro", e.parceiro_nome)}
          {item("Localização", [e.endereco, e.bairro, fmtLocal(e)].filter(Boolean).join(" · "))}
          {item("Área terreno", fmtNum(e.area_terreno, " m²"))}
          {item("Área construída", fmtNum(e.area_construida, " m²"))}
          {item("Valor de venda", fmtBRL(e.valor_venda), true)}
          {item("Locação mensal", fmtBRL(e.valor_locacao))}
          {item("Cap rate", e.cap_rate_efetivo ? `${e.cap_rate_efetivo}%` : "—", true)}
          {item("IPTU", fmtBRL(e.iptu))}
          {item("Condomínio", fmtBRL(e.condominio))}
          {item("Ocupação", e.ocupacao ? `${e.ocupacao}%${e.inquilinos ? ` · ${e.inquilinos} inquilinos` : ""}` : "—")}
          {item("Ano", e.ano_construcao)}
          {item("Matrícula", e.matricula)}
          {item("Cartório", e.cartorio)}
          {e.zoneamento && <div className="col-span-full">{item("Zoneamento / uso", e.zoneamento)}</div>}
          {e.observacoes && <div className="col-span-full">{item("Observações", e.observacoes)}</div>}
        </div>
        {e.url_fonte && (
          <div className="px-5 pb-5">
            <a href={e.url_fonte} target="_blank" rel="noreferrer" className="text-[#00e7fc] text-sm flex items-center gap-1.5 hover:underline"><ExternalLink size={14} /> Ver anúncio / fonte</a>
          </div>
        )}
      </div>
    </div>
  );
}

function Carregando() {
  return <div className="flex items-center gap-3 text-slate-400 text-sm py-10"><span className="w-5 h-5 border-2 border-[#00e7fc] border-t-transparent rounded-full animate-spin" /> Carregando…</div>;
}
function Vazio({ texto, onNovo }) {
  return (
    <div className="surface-strong rounded-2xl p-12 text-center">
      <Building2 size={40} className="mx-auto text-slate-600 mb-3" />
      <p className="text-slate-400 text-sm mb-4">{texto}</p>
      <button onClick={onNovo} className="tech-button rounded-xl px-4 py-2 text-sm font-bold inline-flex items-center gap-2"><Plus size={15} /> Cadastrar empreendimento</button>
    </div>
  );
}
