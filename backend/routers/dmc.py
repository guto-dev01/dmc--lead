from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db, new_id, now, serialize, like
from services.auth import conta_atual

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


def _emp_doc(body: Empreendimento) -> dict:
    """Campos do empreendimento (subset EMP_COLS) a partir do payload."""
    d = body.model_dump()
    return {c: d.get(c) for c in EMP_COLS}


async def _proximo_codigo(db, conta_id) -> str:
    n = await db.dmc_empreendimentos.count_documents({"conta_id": conta_id})
    return f"DMC-{int(n) + 1:03d}"


def _emp_dict(r: dict, parceiros: dict) -> dict:
    """Serializa o empreendimento, anexa dados do parceiro e o cap rate efetivo."""
    d = serialize(r)
    p = parceiros.get(d.get("parceiro_id"))
    d["parceiro_nome"] = p["nome"] if p else None
    d["parceiro_sigla"] = p.get("sigla") if p else None
    d["parceiro_cor"] = p.get("cor") if p else None
    d["cap_rate_efetivo"] = cap_rate_calc(d)
    return d


async def _parceiros_map(db, conta_id) -> dict:
    parceiros = await db.dmc_parceiros.find({"conta_id": conta_id}).to_list(length=None)
    return {p["_id"]: p for p in parceiros}


# ----------------------- PARCEIROS -----------------------
@router.get("/parceiros")
async def listar_parceiros(conta_id: str = Depends(conta_atual)):
    db = get_db()
    parceiros = await db.dmc_parceiros.find({"conta_id": conta_id}).sort("nome", 1).to_list(length=None)
    contagem = await (await db.dmc_empreendimentos.aggregate([
        {"$match": {"conta_id": conta_id}},
        {"$group": {"_id": "$parceiro_id", "n": {"$sum": 1}}},
    ])).to_list(length=None)
    total_map = {c["_id"]: c["n"] for c in contagem}
    out = []
    for p in parceiros:
        d = serialize(p)
        d["total"] = total_map.get(d["id"], 0)
        out.append(d)
    return out


@router.post("/parceiros")
async def criar_parceiro(body: Parceiro, conta_id: str = Depends(conta_atual)):
    db = get_db()
    doc = {
        "_id": new_id(), "conta_id": conta_id, "nome": body.nome, "sigla": body.sigla,
        "cor": body.cor or "#00e7fc", "creci": body.creci, "created_at": now(),
    }
    await db.dmc_parceiros.insert_one(doc)
    return serialize(doc)


@router.delete("/parceiros/{parceiro_id}")
async def excluir_parceiro(parceiro_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    # equivale ao ON DELETE SET NULL: desvincula os empreendimentos do parceiro
    await db.dmc_empreendimentos.update_many(
        {"parceiro_id": parceiro_id, "conta_id": conta_id}, {"$set": {"parceiro_id": None}}
    )
    await db.dmc_parceiros.delete_one({"_id": parceiro_id, "conta_id": conta_id})
    return {"ok": True}


# ----------------------- EMPREENDIMENTOS -----------------------
@router.get("/empreendimentos")
async def listar_empreendimentos(
    status: Optional[str] = None,
    parceiro_id: Optional[str] = None,
    tipologia: Optional[str] = None,
    busca: Optional[str] = None,
    conta_id: str = Depends(conta_atual),
):
    db = get_db()
    filtro: dict = {"conta_id": conta_id}
    if status:
        filtro["status"] = status
    if parceiro_id:
        filtro["parceiro_id"] = parceiro_id
    if tipologia:
        filtro["tipologia"] = like(tipologia)
    if busca:
        filtro["$or"] = [{"nome": like(busca)}, {"cidade": like(busca)}, {"codigo": like(busca)}]

    rows = await db.dmc_empreendimentos.find(filtro).sort("created_at", -1).to_list(length=None)
    parceiros = await _parceiros_map(db, conta_id)
    return [_emp_dict(r, parceiros) for r in rows]


@router.post("/empreendimentos")
async def criar_empreendimento(body: Empreendimento, conta_id: str = Depends(conta_atual)):
    db = get_db()
    doc = {"_id": new_id(), "conta_id": conta_id, "codigo": await _proximo_codigo(db, conta_id), **_emp_doc(body),
           "created_at": now(), "updated_at": now()}
    await db.dmc_empreendimentos.insert_one(doc)
    parceiros = await _parceiros_map(db, conta_id)
    return _emp_dict(doc, parceiros)


@router.post("/empreendimentos/importar-empresas")
async def importar_empresas(conta_id: str = Depends(conta_atual)):
    """Copia todas as empresas cadastradas para a base de empreendimentos.
    Mapeia os campos equivalentes e pula empresas que já foram importadas
    (mesmo nome), então pode ser executado várias vezes sem duplicar."""
    db = get_db()
    empresas = await db.empresas.find({"conta_id": conta_id}).sort("nome", 1).to_list(length=None)
    existentes = await db.dmc_empreendimentos.find({"conta_id": conta_id}, {"nome": 1}).to_list(length=None)
    ja = {(r.get("nome") or "").lower() for r in existentes if r.get("nome")}

    criados = 0
    pulados = 0
    for d in empresas:
        nome = (d.get("nome") or "").strip()
        if not nome or nome.lower() in ja:
            pulados += 1
            continue

        endereco = ", ".join(str(p) for p in (d.get("logradouro"), d.get("numero")) if p) or None
        obs_partes = [d.get("observacoes")]
        if d.get("cnpj"):
            obs_partes.append(f"CNPJ: {d['cnpj']}")
        if d.get("website"):
            obs_partes.append(f"Site: {d['website']}")
        observacoes = "\n".join(str(p) for p in obs_partes if p) or None

        doc = {
            "_id": new_id(), "conta_id": conta_id, "codigo": await _proximo_codigo(db, conta_id),
            "nome": nome, "tipologia": d.get("tipo"), "status": "Originação",
            "cidade": d.get("municipio"), "uf": d.get("uf"), "bairro": d.get("bairro"),
            "endereco": endereco, "cep": d.get("cep"), "url_fonte": d.get("website"),
            "lat": d.get("lat"), "lng": d.get("lng"), "observacoes": observacoes,
            "created_at": now(), "updated_at": now(),
        }
        await db.dmc_empreendimentos.insert_one(doc)
        ja.add(nome.lower())
        criados += 1

    return {"criados": criados, "pulados": pulados, "total_empresas": len(empresas)}


@router.put("/empreendimentos/{emp_id}")
async def atualizar_empreendimento(emp_id: str, body: Empreendimento, conta_id: str = Depends(conta_atual)):
    db = get_db()
    row = await db.dmc_empreendimentos.find_one_and_update(
        {"_id": emp_id, "conta_id": conta_id}, {"$set": {**_emp_doc(body), "updated_at": now()}}, return_document=True
    )
    if not row:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")
    parceiros = await _parceiros_map(db, conta_id)
    return _emp_dict(row, parceiros)


@router.delete("/empreendimentos/{emp_id}")
async def excluir_empreendimento(emp_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    await db.dmc_empreendimentos.delete_one({"_id": emp_id, "conta_id": conta_id})
    return {"ok": True}


# ----------------------- RESUMO / KPIs -----------------------
@router.get("/summary")
async def resumo(conta_id: str = Depends(conta_atual)):
    db = get_db()
    rows = await db.dmc_empreendimentos.find({"conta_id": conta_id}).to_list(length=None)
    parceiros = await _parceiros_map(db, conta_id)
    itens = [_emp_dict(r, parceiros) for r in rows]
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
