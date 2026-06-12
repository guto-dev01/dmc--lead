import json
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import asyncio, httpx
from database import get_db, new_id, now, serialize, like, ieq
from services.auth import require_auth, conta_atual
from services.atividades import registrar
from services.ramos import normalizar_ramo


def _autor(user) -> Optional[str]:
    """Login/e-mail do usuário autenticado (para atribuição de produtividade)."""
    return (user or {}).get("sub") if isinstance(user, dict) else None
from services.cnpj_enrichment import (
    calculate_completeness_score,
    clean_cnpj,
    fetch_cnpj_data,
    search_cnpj_by_name,
    descobrir_whatsapp,
    descobrir_emails,
    melhor_email_empresa,
    casar_email_dono,
)

router = APIRouter()


def _filtro_ramo(ramo: Optional[str]):
    """Valor de filtro Mongo para o campo `ramo` (sempre normalizado).

    O backfill em ensure_schema() marca todos os docs antigos com o ramo padrão,
    então uma igualdade simples basta após a subida do app."""
    return normalizar_ramo(ramo)


async def log_atividade(db, empresa_id: str, tipo: str, descricao: str, dados=None, autor=None, conta_id=None):
    await registrar(db, tipo, autor=autor, descricao=descricao, empresa_id=empresa_id, dados=dados, conta_id=conta_id)


def _coalesce(*vals):
    """Primeiro valor não-nulo (equivale ao COALESCE do SQL)."""
    for v in vals:
        if v is not None:
            return v
    return None


async def salvar_dados_cnpj(db, empresa_id: str, data: dict, cnpj_origem: Optional[str] = None, conta_id: Optional[str] = None):
    cnpj_valor = clean_cnpj(cnpj_origem or data.get("cnpj") or "") or None
    cnae_principal = data.get("cnae_principal")
    if cnae_principal is not None:
        cnae_principal = str(cnae_principal)

    filtro = {"_id": empresa_id}
    if conta_id is not None:
        filtro["conta_id"] = conta_id
    atual = await db.empresas.find_one(filtro) or {}
    novo = {
        "cnpj": _coalesce(cnpj_valor, atual.get("cnpj")),
        "razao_social": _coalesce(data.get("razao_social"), atual.get("razao_social"), atual.get("nome")),
        "nome_fantasia": _coalesce(data.get("nome_fantasia"), atual.get("nome_fantasia")),
        "situacao_cadastral": data.get("situacao_cadastral"),
        "data_abertura": data.get("data_abertura"),
        "natureza_juridica": data.get("natureza_juridica"),
        "porte": data.get("porte"),
        "capital_social": data.get("capital_social"),
        "cnaes_principal": cnae_principal,
        "descricao_cnae": data.get("cnae_descricao"),
        "logradouro": data.get("logradouro"),
        "numero": data.get("numero"),
        "complemento": data.get("complemento"),
        "bairro": data.get("bairro"),
        "municipio": data.get("municipio"),
        "uf": data.get("uf"),
        "cep": data.get("cep"),
        "email": _coalesce(data.get("email"), atual.get("email")),
        "telefone": _coalesce(data.get("telefone"), atual.get("telefone")),
        "telefone2": _coalesce(data.get("telefone2"), atual.get("telefone2")),
        "whatsapp": _coalesce(whatsapp_normalizado(data.get("whatsapp")), atual.get("whatsapp")),
        "dados_cnpj": data,
        "cnpj_fonte": data.get("fonte"),
        "cnpj_enriquecido_em": now(),
        "score": calculate_completeness_score(data),
        "updated_at": now(),
    }
    row = await db.empresas.find_one_and_update(
        filtro, {"$set": novo}, return_document=True
    )
    return serialize(row)


def whatsapp_normalizado(valor):
    """Formata o whatsapp (so digitos, com 55) para salvar; None se vazio."""
    if not valor:
        return None
    digs = "".join(ch for ch in str(valor) if ch.isdigit())
    return digs or None

class EmpresaCreate(BaseModel):
    nome: str
    cnpj: Optional[str] = None
    tipo: Optional[str] = None
    ramo: Optional[str] = None
    regiao: Optional[str] = None
    bairro: Optional[str] = None
    municipio: Optional[str] = "São Paulo"
    uf: Optional[str] = "SP"
    email: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    website: Optional[str] = None
    observacoes: Optional[str] = None
    tags: Optional[List[str]] = []

class EmpresaUpdate(BaseModel):
    nome: Optional[str] = None
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    tipo: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    website: Optional[str] = None
    observacoes: Optional[str] = None
    tags: Optional[List[str]] = None
    situacao_cadastral: Optional[str] = None
    data_abertura: Optional[str] = None
    natureza_juridica: Optional[str] = None
    porte: Optional[str] = None
    capital_social: Optional[float] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    municipio: Optional[str] = None
    cep: Optional[str] = None
    score: Optional[int] = None
    # Prospecção (planilha DMC)
    eixo: Optional[str] = None
    cargo_alvo: Optional[str] = None
    status_prospeccao: Optional[str] = None
    prioridade: Optional[str] = None
    proxima_acao: Optional[str] = None
    data_agendada: Optional[str] = None
    sindico: Optional[str] = None
    tel_sindico: Optional[str] = None
    zelador: Optional[str] = None
    tel_portaria: Optional[str] = None
    administradora: Optional[str] = None
    tel_administradora: Optional[str] = None
    linkedin: Optional[str] = None


class EnrichBatchRequest(BaseModel):
    only_missing: bool = True
    force: bool = False
    limit: Optional[int] = None

@router.get("")
async def listar_empresas(
    tipo: Optional[str] = None,
    ramo: Optional[str] = None,
    busca: Optional[str] = None,
    regiao: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    conta_id: str = Depends(conta_atual),
):
    db = get_db()
    filtro: dict = {"conta_id": conta_id}
    if ramo:
        filtro["ramo"] = _filtro_ramo(ramo)
    if tipo:
        filtro["tipo"] = tipo
    if busca:
        filtro["$or"] = [{"nome": like(busca)}, {"cnpj": like(busca)}]
    if regiao:
        filtro["regiao"] = like(regiao)

    total = await db.empresas.count_documents(filtro)
    rows = await (
        db.empresas.find(filtro)
        .sort([("score", -1), ("created_at", -1)])
        .skip(offset)
        .limit(limit)
        .to_list(length=limit)
    )
    items = [serialize(r) for r in rows]

    # contagens de conversas/contatos por empresa (substitui os subselects)
    ids = [i["id"] for i in items]
    if ids:
        conv = await (await db.conversas.aggregate([
            {"$match": {"empresa_id": {"$in": ids}}},
            {"$group": {"_id": "$empresa_id", "n": {"$sum": 1}}},
        ])).to_list(length=None)
        cont = await (await db.contatos.aggregate([
            {"$match": {"empresa_id": {"$in": ids}}},
            {"$group": {"_id": "$empresa_id", "n": {"$sum": 1}}},
        ])).to_list(length=None)
        conv_map = {c["_id"]: c["n"] for c in conv}
        cont_map = {c["_id"]: c["n"] for c in cont}
        for i in items:
            i["total_conversas"] = conv_map.get(i["id"], 0)
            i["total_contatos"] = cont_map.get(i["id"], 0)

    return {"total": total, "items": items, "limit": limit, "offset": offset}


NOMINATIM = "https://nominatim.openstreetmap.org/search"


def _bairro_municipio_uf(r: dict):
    # usa bairro; se faltar, cai p/ a 1ª parte da regiao (ex.: "Consolação/Jardins" -> "Consolação")
    bairro = r.get("bairro") or ((r.get("regiao") or "").split("/")[0].strip() or None)
    municipio = r.get("municipio") or ("São Paulo" if bairro else None)
    uf = r.get("uf") or ("SP" if bairro else None)
    return bairro, municipio, uf


def _queries_geocode(r: dict) -> list:
    """Tenta do mais específico ao mais genérico (logradouro -> bairro -> cidade)."""
    bairro, municipio, uf = _bairro_municipio_uf(r)
    full = [r.get("logradouro"), r.get("numero"), bairro, municipio, uf]
    simples = [bairro, municipio, uf]
    out, vistos = [], set()
    for partes in (full, simples):
        base = ", ".join(str(p) for p in partes if p)
        q = (base + ", Brasil") if base else ""
        if q and q not in vistos:
            vistos.add(q); out.append(q)
    return out


@router.get("/geo")
async def empresas_geo(ramo: Optional[str] = None, conta_id: str = Depends(conta_atual)):
    """Empresas com coordenadas + status, para o Mapa (filtra pelo ramo ativo)."""
    db = get_db()
    filtro: dict = {"conta_id": conta_id}
    if ramo:
        filtro["ramo"] = _filtro_ramo(ramo)
    proj = {
        "nome": 1, "tipo": 1, "status_prospeccao": 1, "lat": 1, "lng": 1, "bairro": 1,
        "municipio": 1, "uf": 1, "logradouro": 1, "numero": 1, "telefone": 1, "whatsapp": 1, "website": 1,
    }
    rows = await db.empresas.find(filtro, proj).sort("nome", 1).to_list(length=None)
    itens = [serialize(r) for r in rows]
    sem = sum(1 for i in itens if not (i.get("lat") and i.get("lng")))
    return {
        "total": len(itens),
        "com_coords": len(itens) - sem,
        "sem_coords": sem,
        "empresas": itens,
    }


@router.post("/geocodificar")
async def geocodificar_empresas(limite: int = 80, conta_id: str = Depends(conta_atual)):
    """Geocodifica (OSM/Nominatim) as empresas sem coordenadas. Respeita 1 req/s."""
    db = get_db()
    filtro = {
        "conta_id": conta_id,
        "$or": [{"lat": None}, {"lng": None}],
        "$and": [{"$or": [
            {"logradouro": {"$nin": [None, ""]}},
            {"bairro": {"$nin": [None, ""]}},
            {"regiao": {"$nin": [None, ""]}},
            {"municipio": {"$nin": [None, ""]}},
        ]}],
    }
    rows = await db.empresas.find(
        filtro, {"logradouro": 1, "numero": 1, "bairro": 1, "regiao": 1, "municipio": 1, "uf": 1}
    ).limit(limite).to_list(length=limite)

    geocodificadas = 0
    headers = {"User-Agent": "ImobPro/1.0 (contato@complexodmc.com.br)"}
    async with httpx.AsyncClient(timeout=20, headers=headers) as client:
        for r in rows:
            queries = _queries_geocode(serialize(r))
            achou = None
            for q in queries:
                try:
                    resp = await client.get(
                        NOMINATIM,
                        params={"format": "json", "limit": 1, "countrycodes": "br", "q": q},
                    )
                    data = resp.json() if resp.status_code == 200 else []
                except Exception:
                    data = []
                await asyncio.sleep(1.1)  # política de uso do Nominatim (1 req/s)
                if data:
                    achou = data[0]
                    break
            if achou:
                await db.empresas.update_one(
                    {"_id": r["_id"], "conta_id": conta_id},
                    {"$set": {"lat": float(achou["lat"]), "lng": float(achou["lon"])}},
                )
                geocodificadas += 1
    restantes = await db.empresas.count_documents({"conta_id": conta_id, "$or": [{"lat": None}, {"lng": None}]})
    return {"ok": True, "geocodificadas": geocodificadas, "restantes": int(restantes)}


@router.get("/{empresa_id}")
async def obter_empresa(empresa_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    row = await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id})
    if not row:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    contatos = await db.contatos.find({"empresa_id": empresa_id}).sort("nome", 1).to_list(length=None)
    conversas = await db.conversas.find({"empresa_id": empresa_id}).sort("ultimo_contato", -1).to_list(length=None)
    atividades = await db.atividades.find({"empresa_id": empresa_id}).sort("created_at", -1).limit(20).to_list(length=20)

    conversas_out = []
    for cv in conversas:
        cv = serialize(cv)
        cv["total_mensagens"] = await db.mensagens.count_documents({"conversa_id": cv["id"]})
        conversas_out.append(cv)

    return {
        **serialize(row),
        "contatos": [serialize(c) for c in contatos],
        "conversas": conversas_out,
        "atividades": [serialize(a) for a in atividades],
    }


@router.post("")
async def criar_empresa(empresa: EmpresaCreate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    doc = {
        "_id": new_id(), "conta_id": conta_id,
        "nome": empresa.nome, "cnpj": empresa.cnpj, "tipo": empresa.tipo,
        "ramo": normalizar_ramo(empresa.ramo),
        "regiao": empresa.regiao, "bairro": empresa.bairro, "municipio": empresa.municipio,
        "uf": empresa.uf, "email": empresa.email, "telefone": empresa.telefone,
        "whatsapp": empresa.whatsapp, "website": empresa.website,
        "observacoes": empresa.observacoes, "tags": empresa.tags or [],
        "score": 0, "status_prospeccao": "nao_iniciado", "prioridade": "normal",
        "created_at": now(), "updated_at": now(),
    }
    await db.empresas.insert_one(doc)
    await log_atividade(db, doc["_id"], "empresa_criada",
                        f"Empresa \"{empresa.nome}\" cadastrada", autor=_autor(user), conta_id=conta_id)
    return serialize(doc)


@router.patch("/{empresa_id}")
async def atualizar_empresa(empresa_id: str, dados: EmpresaUpdate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    campos = {k: v for k, v in dados.model_dump().items() if v is not None}
    if not campos:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    campos["updated_at"] = now()

    anterior = await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id}, {"status_prospeccao": 1})
    row = await db.empresas.find_one_and_update(
        {"_id": empresa_id, "conta_id": conta_id}, {"$set": campos}, return_document=True
    )
    if not row:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    # Mudança de status de prospecção é um evento de produtividade real.
    novo_status = campos.get("status_prospeccao")
    if novo_status and anterior and novo_status != anterior.get("status_prospeccao"):
        await log_atividade(
            db, empresa_id, "status_alterado",
            f"Status de \"{row.get('nome','')}\" → {novo_status}",
            dados={"de": anterior.get("status_prospeccao"), "para": novo_status},
            autor=_autor(user), conta_id=conta_id,
        )
    return serialize(row)


@router.delete("/{empresa_id}")
async def deletar_empresa(empresa_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    # garante que a empresa é desta conta antes de remover dependentes
    if not await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    # cascata (no Postgres era via FK): remove dependentes e desvincula o mercado
    conversa_ids = [c["_id"] for c in await db.conversas.find(
        {"empresa_id": empresa_id}, {"_id": 1}
    ).to_list(length=None)]
    if conversa_ids:
        await db.mensagens.delete_many({"conversa_id": {"$in": conversa_ids}})
    await db.conversas.delete_many({"empresa_id": empresa_id})
    await db.contatos.delete_many({"empresa_id": empresa_id})
    await db.atividades.delete_many({"empresa_id": empresa_id})
    await db.campanha_itens.delete_many({"empresa_id": empresa_id})
    await db.mercado_itens.update_many({"empresa_id": empresa_id}, {"$set": {"empresa_id": None}})
    await db.empresas.delete_one({"_id": empresa_id, "conta_id": conta_id})
    return {"ok": True}


@router.post("/{empresa_id}/enrich-cnpj")
async def enriquecer_com_cnpj(empresa_id: str, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Busca dados da Receita Federal e atualiza a empresa"""
    db = get_db()
    empresa = await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id}, {"cnpj": 1, "nome": 1, "website": 1})
    if not empresa or not empresa.get("cnpj"):
        raise HTTPException(status_code=400, detail="Empresa sem CNPJ cadastrado")

    data = await fetch_cnpj_data(empresa["cnpj"])
    # Se a Receita nao trouxe um celular, tenta achar o WhatsApp no site da empresa
    if not data.get("whatsapp"):
        try:
            achado = await descobrir_whatsapp(empresa["nome"], empresa.get("website"))
            if achado and achado.get("whatsapp"):
                data["whatsapp"] = achado["whatsapp"]
                data["fonte_whatsapp"] = achado.get("fonte_whatsapp")
        except Exception:
            pass
    row = await salvar_dados_cnpj(db, empresa_id, data, empresa["cnpj"], conta_id=conta_id)
    await log_atividade(
        db, empresa_id, "enrich_cnpj",
        "Dados enriquecidos via Receita Federal",
        {"fonte": data.get("fonte"), "cnpj": data.get("cnpj")},
        autor=_autor(user), conta_id=conta_id,
    )

    return {
        "ok": True,
        "empresa": row,
        "qsa": data.get("qsa", []),
        "fonte": data.get("fonte"),
    }


@router.post("/{empresa_id}/discover-whatsapp")
async def descobrir_whatsapp_empresa(empresa_id: str, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Procura o WhatsApp da empresa no site e salva o numero encontrado."""
    db = get_db()
    empresa = await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id}, {"nome": 1, "website": 1, "whatsapp": 1})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    achado = await descobrir_whatsapp(empresa["nome"], empresa.get("website"))
    if not achado or not achado.get("whatsapp"):
        raise HTTPException(status_code=404, detail="Não foi possível descobrir um WhatsApp válido para esta empresa")

    whatsapp = whatsapp_normalizado(achado.get("whatsapp"))
    update = {"updated_at": now()}
    if whatsapp:
        update["whatsapp"] = whatsapp
    row = await db.empresas.find_one_and_update(
        {"_id": empresa_id, "conta_id": conta_id}, {"$set": update}, return_document=True
    )

    await log_atividade(
        db, empresa_id, "discover_whatsapp",
        "WhatsApp descoberto no site da empresa",
        {"whatsapp": whatsapp, "fonte_whatsapp": achado.get("fonte_whatsapp")},
        autor=_autor(user), conta_id=conta_id,
    )

    return {
        "ok": True,
        "empresa": serialize(row),
        "whatsapp": whatsapp,
        "fonte_whatsapp": achado.get("fonte_whatsapp"),
    }


class WhatsappBatchRequest(BaseModel):
    only_missing: bool = True
    limit: Optional[int] = None
    concurrency: int = 8
    deadline_s: float = 15.0


@router.post("/discover-whatsapp-all")
async def descobrir_whatsapp_todas(body: WhatsappBatchRequest, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Pente fino: tenta descobrir o WhatsApp de todas as empresas (em paralelo,
    com limite de concorrência e de tempo por empresa). Salva os encontrados."""
    db = get_db()
    filtro = {"conta_id": conta_id}
    if body.only_missing:
        filtro["$or"] = [{"whatsapp": None}, {"whatsapp": ""}]
    cursor = db.empresas.find(filtro, {"nome": 1, "website": 1, "whatsapp": 1}).sort(
        [("score", -1), ("created_at", -1)]
    )
    rows = await cursor.to_list(length=None)
    if body.limit is not None:
        rows = rows[: body.limit]

    sem = asyncio.Semaphore(max(1, min(body.concurrency, 10)))

    async def processa(r):
        async with sem:
            try:
                achado = await descobrir_whatsapp(
                    r["nome"], r.get("website"), deadline_s=body.deadline_s
                )
            except Exception as exc:
                return {"id": r["_id"], "nome": r["nome"], "status": "error", "error": str(exc)}
            if achado and achado.get("whatsapp"):
                return {
                    "id": r["_id"], "nome": r["nome"], "status": "ok",
                    "whatsapp": whatsapp_normalizado(achado["whatsapp"]),
                    "fonte_whatsapp": achado.get("fonte_whatsapp"),
                }
            return {"id": r["_id"], "nome": r["nome"], "status": "nao_encontrado"}

    achados = await asyncio.gather(*[processa(r) for r in rows])

    encontrados = 0
    items = []
    for a in achados:
        if a["status"] == "ok" and a.get("whatsapp"):
            await db.empresas.update_one(
                {"_id": a["id"], "conta_id": conta_id}, {"$set": {"whatsapp": a["whatsapp"], "updated_at": now()}}
            )
            await log_atividade(
                db, a["id"], "discover_whatsapp",
                "WhatsApp descoberto em lote (pente fino)",
                {"whatsapp": a["whatsapp"], "fonte_whatsapp": a.get("fonte_whatsapp")},
                autor=_autor(user), conta_id=conta_id,
            )
            encontrados += 1
        items.append({**a, "id": str(a["id"])})

    return {
        "ok": True,
        "total": len(rows),
        "encontrados": encontrados,
        "nao_encontrados": sum(1 for a in achados if a["status"] == "nao_encontrado"),
        "erros": sum(1 for a in achados if a["status"] == "error"),
        "items": items,
    }


# ---- Descoberta de e-mails (empresa + donos) ----

def _dominio_site(website: Optional[str]) -> Optional[str]:
    if not website:
        return None
    w = website.strip().lower()
    w = w.split("//")[-1]            # remove esquema
    w = w.split("/")[0]             # remove caminho
    return w.lstrip("www.") or None


def _qsa_de(dados_cnpj) -> list:
    if not dados_cnpj:
        return []
    if isinstance(dados_cnpj, str):
        try:
            dados_cnpj = json.loads(dados_cnpj)
        except Exception:
            return []
    return (dados_cnpj or {}).get("qsa") or []


def _socio_nome_qual(s: dict):
    nome = (s.get("nome_socio") or s.get("nome") or "").strip()
    qual = (s.get("qualificacao_socio") or s.get("qual") or "").strip() or "Sócio/Administrador"
    return nome, qual


async def _upsert_contato_dono(db, empresa_id: str, nome: str, cargo: str, email: str, conta_id: Optional[str] = None) -> bool:
    """Salva/atualiza o e-mail do dono na coleção contatos. Retorna True se gravou."""
    if not nome or not email:
        return False
    existente = await db.contatos.find_one({"empresa_id": empresa_id, "nome": ieq(nome)})
    if existente:
        if (existente.get("email") or "").lower() == email.lower():
            return False
        if not existente.get("email"):
            await db.contatos.update_one({"_id": existente["_id"]}, {"$set": {"email": email}})
        return True
    await db.contatos.insert_one({
        "_id": new_id(), "conta_id": conta_id, "empresa_id": empresa_id, "nome": nome,
        "cargo": cargo, "email": email, "created_at": now(),
    })
    return True


async def _descobrir_emails_empresa(db, row, deadline_s: float = 18.0, conta_id: Optional[str] = None) -> dict:
    """Descobre e-mails da empresa e dos donos (QSA) e salva. row precisa ter
    id, nome, website, email, dados_cnpj."""
    res = await descobrir_emails(row["nome"], row.get("website"), deadline_s=deadline_s)
    emails = res.get("emails") or []
    if not emails:
        return {"emails": [], "email_empresa": None, "donos": []}

    dominio = _dominio_site(row.get("website"))
    email_empresa = melhor_email_empresa(emails, dominio)

    # salva o e-mail da empresa só se ainda não houver um
    if email_empresa and not row.get("email"):
        await db.empresas.update_one(
            {"_id": row["id"], "conta_id": conta_id}, {"$set": {"email": email_empresa, "updated_at": now()}}
        )

    # casa e-mails com os donos do QSA e salva como contato
    donos = []
    for s in _qsa_de(row.get("dados_cnpj")):
        nome, qual = _socio_nome_qual(s)
        if not nome:
            continue
        em = casar_email_dono(nome, emails)
        if em:
            await _upsert_contato_dono(db, row["id"], nome, qual, em, conta_id=conta_id)
            donos.append({"nome": nome, "qualificacao": qual, "email": em})

    return {"emails": emails, "email_empresa": email_empresa, "donos": donos}


@router.post("/{empresa_id}/discover-email")
async def descobrir_email_empresa(empresa_id: str, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Procura no site os e-mails da empresa e dos donos (QSA) e salva."""
    db = get_db()
    row = await db.empresas.find_one(
        {"_id": empresa_id, "conta_id": conta_id}, {"nome": 1, "website": 1, "email": 1, "dados_cnpj": 1}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    resultado = await _descobrir_emails_empresa(db, serialize(row), deadline_s=22.0, conta_id=conta_id)
    if not resultado["emails"]:
        raise HTTPException(status_code=404, detail="Nenhum e-mail encontrado para esta empresa")

    await log_atividade(
        db, empresa_id, "discover_email",
        "E-mails descobertos no site da empresa",
        {"email_empresa": resultado["email_empresa"],
         "donos": resultado["donos"], "total": len(resultado["emails"])},
        autor=_autor(user), conta_id=conta_id,
    )
    empresa = await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id})
    return {"ok": True, "empresa": serialize(empresa), **resultado}


class EmailBatchRequest(BaseModel):
    only_missing: bool = True
    limit: Optional[int] = None
    concurrency: int = 8
    deadline_s: float = 15.0


@router.post("/discover-email-all")
async def descobrir_email_todas(body: EmailBatchRequest, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Pente fino: descobre e-mails (empresa + donos) de todas as empresas."""
    db = get_db()
    filtro = {"conta_id": conta_id}
    if body.only_missing:
        filtro["$or"] = [{"email": None}, {"email": ""}]
    rows = await db.empresas.find(
        filtro, {"nome": 1, "website": 1, "email": 1, "dados_cnpj": 1}
    ).sort([("score", -1), ("created_at", -1)]).to_list(length=None)
    if body.limit is not None:
        rows = rows[: body.limit]

    sem = asyncio.Semaphore(max(1, min(body.concurrency, 10)))

    async def processa(r):
        async with sem:
            try:
                res = await descobrir_emails(r["nome"], r.get("website"), deadline_s=body.deadline_s)
            except Exception as exc:
                return {"id": r["_id"], "nome": r["nome"], "status": "error", "error": str(exc)}
            emails = res.get("emails") or []
            if not emails:
                return {"id": r["_id"], "nome": r["nome"], "status": "nao_encontrado"}
            dominio = _dominio_site(r.get("website"))
            return {
                "id": r["_id"], "nome": r["nome"], "status": "ok",
                "email_empresa": melhor_email_empresa(emails, dominio),
                "emails": emails, "dados_cnpj": r.get("dados_cnpj"),
            }

    achados = await asyncio.gather(*[processa(r) for r in rows])

    empresas_ok = donos_ok = 0
    items = []
    for a in achados:
        if a["status"] == "ok":
            eid = a["id"]
            if a.get("email_empresa"):
                await db.empresas.update_one(
                    {"_id": eid, "conta_id": conta_id, "$or": [{"email": None}, {"email": ""}]},
                    {"$set": {"email": a["email_empresa"], "updated_at": now()}},
                )
                empresas_ok += 1
            donos = []
            for s in _qsa_de(a.get("dados_cnpj")):
                nome, qual = _socio_nome_qual(s)
                if not nome:
                    continue
                em = casar_email_dono(nome, a["emails"])
                if em and await _upsert_contato_dono(db, eid, nome, qual, em, conta_id=conta_id):
                    donos.append({"nome": nome, "email": em})
                    donos_ok += 1
            await log_atividade(
                db, eid, "discover_email", "E-mails descobertos em lote",
                {"email_empresa": a.get("email_empresa"), "donos": donos},
                autor=_autor(user), conta_id=conta_id,
            )
            items.append({"id": str(eid), "nome": a["nome"], "status": "ok",
                          "email_empresa": a.get("email_empresa"), "donos": donos})
        else:
            items.append({"id": str(a["id"]), "nome": a["nome"], "status": a["status"]})

    return {
        "ok": True,
        "total": len(rows),
        "emails_empresa": empresas_ok,
        "emails_donos": donos_ok,
        "nao_encontrados": sum(1 for a in achados if a["status"] == "nao_encontrado"),
        "erros": sum(1 for a in achados if a["status"] == "error"),
        "items": items,
    }


@router.post("/{empresa_id}/enrich-auto")
async def enriquecer_automaticamente(empresa_id: str, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Descobre CNPJ por nome quando necessário e enriquece com o máximo de dados."""
    db = get_db()
    empresa = await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id}, {"nome": 1, "cnpj": 1, "dados_cnpj": 1})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    cnpj = clean_cnpj(empresa.get("cnpj") or "")
    descoberta = None

    if not cnpj:
        descoberta = await search_cnpj_by_name(empresa["nome"])
        if descoberta and descoberta.get("cnpj"):
            cnpj = clean_cnpj(descoberta["cnpj"])

    if not cnpj:
        raise HTTPException(status_code=404, detail="Não foi possível descobrir um CNPJ para esta empresa")

    data = await fetch_cnpj_data(cnpj)
    if descoberta:
        data["descoberta"] = descoberta

    # Se nao veio celular da Receita, procura o WhatsApp no site da empresa
    if not data.get("whatsapp"):
        try:
            achado = await descobrir_whatsapp(empresa["nome"])
            if achado and achado.get("whatsapp"):
                data["whatsapp"] = achado["whatsapp"]
                data["fonte_whatsapp"] = achado.get("fonte_whatsapp")
        except Exception:
            pass

    row = await salvar_dados_cnpj(db, empresa_id, data, cnpj, conta_id=conta_id)
    await log_atividade(
        db, empresa_id, "enrich_auto",
        "Empresa enriquecida automaticamente com descoberta de CNPJ",
        {"cnpj": cnpj, "fonte": data.get("fonte"), "descoberta": descoberta},
        autor=_autor(user), conta_id=conta_id,
    )

    # Captação de e-mails: empresa + donos (QSA) a partir do site
    emails_info = {"emails": [], "email_empresa": None, "donos": []}
    try:
        emails_info = await _descobrir_emails_empresa(db, row, deadline_s=18.0, conta_id=conta_id)
        row = serialize(await db.empresas.find_one({"_id": empresa_id, "conta_id": conta_id}))
    except Exception:
        pass

    return {
        "ok": True,
        "empresa": row,
        "cnpj": cnpj,
        "qsa": data.get("qsa", []),
        "descoberta": descoberta,
        "fonte": data.get("fonte"),
        "emails": emails_info["emails"],
        "email_empresa": emails_info["email_empresa"],
        "emails_donos": emails_info["donos"],
    }


@router.post("/enrich-all")
async def enriquecer_todas_empresas(body: EnrichBatchRequest, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Enriquecimento em lote para todas as empresas cadastradas."""
    db = get_db()
    rows = await db.empresas.find(
        {"conta_id": conta_id}, {"nome": 1, "cnpj": 1, "dados_cnpj": 1}
    ).sort([("score", -1), ("created_at", -1)]).to_list(length=None)

    total = len(rows)
    processed = enriched = discovered = skipped = 0
    errors = []
    items = []

    for row in rows:
        if body.limit is not None and processed >= body.limit:
            break

        processed += 1
        empresa_id = row["_id"]
        nome = row["nome"]
        cnpj = clean_cnpj(row.get("cnpj") or "")
        descoberta = None

        already_enriched = bool(row.get("dados_cnpj")) and bool(cnpj)
        if body.only_missing and already_enriched and not body.force:
            skipped += 1
            items.append({"id": str(empresa_id), "nome": nome, "status": "skipped", "motivo": "já enriquecida"})
            continue

        try:
            if not cnpj:
                descoberta = await search_cnpj_by_name(nome)
                if descoberta and descoberta.get("cnpj"):
                    cnpj = clean_cnpj(descoberta["cnpj"])
                    discovered += 1

            if not cnpj:
                raise HTTPException(status_code=404, detail="CNPJ não encontrado")

            data = await fetch_cnpj_data(cnpj)
            if descoberta:
                data["descoberta"] = descoberta

            # Se a Receita nao trouxe celular, tenta achar o WhatsApp no site
            if not data.get("whatsapp"):
                try:
                    achado = await descobrir_whatsapp(nome)
                    if achado and achado.get("whatsapp"):
                        data["whatsapp"] = achado["whatsapp"]
                        data["fonte_whatsapp"] = achado.get("fonte_whatsapp")
                except Exception:
                    pass

            saved = await salvar_dados_cnpj(db, empresa_id, data, cnpj, conta_id=conta_id)
            await log_atividade(
                db, empresa_id, "enrich_auto",
                "Empresa enriquecida em lote com descoberta de CNPJ" if descoberta else "Empresa enriquecida em lote via CNPJ",
                {"cnpj": cnpj, "fonte": data.get("fonte"), "descoberta": descoberta},
                autor=_autor(user), conta_id=conta_id,
            )
            enriched += 1
            items.append({
                "id": str(empresa_id), "nome": nome, "status": "ok",
                "cnpj": cnpj, "fonte": data.get("fonte"),
                "razao_social": saved["razao_social"],
            })
        except Exception as exc:
            errors.append({"id": str(empresa_id), "nome": nome, "error": str(exc)})
            items.append({"id": str(empresa_id), "nome": nome, "status": "error", "error": str(exc)})

    return {
        "ok": True,
        "total": total,
        "processed": processed,
        "enriched": enriched,
        "discovered_cnpj": discovered,
        "skipped": skipped,
        "errors": errors,
        "items": items,
    }
