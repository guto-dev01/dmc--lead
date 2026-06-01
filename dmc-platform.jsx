import React, { useState, useMemo } from "react";
import {
  Building2,
  MapPin,
  TrendingUp,
  FileCheck2,
  Users,
  Briefcase,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Scale,
  Calculator,
  HandCoins,
  Gavel,
  ChevronRight,
  Download,
  Mail,
  Phone,
  Award,
  Target,
  Layers,
  X,
  Menu as MenuIcon,
} from "lucide-react";

/* ===========================================================
   COMPLEXO DMC LTDA — Plataforma de Apresentação a Fundos
   Intermediação de Negócios Imobiliários
   =========================================================== */

// --- DADOS: Parceiros Intermediadores ---
const PARCEIROS = {
  dmc: { nome: "DMC Capital Real Estate", sigla: "DMC", cor: "#8B6F3F" },
  vertice: { nome: "Vértice Imobiliário Premium", sigla: "VIP", cor: "#5C7C8A" },
  anchor: { nome: "Anchor Brokers Institucional", sigla: "ABI", cor: "#A0826D" },
  patrimonio: { nome: "Patrimônio Negócios LTDA", sigla: "PNG", cor: "#6B7B5E" },
  geraldo: { nome: "Geraldo Alves (Prospector)", sigla: "GA", cor: "#7A4E3A" },
  flbrokers: { nome: "FL Brokers (CRECI 19.828-J/SP)", sigla: "FLB", cor: "#7A4E4E" },
  sidney: { nome: "Sidney Coelho (Prospector)", sigla: "SC", cor: "#5D5742" },
};

// --- DADOS: Empreendimentos ---
// Schema:
// {
//   id, nome, tipo, cidade, estado, bairro, endereco (rua+nº),
//   area (m²), valor (R$ venda),
//   valorLocacaoMensal (R$/mês), iptuAnual (R$/ano),
//   condominioMensal (R$/mês), pacoteLocacaoMensal (R$/mês — total locação+IPTU+condomínio),
//   capRate (%) ou null, status (esteira), parceiro, prospector,
//   coords {x,y} ou null (sem localização → não aparece no mapa),
//   ocupacao (%) ou null, inquilinos, anoConstrucao, matricula,
//   url (link de origem do anúncio), observacoes
// }
const EMPREENDIMENTOS = [
  {
    id: "DMC-001",
    nome: "Terreno Tietê — Frente Terminal Rodoviário",
    referenciaProspector: "Sidney #1",
    tipo: "Terreno",
    cidade: "São Paulo",
    estado: "SP",
    bairro: "Santana",
    endereco: "Rua Marechal Odylio Denys, 138 — Metrô Tietê — São Paulo/SP — CEP 01142-300",
    area: 38000,
    valor: 285000000,
    valorLocacaoMensal: null, // PENDENTE — valor do contrato de locação do estacionamento
    iptuAnual: null,
    condominioMensal: null,
    pacoteLocacaoMensal: null,
    capRate: null, // não calculável sem valor de locação
    status: "Originação",
    parceiro: "sidney",
    prospector: "Araken",
    coords: { x: 611, y: 540 }, // SP capital
    coordenadasGeo: { lat: -23.51, lng: -46.626451 }, // do print do mapa
    ocupacao: 100,
    inquilinos: 1, // operadora de estacionamento
    usoAtual: "Estacionamento (100% ocupado)",
    anoConstrucao: null,
    matricula: null,
    url: null,
    observacoes:
      "Terreno de 38.000 m² em frente ao Terminal Rodoviário do Tietê (zona norte de SP). 100% alugado para operação de estacionamento. Localização privilegiada — próximo ao Shopping Center Norte, Anhembi e Marginal Tietê. Tese: ativo de fluxo recorrente com forte potencial de redesenvolvimento (uso misto, comercial ou logístico urbano). Pendências: valor do aluguel atual, matrícula, inscrição, contrato de locação vigente, regime tributário do imóvel.",
  },
];

// --- ESTÁGIOS DA ESTEIRA ---
const ESTAGIOS = [
  { key: "Originação", icon: Search, descricao: "Mapeamento e prospecção" },
  { key: "Análise Preliminar", icon: Filter, descricao: "Screening e fit" },
  { key: "Due Diligence", icon: FileCheck2, descricao: "Auditoria completa" },
  { key: "Avaliação & Estruturação", icon: Calculator, descricao: "Laudo + estrutura" },
  { key: "Negociação", icon: HandCoins, descricao: "Termos comerciais" },
  { key: "Comitê de Investimento", icon: Scale, descricao: "Aprovação do fundo" },
  { key: "Closing", icon: Gavel, descricao: "Assinatura e registro" },
];

// --- CHECKLIST DOCUMENTAL ---
const CHECKLIST = [
  {
    grupo: "Imóvel — Documentação Cartorial",
    itens: [
      "Matrícula atualizada (emitida nos últimos 30 dias)",
      "Certidão de ônus reais e ações reipersecutórias",
      "Certidão vintenária (últimos 20 anos)",
      "Memorial descritivo e planta cadastral aprovada",
      "Habite-se e averbação de construção",
    ],
  },
  {
    grupo: "Imóvel — Tributos e Taxas",
    itens: [
      "IPTU dos últimos 5 exercícios (quitado)",
      "ITR (se rural) dos últimos 5 exercícios",
      "Inscrição municipal e cadastro imobiliário",
      "Certidão negativa de débitos municipais",
      "Comprovante de quitação condominial (se aplicável)",
    ],
  },
  {
    grupo: "Imóvel — Conformidade Técnica",
    itens: [
      "AVCB — Auto de Vistoria do Corpo de Bombeiros vigente",
      "Laudo técnico estrutural NBR 16747",
      "Laudo de avaliação NBR 14653 (atualizado)",
      "Licença ambiental (CETESB/órgão estadual) quando aplicável",
      "Due diligence ambiental Fase I (e Fase II se passivo identificado)",
      "Certidão de zoneamento urbanístico",
    ],
  },
  {
    grupo: "Vendedor — Pessoa Física",
    itens: [
      "Documento de identificação e CPF",
      "Certidões negativas: Federal, Estadual, Municipal, Trabalhista, Justiça",
      "Certidão de casamento e pacto antenupcial",
      "Anuência conjugal expressa",
    ],
  },
  {
    grupo: "Vendedor — Pessoa Jurídica",
    itens: [
      "Contrato social consolidado e última alteração",
      "Cartão CNPJ e certidão simplificada da Junta",
      "Ata de assembleia autorizando a venda",
      "Certidões negativas de débitos federais, estaduais e trabalhistas (CNDT)",
      "Procuração com poderes específicos (quando aplicável)",
    ],
  },
  {
    grupo: "Operacional — Pós-Closing",
    itens: [
      "Inventário de contratos de locação e garantias",
      "Memorial dos inquilinos (rent roll auditado)",
      "Apólices de seguro patrimonial vigentes",
      "Manuais técnicos e ART das instalações",
      "Plano de manutenção preventiva",
    ],
  },
];

// --- EQUIPE PROFISSIONAL ---
const EQUIPE = [
  {
    nome: "Carlos Mendonça",
    cargo: "Diretor de Originação",
    formacao: "MBA Real Estate FGV • CRECI 152.847/SP",
    foco: "Mapeamento de oportunidades, relacionamento com proprietários institucionais e family offices.",
    iniciais: "CM",
  },
  {
    nome: "Ana Beatriz Carvalho, CFA",
    cargo: "Head de Investimentos",
    formacao: "CFA Charter • Mestrado Insper Finance",
    foco: "Modelagem financeira, estruturação de cap rate e tese de investimento por ativo.",
    iniciais: "AC",
  },
  {
    nome: "Dr. Ricardo Sampaio",
    cargo: "Sócio Jurídico — Real Estate",
    formacao: "OAB/SP 198.341 • LL.M. Direito Imobiliário USP",
    foco: "Due diligence cartorial, estruturação societária, SPEs e contratos build-to-suit.",
    iniciais: "RS",
  },
  {
    nome: "Eng. Paulo Resende",
    cargo: "Engenheiro Avaliador Sênior",
    formacao: "CREA 0608942-3 • IBAPE/SP",
    foco: "Avaliações NBR 14653, vistorias técnicas e laudos para comitês de fundos.",
    iniciais: "PR",
  },
  {
    nome: "Marina Oliveira",
    cargo: "Gerente de Relações com Fundos",
    formacao: "ANBIMA CPA-20 • Pós FIA Real Estate",
    foco: "IR para FIIs listados, fundos restritos e gestoras de private equity imobiliário.",
    iniciais: "MO",
  },
  {
    nome: "Fernando Tavares",
    cargo: "Compliance & Risk Officer",
    formacao: "PQO B3 • Certificação ANBIMA CPA-10",
    foco: "PLD/FT, conformidade com Resolução CVM 175 e governança de transações.",
    iniciais: "FT",
  },
  {
    nome: "Patrícia Lemos",
    cargo: "Coordenadora Comercial",
    formacao: "CRECI 145.220/SP • Pós Marketing ESPM",
    foco: "Closing, comissionamento, intermediação multipartes e materiais de pitch.",
    iniciais: "PL",
  },
  {
    nome: "Lucas Almeida",
    cargo: "Analista de Inteligência de Mercado",
    formacao: "Engenharia FEI • Especialização Buildings Brasil",
    foco: "Benchmarks regionais, leituras de cap rate, vacância e absorção líquida.",
    iniciais: "LA",
  },
];

// --- PADRÃO DE AQUISIÇÃO ---
const PADRAO = [
  {
    titulo: "Localização",
    valor: "Tier 1 — capitais e regiões metropolitanas com PIB > R$ 100 bi",
    icon: MapPin,
  },
  {
    titulo: "Ticket-alvo",
    valor: "R$ 50 milhões a R$ 500 milhões por ativo (sweet spot R$ 100–250M)",
    icon: HandCoins,
  },
  {
    titulo: "Cap Rate mínimo",
    valor: "Comercial: 7,5% • Logístico: 9,0% • Retail: 8,5% • Hoteleiro: 7,0%",
    icon: TrendingUp,
  },
  {
    titulo: "Idade do ativo",
    valor: "Construído ou retrofitado nos últimos 15 anos",
    icon: Building2,
  },
  {
    titulo: "Ocupação",
    valor: "Mínimo de 80% no closing OU contrato BTS/built-to-suit firmado",
    icon: CheckCircle2,
  },
  {
    titulo: "Documentação",
    valor: "100% do checklist de 28 itens cumprido pré-comitê",
    icon: ShieldCheck,
  },
  {
    titulo: "Liquidez de saída",
    valor: "Tese clara de exit em 5–7 anos (venda direta, FII ou securitização)",
    icon: ArrowUpRight,
  },
  {
    titulo: "Estruturação",
    valor: "Aquisição via SPE, com garantias atípicas e cláusulas de earn-out quando aplicável",
    icon: Layers,
  },
];

/* ===================== UTILS ===================== */
const fmtBRL = (v) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

const fmtNumero = (v) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR").format(v);

// Monta "Cidade/UF" gracefully — se faltar dado, mostra etiqueta de pendência
const fmtLocalizacao = (imovel, semDado = "Localização pendente") => {
  if (!imovel.cidade && !imovel.estado) return semDado;
  if (imovel.cidade && imovel.estado) return `${imovel.cidade}/${imovel.estado}`;
  return imovel.cidade || imovel.estado;
};

const fmtEnderecoCompleto = (imovel) => {
  const parts = [];
  if (imovel.bairro) parts.push(imovel.bairro);
  const cu = fmtLocalizacao(imovel, "");
  if (cu) parts.push(cu);
  return parts.join(", ") || "Localização a confirmar";
};

const corStatus = (status) => {
  const map = {
    "Originação": "bg-stone-100 text-stone-700 border-stone-300",
    "Análise Preliminar": "bg-amber-50 text-amber-800 border-amber-200",
    "Due Diligence": "bg-blue-50 text-blue-800 border-blue-200",
    "Avaliação & Estruturação": "bg-indigo-50 text-indigo-800 border-indigo-200",
    "Negociação": "bg-orange-50 text-orange-800 border-orange-200",
    "Comitê de Investimento": "bg-purple-50 text-purple-800 border-purple-200",
    "Closing": "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  return map[status] || "bg-gray-100 text-gray-700 border-gray-300";
};

/* ===================== COMPONENTE PRINCIPAL ===================== */
export default function DMCPlatform() {
  const [secao, setSecao] = useState("dashboard");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroParceiro, setFiltroParceiro] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [imovelSelecionado, setImovelSelecionado] = useState(null);
  const [menuMobile, setMenuMobile] = useState(false);

  // KPIs agregados
  const kpis = useMemo(() => {
    const total = EMPREENDIMENTOS.reduce((s, e) => s + e.valor, 0);
    const areaTotal = EMPREENDIMENTOS.reduce((s, e) => s + e.area, 0);
    const capRates = EMPREENDIMENTOS.filter((e) => e.capRate).map((e) => e.capRate);
    const capMedio =
      capRates.length > 0
        ? capRates.reduce((s, c) => s + c, 0) / capRates.length
        : 0;
    const closing = EMPREENDIMENTOS.filter((e) =>
      ["Closing", "Comitê de Investimento", "Negociação"].includes(e.status)
    ).length;
    return {
      total,
      qtd: EMPREENDIMENTOS.length,
      areaTotal,
      capMedio,
      closing,
    };
  }, []);

  // Filtros aplicados
  const empreendimentosFiltrados = useMemo(() => {
    return EMPREENDIMENTOS.filter((e) => {
      const matchTipo = filtroTipo === "todos" || e.tipo.includes(filtroTipo);
      const matchParceiro = filtroParceiro === "todos" || e.parceiro === filtroParceiro;
      const matchBusca =
        !filtroBusca ||
        e.nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        (e.cidade || "").toLowerCase().includes(filtroBusca.toLowerCase()) ||
        e.id.toLowerCase().includes(filtroBusca.toLowerCase());
      return matchTipo && matchParceiro && matchBusca;
    });
  }, [filtroTipo, filtroParceiro, filtroBusca]);

  const tiposUnicos = [...new Set(EMPREENDIMENTOS.map((e) => e.tipo.split(" ")[0]))];

  const NAV = [
    { key: "dashboard", label: "Visão Geral", icon: TrendingUp },
    { key: "empreendimentos", label: "Empreendimentos", icon: Building2 },
    { key: "mapa", label: "Mapa de Ativos", icon: MapPin },
    { key: "esteira", label: "Esteira de Aquisição", icon: Layers },
    { key: "padrao", label: "Padrão & Documentos", icon: ShieldCheck },
    { key: "equipe", label: "Equipe", icon: Users },
    { key: "fundos", label: "Para Fundos", icon: Briefcase },
  ];

  return (
    <div
      className="min-h-screen bg-stone-50 text-stone-900"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      {/* ============== TOP BAR ============== */}
      <header className="bg-stone-900 text-stone-100 sticky top-0 z-40 border-b-2 border-amber-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 border-2 border-amber-600 flex items-center justify-center"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <span className="text-amber-500 text-lg font-light tracking-widest">D</span>
            </div>
            <div>
              <div
                className="text-lg leading-tight tracking-wider"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "0.15em" }}
              >
                COMPLEXO DMC
              </div>
              <div className="text-[10px] text-amber-500 tracking-[0.3em] uppercase">
                Real Estate · Intermediação Institucional
              </div>
            </div>
          </div>

          <button
            className="md:hidden text-stone-200"
            onClick={() => setMenuMobile(!menuMobile)}
          >
            {menuMobile ? <X size={22} /> : <MenuIcon size={22} />}
          </button>

          <div className="hidden md:flex items-center gap-6 text-xs tracking-wider uppercase">
            <span className="text-stone-400">Portfólio Ativo</span>
            <span className="text-amber-400 font-medium">
              {fmtBRL(kpis.total).replace("R$", "R$ ")}
            </span>
            <span className="text-stone-600">|</span>
            <span className="text-stone-400">{kpis.qtd} empreendimentos</span>
          </div>
        </div>

        {/* NAV principal */}
        <nav
          className={`${
            menuMobile ? "block" : "hidden"
          } md:block bg-stone-800 border-t border-stone-700`}
        >
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              const ativo = secao === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setSecao(item.key);
                    setMenuMobile(false);
                  }}
                  className={`px-4 py-3 text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-2 transition-colors border-b-2 ${
                    ativo
                      ? "text-amber-400 border-amber-500"
                      : "text-stone-300 border-transparent hover:text-stone-100 hover:bg-stone-700"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ============== CONTEÚDO ============== */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {secao === "dashboard" && <Dashboard kpis={kpis} />}
        {secao === "empreendimentos" && (
          <Empreendimentos
            lista={empreendimentosFiltrados}
            tiposUnicos={tiposUnicos}
            filtroTipo={filtroTipo}
            setFiltroTipo={setFiltroTipo}
            filtroParceiro={filtroParceiro}
            setFiltroParceiro={setFiltroParceiro}
            filtroBusca={filtroBusca}
            setFiltroBusca={setFiltroBusca}
            onSelect={setImovelSelecionado}
          />
        )}
        {secao === "mapa" && <Mapa onSelect={setImovelSelecionado} />}
        {secao === "esteira" && <Esteira onSelect={setImovelSelecionado} />}
        {secao === "padrao" && <PadraoDocumentos />}
        {secao === "equipe" && <Equipe />}
        {secao === "fundos" && <ParaFundos kpis={kpis} />}
      </main>

      {/* Modal de detalhe */}
      {imovelSelecionado && (
        <ModalImovel
          imovel={imovelSelecionado}
          onClose={() => setImovelSelecionado(null)}
        />
      )}

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
          <div>
            <div
              className="text-stone-100 text-base mb-2"
              style={{ fontFamily: "Georgia, serif", letterSpacing: "0.15em" }}
            >
              COMPLEXO DMC LTDA
            </div>
            <p className="text-xs leading-relaxed">
              Intermediação institucional de ativos imobiliários para fundos de
              investimento, family offices e gestoras patrimoniais. CNPJ: __.___.___/0001-__
              · CRECI Jurídico ___/SP.
            </p>
          </div>
          <div>
            <div className="text-stone-100 text-xs uppercase tracking-wider mb-3">
              Contato Institucional
            </div>
            <div className="flex items-center gap-2 text-xs mb-1">
              <Mail size={12} /> ri@complexodmc.com.br
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Phone size={12} /> +55 11 0000-0000
            </div>
          </div>
          <div>
            <div className="text-stone-100 text-xs uppercase tracking-wider mb-3">
              Conformidade
            </div>
            <p className="text-xs leading-relaxed">
              Operações em conformidade com a Resolução CVM 175 e PLD/FT.
              Material confidencial — uso restrito a investidores qualificados.
            </p>
          </div>
        </div>
        <div className="border-t border-stone-800 py-4 text-center text-[10px] text-stone-600 tracking-widest uppercase">
          © 2026 Complexo DMC LTDA · Todos os direitos reservados
        </div>
      </footer>
    </div>
  );
}

/* ===================== SEÇÃO: DASHBOARD ===================== */
function Dashboard({ kpis }) {
  return (
    <section>
      <SectionHeader
        sobrescrito="Visão Geral"
        titulo="Portfólio em prospecção e estruturação"
        subtitulo="Atualizado em tempo real conforme avanço de cada ativo na esteira de aquisição."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KpiCard label="Volume total" valor={fmtBRL(kpis.total)} sub={`${kpis.qtd} ativos`} />
        <KpiCard
          label="Área total"
          valor={`${fmtNumero(Math.round(kpis.areaTotal / 1000))}k m²`}
          sub="ABL + terreno"
        />
        <KpiCard
          label="Cap rate médio"
          valor={`${kpis.capMedio.toFixed(2)}%`}
          sub="Ponderado por ativo"
        />
        <KpiCard label="Em closing" valor={kpis.closing} sub="Estágio avançado" destaque />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribuição por tipo */}
        <div className="bg-white border border-stone-200 p-6">
          <h3
            className="text-sm uppercase tracking-widest text-stone-500 mb-5"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Distribuição por tipologia
          </h3>
          <DistribuicaoTipo />
        </div>

        {/* Distribuição por parceiro */}
        <div className="bg-white border border-stone-200 p-6">
          <h3
            className="text-sm uppercase tracking-widest text-stone-500 mb-5"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Volume por intermediador
          </h3>
          <DistribuicaoParceiro />
        </div>
      </div>

      <div className="bg-stone-900 text-stone-100 mt-8 p-8 grid md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-2">
          <p
            className="text-amber-500 text-xs uppercase tracking-widest mb-2"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Tese Institucional
          </p>
          <h3 className="text-2xl mb-3" style={{ fontFamily: "Georgia, serif" }}>
            Aquisições com cap rate acima do benchmark, em ativos de praça defensiva.
          </h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            Originamos exclusivamente em mercados Tier 1, com documentação completa
            pré-aprovada e estruturação jurídica via SPE. Tese de exit declarada
            no comitê.
          </p>
        </div>
        <button
          onClick={() => alert("Pitch em PDF — gerar via servidor.")}
          className="bg-amber-600 hover:bg-amber-700 text-stone-900 px-6 py-4 text-xs uppercase tracking-widest font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Download size={14} /> Baixar Apresentação Institucional
        </button>
      </div>
    </section>
  );
}

function DistribuicaoTipo() {
  const grupos = useMemo(() => {
    const m = {};
    EMPREENDIMENTOS.forEach((e) => {
      const tipo = e.tipo.split(" ").slice(0, 2).join(" ");
      m[tipo] = (m[tipo] || 0) + e.valor;
    });
    const total = Object.values(m).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Object.entries(m)
      .map(([k, v]) => ({ tipo: k, valor: v, pct: (v / total) * 100 }))
      .sort((a, b) => b.valor - a.valor);
  }, []);

  if (grupos.length === 0) {
    return (
      <p className="text-xs text-stone-400 italic py-6 text-center">
        Cadastre o primeiro empreendimento para visualizar a distribuição.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <div key={g.tipo}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-stone-700">{g.tipo}</span>
            <span className="text-stone-500">
              {fmtBRL(g.valor)} · {g.pct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-stone-100">
            <div
              className="h-full bg-stone-700"
              style={{ width: `${g.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DistribuicaoParceiro() {
  const grupos = useMemo(() => {
    const m = {};
    EMPREENDIMENTOS.forEach((e) => {
      m[e.parceiro] = (m[e.parceiro] || 0) + e.valor;
    });
    const total = Object.values(m).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Object.entries(m).map(([k, v]) => ({
      parceiro: PARCEIROS[k],
      valor: v,
      pct: (v / total) * 100,
    }));
  }, []);

  if (grupos.length === 0) {
    return (
      <p className="text-xs text-stone-400 italic py-6 text-center">
        Cadastre o primeiro empreendimento para visualizar a distribuição.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <div key={g.parceiro.sigla}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-stone-700 flex items-center gap-2">
              <span
                className="inline-block w-2 h-2"
                style={{ background: g.parceiro.cor }}
              />
              {g.parceiro.nome}
            </span>
            <span className="text-stone-500">{fmtBRL(g.valor)}</span>
          </div>
          <div className="h-2 bg-stone-100">
            <div
              className="h-full"
              style={{ width: `${g.pct}%`, background: g.parceiro.cor }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, valor, sub, destaque }) {
  return (
    <div
      className={`p-5 border ${
        destaque
          ? "bg-stone-900 text-stone-100 border-amber-700"
          : "bg-white border-stone-200"
      }`}
    >
      <div
        className={`text-[10px] uppercase tracking-widest mb-2 ${
          destaque ? "text-amber-500" : "text-stone-500"
        }`}
      >
        {label}
      </div>
      <div
        className="text-2xl font-light"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {valor}
      </div>
      <div
        className={`text-xs mt-1 ${
          destaque ? "text-stone-400" : "text-stone-500"
        }`}
      >
        {sub}
      </div>
    </div>
  );
}

function SectionHeader({ sobrescrito, titulo, subtitulo }) {
  return (
    <div className="mb-8 pb-6 border-b border-stone-300">
      <div className="text-amber-700 text-[10px] uppercase tracking-[0.3em] mb-2">
        {sobrescrito}
      </div>
      <h2
        className="text-3xl md:text-4xl font-light text-stone-900 mb-2"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {titulo}
      </h2>
      {subtitulo && (
        <p className="text-stone-600 text-sm max-w-3xl leading-relaxed">
          {subtitulo}
        </p>
      )}
    </div>
  );
}

/* ===================== SEÇÃO: EMPREENDIMENTOS ===================== */
function Empreendimentos({
  lista,
  tiposUnicos,
  filtroTipo,
  setFiltroTipo,
  filtroParceiro,
  setFiltroParceiro,
  filtroBusca,
  setFiltroBusca,
  onSelect,
}) {
  return (
    <section>
      <SectionHeader
        sobrescrito="Catálogo Institucional"
        titulo="Empreendimentos em portfólio"
        subtitulo="Tabela master com todos os ativos ativos. Cada linha sob NDA — material restrito a fundos pré-qualificados."
      />

      {/* Filtros */}
      <div className="bg-white border border-stone-200 p-4 mb-4 grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            placeholder="Buscar por nome, cidade, ID..."
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 focus:outline-none focus:border-stone-700"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-3 py-2 text-sm border border-stone-300 focus:outline-none focus:border-stone-700"
        >
          <option value="todos">Todos os tipos</option>
          {tiposUnicos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filtroParceiro}
          onChange={(e) => setFiltroParceiro(e.target.value)}
          className="px-3 py-2 text-sm border border-stone-300 focus:outline-none focus:border-stone-700"
        >
          <option value="todos">Todos os parceiros</option>
          {Object.entries(PARCEIROS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-900 text-stone-100">
            <tr>
              <Th>ID</Th>
              <Th>Empreendimento</Th>
              <Th>Tipo</Th>
              <Th>Localização</Th>
              <Th align="right">Área (m²)</Th>
              <Th align="right">Valor</Th>
              <Th align="right">Cap rate</Th>
              <Th>Status</Th>
              <Th>Intermediador</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e, i) => {
              const parc = PARCEIROS[e.parceiro];
              return (
                <tr
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className={`cursor-pointer border-b border-stone-100 hover:bg-amber-50 transition-colors ${
                    i % 2 === 0 ? "bg-white" : "bg-stone-50"
                  }`}
                >
                  <Td className="font-mono text-xs text-stone-500">{e.id}</Td>
                  <Td className="font-medium text-stone-900">{e.nome}</Td>
                  <Td className="text-stone-600 text-xs">{e.tipo}</Td>
                  <Td className="text-stone-600 text-xs">
                    {fmtLocalizacao(e, "—")}
                  </Td>
                  <Td align="right" className="font-mono text-xs">
                    {fmtNumero(e.area)}
                  </Td>
                  <Td align="right" className="font-mono">
                    {fmtBRL(e.valor)}
                  </Td>
                  <Td align="right" className="font-mono text-xs">
                    {e.capRate ? `${e.capRate.toFixed(1)}%` : "—"}
                  </Td>
                  <Td>
                    <span
                      className={`text-[10px] px-2 py-1 border uppercase tracking-wider ${corStatus(
                        e.status
                      )}`}
                    >
                      {e.status}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2"
                        style={{ background: parc.cor }}
                      />
                      <span className="text-xs text-stone-700">{parc.sigla}</span>
                    </div>
                  </Td>
                  <Td>
                    <ChevronRight size={14} className="text-stone-400" />
                  </Td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-stone-500 text-sm">
                  Nenhum empreendimento encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-500 mt-4">
        Mostrando {lista.length} de {EMPREENDIMENTOS.length} empreendimentos. Clique em
        uma linha para ver o memorando do ativo.
      </p>
    </section>
  );
}

function Th({ children, align }) {
  return (
    <th
      className={`px-4 py-3 text-[10px] uppercase tracking-widest font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
function Td({ children, align, className = "" }) {
  return (
    <td
      className={`px-4 py-3 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

/* ===================== SEÇÃO: MAPA ===================== */
function Mapa({ onSelect }) {
  const [hover, setHover] = useState(null);

  return (
    <section>
      <SectionHeader
        sobrescrito="Geolocalização"
        titulo="Mapa de ativos no território nacional"
        subtitulo="Visão geográfica do portfólio. Passe o cursor sobre os marcadores para detalhes; clique para abrir o memorando."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Mapa SVG estilizado do Brasil */}
        <div className="lg:col-span-2 bg-stone-50 border border-stone-200 p-4">
          <svg viewBox="350 250 500 450" className="w-full h-auto">
            {/* Contorno simplificado do Brasil — formato estilizado */}
            <path
              d="M 460 290 Q 510 280 560 285 Q 620 290 670 305 Q 720 320 750 360 Q 780 410 790 460 Q 795 510 770 555 Q 745 600 720 625 Q 690 655 660 660 Q 620 668 580 670 Q 540 672 500 660 Q 470 650 450 620 Q 425 580 415 540 Q 405 490 410 440 Q 415 390 425 350 Q 435 310 460 290 Z"
              fill="#E7E2D6"
              stroke="#A89B82"
              strokeWidth="1.5"
            />
            {/* Linhas internas estilizando estados */}
            <line x1="500" y1="350" x2="650" y2="380" stroke="#C4BAA6" strokeWidth="0.5" strokeDasharray="2,3" />
            <line x1="480" y1="450" x2="700" y2="470" stroke="#C4BAA6" strokeWidth="0.5" strokeDasharray="2,3" />
            <line x1="500" y1="550" x2="700" y2="570" stroke="#C4BAA6" strokeWidth="0.5" strokeDasharray="2,3" />
            <line x1="580" y1="320" x2="580" y2="650" stroke="#C4BAA6" strokeWidth="0.5" strokeDasharray="2,3" />
            <line x1="650" y1="300" x2="650" y2="650" stroke="#C4BAA6" strokeWidth="0.5" strokeDasharray="2,3" />

            {/* Rótulos regionais */}
            <text x="500" y="370" fontSize="8" fill="#8B7E66" letterSpacing="2" fontFamily="Georgia, serif">
              NORTE
            </text>
            <text x="690" y="430" fontSize="8" fill="#8B7E66" letterSpacing="2" fontFamily="Georgia, serif">
              NORDESTE
            </text>
            <text x="510" y="500" fontSize="8" fill="#8B7E66" letterSpacing="2" fontFamily="Georgia, serif">
              C.-OESTE
            </text>
            <text x="640" y="555" fontSize="8" fill="#8B7E66" letterSpacing="2" fontFamily="Georgia, serif">
              SUDESTE
            </text>
            <text x="540" y="630" fontSize="8" fill="#8B7E66" letterSpacing="2" fontFamily="Georgia, serif">
              SUL
            </text>

            {/* Marcadores de empreendimentos — só os que têm coords */}
            {EMPREENDIMENTOS.filter((e) => e.coords).map((e) => {
              const parc = PARCEIROS[e.parceiro];
              const tamanho = Math.max(6, Math.min(16, e.valor / 20000000));
              const isHover = hover === e.id;
              return (
                <g
                  key={e.id}
                  onMouseEnter={() => setHover(e.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect(e)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={e.coords.x}
                    cy={e.coords.y}
                    r={tamanho + 4}
                    fill={parc.cor}
                    opacity={isHover ? 0.3 : 0.15}
                  />
                  <circle
                    cx={e.coords.x}
                    cy={e.coords.y}
                    r={tamanho}
                    fill={parc.cor}
                    stroke="#1c1917"
                    strokeWidth="1"
                  />
                  {isHover && (
                    <g>
                      <rect
                        x={e.coords.x + 12}
                        y={e.coords.y - 26}
                        width="180"
                        height="44"
                        fill="#1c1917"
                        stroke={parc.cor}
                        strokeWidth="1"
                      />
                      <text x={e.coords.x + 20} y={e.coords.y - 12} fontSize="8" fill="#FBBF24" letterSpacing="1.5">
                        {e.id} · {e.cidade}/{e.estado}
                      </text>
                      <text x={e.coords.x + 20} y={e.coords.y - 1} fontSize="9" fill="#F5F5F4" fontFamily="Georgia, serif">
                        {e.nome.length > 28 ? e.nome.slice(0, 28) + "…" : e.nome}
                      </text>
                      <text x={e.coords.x + 20} y={e.coords.y + 11} fontSize="9" fill="#A8A29E">
                        {fmtBRL(e.valor)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="text-[10px] text-stone-500 mt-2 text-center italic">
            Mapa esquemático para fins de apresentação. Em produção, integrar com Leaflet/Google Maps + geocoding por matrícula.
          </p>
        </div>

        {/* Legenda + lista lateral */}
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 p-5">
            <h4 className="text-xs uppercase tracking-widest text-stone-500 mb-3" style={{ fontFamily: "Georgia, serif" }}>
              Legenda — Intermediadores
            </h4>
            <div className="space-y-2">
              {Object.entries(PARCEIROS).map(([k, p]) => (
                <div key={k} className="flex items-center gap-3 text-xs">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: p.cor }}
                  />
                  <span className="text-stone-700">{p.nome}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-stone-200 text-[10px] text-stone-500">
              <strong>Tamanho do marcador</strong> proporcional ao valor do ativo (R$ 50M → R$ 285M).
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-5">
            <h4 className="text-xs uppercase tracking-widest text-stone-500 mb-3" style={{ fontFamily: "Georgia, serif" }}>
              Praças cobertas
            </h4>
            <div className="space-y-2 text-xs">
              {[
                { uf: "SP", qtd: EMPREENDIMENTOS.filter(e => e.estado === "SP").length },
                { uf: "RJ", qtd: EMPREENDIMENTOS.filter(e => e.estado === "RJ").length },
                { uf: "DF", qtd: EMPREENDIMENTOS.filter(e => e.estado === "DF").length },
                { uf: "BA", qtd: EMPREENDIMENTOS.filter(e => e.estado === "BA").length },
                { uf: "SC", qtd: EMPREENDIMENTOS.filter(e => e.estado === "SC").length },
              ].map((u) => (
                <div key={u.uf} className="flex justify-between border-b border-stone-100 pb-1">
                  <span className="text-stone-700">{u.uf}</span>
                  <span className="text-stone-500">{u.qtd} ativo{u.qtd !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== SEÇÃO: ESTEIRA ===================== */
function Esteira({ onSelect }) {
  return (
    <section>
      <SectionHeader
        sobrescrito="Pipeline"
        titulo="Esteira de aquisição institucional"
        subtitulo="Cada ativo percorre 7 estágios padronizados. Tempo médio do ciclo completo: 90 a 150 dias."
      />

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-[1100px]">
          {ESTAGIOS.map((est, idx) => {
            const Icon = est.icon;
            const ativos = EMPREENDIMENTOS.filter((e) => e.status === est.key);
            return (
              <div key={est.key} className="flex-1 min-w-[180px]">
                {/* Header da coluna */}
                <div className="bg-stone-900 text-stone-100 p-3 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className="text-amber-500" />
                    <span className="text-[10px] uppercase tracking-wider text-amber-500">
                      Etapa {idx + 1}
                    </span>
                  </div>
                  <div className="text-sm" style={{ fontFamily: "Georgia, serif" }}>
                    {est.key}
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{est.descricao}</div>
                  <div className="text-[10px] text-stone-300 mt-2">
                    {ativos.length} ativo{ativos.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {ativos.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      className="w-full text-left bg-white border border-stone-200 p-3 hover:border-amber-700 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-mono text-[10px] text-stone-500">{a.id}</span>
                        <span
                          className="w-2 h-2 mt-1"
                          style={{ background: PARCEIROS[a.parceiro].cor }}
                        />
                      </div>
                      <div className="text-xs font-medium text-stone-900 leading-tight mb-1">
                        {a.nome}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {fmtLocalizacao(a, "Localização pendente")}
                      </div>
                      <div className="text-xs font-mono mt-2 text-stone-700">
                        {fmtBRL(a.valor)}
                      </div>
                    </button>
                  ))}
                  {ativos.length === 0 && (
                    <div className="text-[10px] text-stone-400 italic p-3 border border-dashed border-stone-200">
                      Nenhum ativo nesta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SLA por estágio */}
      <div className="bg-white border border-stone-200 p-6 mt-8">
        <h4 className="text-xs uppercase tracking-widest text-stone-500 mb-4" style={{ fontFamily: "Georgia, serif" }}>
          SLA Padrão por Etapa
        </h4>
        <div className="grid md:grid-cols-7 gap-3 text-xs">
          {[
            { e: "Originação", sla: "Contínua" },
            { e: "Análise Prelim.", sla: "5 dias" },
            { e: "Due Diligence", sla: "30 dias" },
            { e: "Avaliação", sla: "20 dias" },
            { e: "Negociação", sla: "15 dias" },
            { e: "Comitê", sla: "10 dias" },
            { e: "Closing", sla: "30 dias" },
          ].map((s) => (
            <div key={s.e} className="text-center">
              <div className="text-stone-500 text-[10px] uppercase tracking-wider">{s.e}</div>
              <div className="text-stone-900 font-mono mt-1">{s.sla}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===================== SEÇÃO: PADRÃO + DOCUMENTOS ===================== */
function PadraoDocumentos() {
  const [aba, setAba] = useState("padrao");

  return (
    <section>
      <SectionHeader
        sobrescrito="Conformidade"
        titulo="Padrão de aquisição e checklist documental"
        subtitulo="Os critérios abaixo são as cláusulas pétreas para que um ativo seja submetido ao comitê de investimento."
      />

      <div className="flex gap-1 mb-6 border-b border-stone-300">
        <button
          onClick={() => setAba("padrao")}
          className={`px-5 py-3 text-xs uppercase tracking-widest border-b-2 transition-colors ${
            aba === "padrao"
              ? "border-amber-700 text-stone-900"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          Padrão de aquisição
        </button>
        <button
          onClick={() => setAba("docs")}
          className={`px-5 py-3 text-xs uppercase tracking-widest border-b-2 transition-colors ${
            aba === "docs"
              ? "border-amber-700 text-stone-900"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          Checklist documental
        </button>
      </div>

      {aba === "padrao" && (
        <div className="grid md:grid-cols-2 gap-4">
          {PADRAO.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="bg-white border border-stone-200 p-5 flex gap-4">
                <div className="w-10 h-10 bg-stone-900 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} />
                </div>
                <div>
                  <div
                    className="text-sm uppercase tracking-wider text-stone-500 mb-1"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {p.titulo}
                  </div>
                  <div className="text-stone-900 text-sm leading-relaxed">{p.valor}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aba === "docs" && (
        <div className="space-y-6">
          {CHECKLIST.map((g) => (
            <div key={g.grupo} className="bg-white border border-stone-200">
              <div className="bg-stone-900 text-stone-100 px-5 py-3 flex items-center gap-2">
                <FileText size={14} className="text-amber-500" />
                <span className="text-xs uppercase tracking-wider">{g.grupo}</span>
                <span className="ml-auto text-[10px] text-stone-400">
                  {g.itens.length} itens
                </span>
              </div>
              <ul className="divide-y divide-stone-100">
                {g.itens.map((it, i) => (
                  <li key={i} className="px-5 py-3 flex items-start gap-3 text-sm">
                    <Circle size={14} className="text-stone-300 mt-0.5 flex-shrink-0" />
                    <span className="text-stone-700">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="bg-amber-50 border-l-4 border-amber-700 p-5 text-sm text-stone-700">
            <strong className="block mb-1 text-stone-900">
              Total: 28 itens documentais obrigatórios
            </strong>
            Nenhum ativo é levado ao comitê com checklist incompleto. Itens em
            atraso suspendem o avanço na esteira automaticamente.
          </div>
        </div>
      )}
    </section>
  );
}

/* ===================== SEÇÃO: EQUIPE ===================== */
function Equipe() {
  return (
    <section>
      <SectionHeader
        sobrescrito="Time"
        titulo="Profissionais responsáveis pelo ciclo de aquisição"
        subtitulo="Equipe multidisciplinar com responsabilidades claras em cada etapa da esteira. Todos os pareceres internos são documentados e arquivados por 5 anos."
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {EQUIPE.map((p) => (
          <div key={p.nome} className="bg-white border border-stone-200 p-5">
            <div className="w-14 h-14 bg-stone-900 text-amber-500 flex items-center justify-center text-lg mb-4 border-2 border-amber-600" style={{ fontFamily: "Georgia, serif" }}>
              {p.iniciais}
            </div>
            <div className="text-stone-900 font-medium text-sm mb-1">{p.nome}</div>
            <div className="text-amber-700 text-[10px] uppercase tracking-widest mb-2">
              {p.cargo}
            </div>
            <div className="text-stone-500 text-xs mb-3 leading-relaxed">{p.formacao}</div>
            <div className="text-stone-700 text-xs leading-relaxed border-t border-stone-100 pt-3">
              {p.foco}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-stone-900 text-stone-100 mt-8 p-8">
        <p
          className="text-amber-500 text-xs uppercase tracking-widest mb-2"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Estrutura societária
        </p>
        <p className="text-sm text-stone-300 leading-relaxed max-w-3xl">
          A Complexo DMC LTDA opera com sócios responsáveis por cada vertical
          (Originação, Investimentos, Jurídico, Compliance) e mantém contratos
          vinculantes com avaliadores credenciados IBAPE/SP, escritórios de
          advocacia parceiros e empresas de due diligence ambiental.
        </p>
      </div>
    </section>
  );
}

/* ===================== SEÇÃO: PARA FUNDOS ===================== */
function ParaFundos({ kpis }) {
  return (
    <section>
      <SectionHeader
        sobrescrito="Investor Relations"
        titulo="Por que fundos contratam a Complexo DMC"
        subtitulo="Material institucional preparado para gestoras, FIIs, fundos restritos e family offices."
      />

      {/* Hero pitch */}
      <div className="bg-stone-900 text-stone-100 p-10 mb-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-amber-500 text-[10px] uppercase tracking-[0.3em] mb-3">
              Tese Resumida
            </p>
            <h3
              className="text-3xl font-light leading-tight mb-5"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Originação proprietária + due diligence completa antes do fundo
              precisar tomar decisão.
            </h3>
            <p className="text-stone-400 text-sm leading-relaxed">
              Entregamos ao comitê do fundo apenas ativos que já passaram por
              filtro técnico, jurídico, financeiro e ambiental. O fundo recebe
              o memorando completo e decide com convicção.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border-l-2 border-amber-600 pl-4">
              <div className="text-3xl font-light text-amber-400" style={{ fontFamily: "Georgia, serif" }}>
                {fmtBRL(kpis.total).replace("R$\u00a0", "R$ ")}
              </div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-1">
                Em prospecção
              </div>
            </div>
            <div className="border-l-2 border-amber-600 pl-4">
              <div className="text-3xl font-light text-amber-400" style={{ fontFamily: "Georgia, serif" }}>
                {kpis.qtd}
              </div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-1">
                Ativos no portfólio
              </div>
            </div>
            <div className="border-l-2 border-amber-600 pl-4">
              <div className="text-3xl font-light text-amber-400" style={{ fontFamily: "Georgia, serif" }}>
                {kpis.capMedio.toFixed(1)}%
              </div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-1">
                Cap rate médio
              </div>
            </div>
            <div className="border-l-2 border-amber-600 pl-4">
              <div className="text-3xl font-light text-amber-400" style={{ fontFamily: "Georgia, serif" }}>
                28
              </div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-1">
                Itens de DD por ativo
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diferenciais */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {[
          {
            icon: Target,
            titulo: "Originação proprietária",
            txt: "Acesso direto a vendedores institucionais. Não dependemos de listagens públicas — 70% do nosso pipeline é off-market.",
          },
          {
            icon: ShieldCheck,
            titulo: "Due diligence pré-comitê",
            txt: "Entregamos o ativo com checklist 100% cumprido, laudos NBR e parecer jurídico. O fundo não absorve risco de processo.",
          },
          {
            icon: Award,
            titulo: "Alinhamento de incentivos",
            txt: "Comissionamento atrelado ao closing efetivo. Sem êxito da operação, não há remuneração da intermediação.",
          },
          {
            icon: Layers,
            titulo: "Estruturação via SPE",
            txt: "Cada ativo em SPE dedicada, com contabilidade segregada, facilitando exit individual ou em portfólio.",
          },
          {
            icon: TrendingUp,
            titulo: "Tese de exit declarada",
            txt: "Toda aquisição já entra no comitê com tese de saída em 5–7 anos: venda a investidor estratégico, FII listado ou securitização.",
          },
          {
            icon: Briefcase,
            titulo: "Confidencialidade total",
            txt: "NDAs com cláusula de não-circumvent, dataroom virtual com auditoria de acesso e segregação por gestor interessado.",
          },
        ].map((d, i) => {
          const Icon = d.icon;
          return (
            <div key={i} className="bg-white border border-stone-200 p-6">
              <Icon size={22} className="text-amber-700 mb-3" />
              <div
                className="text-stone-900 text-base mb-2"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {d.titulo}
              </div>
              <p className="text-stone-600 text-sm leading-relaxed">{d.txt}</p>
            </div>
          );
        })}
      </div>

      {/* Como contratar */}
      <div className="bg-white border-2 border-stone-900 p-8">
        <p
          className="text-amber-700 text-[10px] uppercase tracking-[0.3em] mb-2"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Próximos passos
        </p>
        <h3
          className="text-2xl font-light mb-6"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Como o seu fundo contrata a Complexo DMC
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { n: "01", t: "NDA", d: "Assinatura de confidencialidade mútua." },
            { n: "02", t: "Mandato", d: "Definição de tese e ticket-alvo do fundo." },
            { n: "03", t: "Curadoria", d: "Apresentação de ativos compatíveis pré-DD." },
            { n: "04", t: "Closing", d: "Estruturação, comitê do fundo e assinatura." },
          ].map((p) => (
            <div key={p.n} className="border-l-2 border-amber-700 pl-4">
              <div
                className="text-amber-700 text-3xl font-light mb-1"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {p.n}
              </div>
              <div className="text-stone-900 text-sm font-medium uppercase tracking-wider mb-1">
                {p.t}
              </div>
              <div className="text-stone-600 text-xs">{p.d}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-stone-900 font-medium">Fale com Investor Relations</div>
            <div className="text-stone-600 text-sm">Marina Oliveira · ri@complexodmc.com.br</div>
          </div>
          <button className="bg-stone-900 hover:bg-stone-800 text-stone-100 px-6 py-3 text-xs uppercase tracking-widest flex items-center gap-2">
            Agendar Reunião <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ===================== MODAL DE IMÓVEL ===================== */
function ModalImovel({ imovel, onClose }) {
  const parc = PARCEIROS[imovel.parceiro];
  return (
    <div
      className="fixed inset-0 bg-stone-900/70 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-stone-900 text-stone-100 p-6 flex justify-between items-start">
          <div>
            <div className="text-amber-500 text-[10px] uppercase tracking-[0.3em] mb-2">
              Memorando do Ativo · {imovel.id}
            </div>
            <h3
              className="text-2xl font-light leading-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {imovel.nome}
            </h3>
            <div className="text-stone-400 text-sm mt-1">
              {fmtEnderecoCompleto(imovel)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] px-3 py-1 border uppercase tracking-wider ${corStatus(
                imovel.status
              )}`}
            >
              {imovel.status}
            </span>
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <span
                className="inline-block w-2 h-2"
                style={{ background: parc.cor }}
              />
              {parc.nome}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetalheItem label="Tipologia" valor={imovel.tipo} />
            <DetalheItem label="Área" valor={`${fmtNumero(imovel.area)} m²`} />
            <DetalheItem label="Valor de venda" valor={fmtBRL(imovel.valor)} destaque />
            <DetalheItem
              label="Cap rate"
              valor={imovel.capRate ? `${imovel.capRate.toFixed(2)}%` : "—"}
            />
            <DetalheItem
              label="Ocupação"
              valor={imovel.ocupacao != null ? `${imovel.ocupacao}%` : "—"}
            />
            <DetalheItem
              label="Inquilinos"
              valor={imovel.inquilinos != null ? imovel.inquilinos : "—"}
            />
            <DetalheItem
              label="Ano de construção"
              valor={imovel.anoConstrucao || "—"}
            />
            <DetalheItem label="Status na esteira" valor={imovel.status} />
            <DetalheItem
              label="Valor por m²"
              valor={fmtBRL(Math.round(imovel.valor / imovel.area))}
            />
          </div>

          {/* Bloco financeiro de locação — só renderiza se tiver dados */}
          {(imovel.valorLocacaoMensal ||
            imovel.iptuAnual ||
            imovel.condominioMensal ||
            imovel.pacoteLocacaoMensal) && (
            <div className="border-t border-stone-200 pt-5">
              <div
                className="text-xs uppercase tracking-widest text-stone-500 mb-3"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Estrutura de locação (mensal)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DetalheItem
                  label="Aluguel"
                  valor={
                    imovel.valorLocacaoMensal
                      ? fmtBRL(imovel.valorLocacaoMensal)
                      : "—"
                  }
                />
                <DetalheItem
                  label="IPTU"
                  valor={
                    imovel.iptuAnual ? fmtBRL(Math.round(imovel.iptuAnual / 12)) : "—"
                  }
                />
                <DetalheItem
                  label="Condomínio"
                  valor={
                    imovel.condominioMensal ? fmtBRL(imovel.condominioMensal) : "—"
                  }
                />
                <DetalheItem
                  label="Pacote total"
                  valor={
                    imovel.pacoteLocacaoMensal
                      ? fmtBRL(imovel.pacoteLocacaoMensal)
                      : "—"
                  }
                  destaque
                />
              </div>
            </div>
          )}

          {/* Endereço completo + matrícula */}
          {(imovel.endereco || imovel.matricula || imovel.url) && (
            <div className="border-t border-stone-200 pt-5 grid md:grid-cols-2 gap-4">
              {imovel.endereco && (
                <DetalheItem label="Endereço" valor={imovel.endereco} />
              )}
              {imovel.matricula && (
                <DetalheItem label="Matrícula" valor={imovel.matricula} />
              )}
              {imovel.url && (
                <div className="md:col-span-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                    Fonte do anúncio
                  </div>
                  <a
                    href={imovel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-amber-700 hover:text-amber-800 underline break-all"
                  >
                    {imovel.url}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Observações livres */}
          {imovel.observacoes && (
            <div className="border-t border-stone-200 pt-5">
              <div
                className="text-xs uppercase tracking-widest text-stone-500 mb-2"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Observações
              </div>
              <p className="text-sm text-stone-700 leading-relaxed">
                {imovel.observacoes}
              </p>
            </div>
          )}

          <div className="border-t border-stone-200 pt-5">
            <div
              className="text-xs uppercase tracking-widest text-stone-500 mb-3"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Próximas ações
            </div>
            <div className="space-y-2 text-sm text-stone-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Documentação cartorial recebida
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Laudo NBR 14653 contratado
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-600" />
                Due diligence ambiental Fase I em andamento
              </div>
              <div className="flex items-center gap-2">
                <Circle size={14} className="text-stone-400" />
                Apresentação ao comitê — pendente
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="flex-1 bg-stone-900 hover:bg-stone-800 text-stone-100 py-3 text-xs uppercase tracking-widest flex items-center justify-center gap-2">
              <Download size={14} /> Memorando completo
            </button>
            <button className="flex-1 border-2 border-stone-900 text-stone-900 hover:bg-stone-100 py-3 text-xs uppercase tracking-widest flex items-center justify-center gap-2">
              <Mail size={14} /> Solicitar visita
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalheItem({ label, valor, destaque }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">
        {label}
      </div>
      <div
        className={`text-sm ${destaque ? "text-amber-700 font-medium" : "text-stone-900"}`}
        style={destaque ? { fontFamily: "Georgia, serif", fontSize: "1.1rem" } : {}}
      >
        {valor}
      </div>
    </div>
  );
}
