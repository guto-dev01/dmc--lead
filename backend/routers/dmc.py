import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn

router = APIRouter()

# Estágios da esteira de aquisição (ordem importa para o kanban)
ESTEIRA = [
    "Originação",
    "Análise Preliminar",
    "Due Diligence",
    "Avaliação & Estruturação",
    "Negociação",
    "Comitê de Investimento",
    "Closing",
]


def _uuid(v):
    if not v:
        return None
    return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))


def cap_rate_calc(row: dict) -> Optional[float]:
    """Cap rate informado, ou estimado por (locação anual / valor de venda)."""
    if row.get("cap_rate") not in (None, 0):
        return float(row["cap_rate"])
    venda = row.get("valor_venda")
    loc = row.get("valor_locacao")
    if venda and loc and float(venda) > 0:
        return round((float(loc) * 12) / float(venda) * 100, 2)
    return None


class Parceiro(BaseModel):
    nome: str
    sigla: Optional[str] = None
    cor: Optional[str] = "#00e7fc"
    creci: Optional[str] = None


class Empreendimento(BaseModel):
    nome: str
    tipologia: Optional[str] = None
    parceiro_id: Optional[str] = None
    prospector: Optional[str] = None
    status: Optional[str] = "Originação"
    cidade: Optional[str] = None
    uf: Optional[str] = None
    bairro: Optional[str] = None
    endereco: Optional[str] = None
    cep: Optional[str] = None
    area_terreno: Optional[float] = None
    area_construida: Optional[float] = None
    valor_venda: Optional[float] = None
    valor_locacao: Optional[float] = None
    iptu: Optional[float] = None
    condominio: Optional[float] = None
    cap_rate: Optional[float] = None
    ocupacao: Optional[float] = None
    inquilinos: Optional[int] = None
    ano_construcao: Optional[int] = None
    matricula: Optional[str] = None
    cartorio: Optional[str] = None
    inscricao_imobiliaria: Optional[str] = None
    zoneamento: Optional[str] = None
    url_fonte: Optional[str] = None
    foto_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    observacoes: Optional[str] = None


EMP_COLS = [
    "nome", "tipologia", "parceiro_id", "prospector", "status", "cidade", "uf",
    "bairro", "endereco", "cep", "area_terreno", "area_construida", "valor_venda",
    "valor_locacao", "iptu", "condominio", "cap_rate", "ocupacao", "inquilinos",
    "ano_construcao", "matricula", "cartorio", "inscricao_imobiliaria", "zoneamento",
    "url_fonte", "foto_url", "lat", "lng", "observacoes",
]


def _emp_values(body: Empreendimento) -> list:
    d = body.model_dump()
    vals = []
    for c in EMP_COLS:
        v = d.get(c)
        if c == "parceiro_id":
            v = _uuid(v)
        vals.append(v)
    return vals


async def _proximo_codigo(conn) -> str:
    n = await conn.fetchval("SELECT COUNT(*) FROM dmc_empreendimentos")
    return f"DMC-{int(n) + 1:03d}"


def _emp_dict(r) -> dict:
    d = dict(r)
    d["cap_rate_efetivo"] = cap_rate_calc(d)
    return d


# ----------------------- PARCEIROS -----------------------
@router.get("/parceiros")
async def listar_parceiros():
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """SELECT p.*, (SELECT COUNT(*) FROM dmc_empreendimentos e WHERE e.parceiro_id = p.id) AS total
               FROM dmc_parceiros p ORDER BY p.nome"""
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.post("/parceiros")
async def criar_parceiro(body: Parceiro):
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            "INSERT INTO dmc_parceiros (nome, sigla, cor, creci) VALUES ($1,$2,$3,$4) RETURNING *",
            body.nome, body.sigla, body.cor or "#00e7fc", body.creci,
        )
        return dict(row)
    finally:
        await conn.close()


@router.delete("/parceiros/{parceiro_id}")
async def excluir_parceiro(parceiro_id: str):
    conn = await get_conn()
    try:
        await conn.execute("DELETE FROM dmc_parceiros WHERE id = $1", _uuid(parceiro_id))
        return {"ok": True}
    finally:
        await conn.close()


# ----------------------- EMPREENDIMENTOS -----------------------
@router.get("/empreendimentos")
async def listar_empreendimentos(
    status: Optional[str] = None,
    parceiro_id: Optional[str] = None,
    tipologia: Optional[str] = None,
    busca: Optional[str] = None,
):
    conn = await get_conn()
    try:
        where, params, i = [], [], 1
        if status:
            where.append(f"e.status = ${i}"); params.append(status); i += 1
        if parceiro_id:
            where.append(f"e.parceiro_id = ${i}"); params.append(_uuid(parceiro_id)); i += 1
        if tipologia:
            where.append(f"e.tipologia ILIKE ${i}"); params.append(f"%{tipologia}%"); i += 1
        if busca:
            where.append(f"(e.nome ILIKE ${i} OR e.cidade ILIKE ${i} OR e.codigo ILIKE ${i})")
            params.append(f"%{busca}%"); i += 1
        where_sql = "WHERE " + " AND ".join(where) if where else ""
        rows = await conn.fetch(
            f"""SELECT e.*, p.nome AS parceiro_nome, p.sigla AS parceiro_sigla, p.cor AS parceiro_cor
                FROM dmc_empreendimentos e
                LEFT JOIN dmc_parceiros p ON p.id = e.parceiro_id
                {where_sql}
                ORDER BY e.created_at DESC""",
            *params,
        )
        return [_emp_dict(r) for r in rows]
    finally:
        await conn.close()


@router.post("/empreendimentos")
async def criar_empreendimento(body: Empreendimento):
    conn = await get_conn()
    try:
        codigo = await _proximo_codigo(conn)
        cols = ["codigo"] + EMP_COLS
        placeholders = ", ".join(f"${n}" for n in range(1, len(cols) + 1))
        row = await conn.fetchrow(
            f"INSERT INTO dmc_empreendimentos ({', '.join(cols)}) VALUES ({placeholders}) RETURNING *",
            codigo, *_emp_values(body),
        )
        return _emp_dict(row)
    finally:
        await conn.close()


@router.post("/empreendimentos/importar-empresas")
async def importar_empresas():
    """Copia todas as empresas cadastradas para a base de empreendimentos.
    Mapeia os campos equivalentes e pula empresas que já foram importadas
    (mesmo nome), então pode ser executado várias vezes sem duplicar."""
    conn = await get_conn()
    try:
        empresas = await conn.fetch("SELECT * FROM empresas ORDER BY nome")
        existentes = await conn.fetch("SELECT LOWER(nome) AS nome FROM dmc_empreendimentos")
        ja = {r["nome"] for r in existentes if r["nome"]}

        criados = 0
        pulados = 0
        for e in empresas:
            d = dict(e)
            nome = (d.get("nome") or "").strip()
            if not nome or nome.lower() in ja:
                pulados += 1
                continue

            endereco = ", ".join(
                str(p) for p in (d.get("logradouro"), d.get("numero")) if p
            ) or None
            obs_partes = [d.get("observacoes")]
            if d.get("cnpj"):
                obs_partes.append(f"CNPJ: {d['cnpj']}")
            if d.get("website"):
                obs_partes.append(f"Site: {d['website']}")
            observacoes = "\n".join(str(p) for p in obs_partes if p) or None

            codigo = await _proximo_codigo(conn)
            await conn.execute(
                """INSERT INTO dmc_empreendimentos
                   (codigo, nome, tipologia, status, cidade, uf, bairro, endereco, cep,
                    url_fonte, lat, lng, observacoes)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)""",
                codigo, nome, d.get("tipo"), "Originação",
                d.get("municipio"), d.get("uf"), d.get("bairro"), endereco, d.get("cep"),
                d.get("website"), d.get("lat"), d.get("lng"), observacoes,
            )
            ja.add(nome.lower())
            criados += 1

        return {"criados": criados, "pulados": pulados, "total_empresas": len(empresas)}
    finally:
        await conn.close()


@router.put("/empreendimentos/{emp_id}")
async def atualizar_empreendimento(emp_id: str, body: Empreendimento):
    conn = await get_conn()
    try:
        sets = ", ".join(f"{c} = ${idx}" for idx, c in enumerate(EMP_COLS, start=1))
        params = _emp_values(body) + [_uuid(emp_id)]
        row = await conn.fetchrow(
            f"UPDATE dmc_empreendimentos SET {sets}, updated_at = NOW() WHERE id = ${len(EMP_COLS)+1} RETURNING *",
            *params,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Empreendimento não encontrado")
        return _emp_dict(row)
    finally:
        await conn.close()


@router.delete("/empreendimentos/{emp_id}")
async def excluir_empreendimento(emp_id: str):
    conn = await get_conn()
    try:
        await conn.execute("DELETE FROM dmc_empreendimentos WHERE id = $1", _uuid(emp_id))
        return {"ok": True}
    finally:
        await conn.close()


# ----------------------- RESUMO / KPIs -----------------------
@router.get("/summary")
async def resumo():
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """SELECT e.*, p.nome AS parceiro_nome, p.cor AS parceiro_cor
               FROM dmc_empreendimentos e LEFT JOIN dmc_parceiros p ON p.id = e.parceiro_id"""
        )
        itens = [_emp_dict(r) for r in rows]
        total_valor = sum(float(x["valor_venda"]) for x in itens if x.get("valor_venda"))
        area_total = sum(
            float(x.get("area_construida") or x.get("area_terreno") or 0) for x in itens
        )
        caps = [x["cap_rate_efetivo"] for x in itens if x.get("cap_rate_efetivo")]
        cap_medio = round(sum(caps) / len(caps), 2) if caps else 0
        em_closing = sum(
            1 for x in itens
            if x.get("status") in ("Closing", "Comitê de Investimento", "Negociação")
        )
        por_tipo, por_parceiro, por_status = {}, {}, {}
        for x in itens:
            t = x.get("tipologia") or "Não informado"
            por_tipo[t] = por_tipo.get(t, 0) + 1
            p = x.get("parceiro_nome") or "Sem parceiro"
            por_parceiro[p] = por_parceiro.get(p, 0) + 1
            s = x.get("status") or "Originação"
            por_status[s] = por_status.get(s, 0) + 1
        return {
            "qtd": len(itens),
            "total_valor": total_valor,
            "area_total": area_total,
            "cap_medio": cap_medio,
            "em_closing": em_closing,
            "por_tipo": [{"label": k, "total": v} for k, v in sorted(por_tipo.items(), key=lambda kv: -kv[1])],
            "por_parceiro": [{"label": k, "total": v} for k, v in sorted(por_parceiro.items(), key=lambda kv: -kv[1])],
            "por_status": por_status,
            "esteira": ESTEIRA,
        }
    finally:
        await conn.close()
