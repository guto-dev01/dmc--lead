import re
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import get_db, new_id, now, serialize, like
from services.market_intelligence import scan_market, _strip_accents
from services.auth import conta_atual

router = APIRouter()


def _clip(value, max_len: int):
    if value is None:
        return None
    text = str(value)
    return text[:max_len]


class MarketScanRequest(BaseModel):
    area: str = "Consolação/Jardins/Bela Vista"
    include_company_projects: bool = True
    include_area_listings: bool = True
    empresa_ids: Optional[List[str]] = None
    limit: Optional[int] = 60


async def _save_market_item(conn, item: dict, conta_id=None) -> dict:
    db = conn
    chave = {
        "conta_id": conta_id,
        "area": _clip(item.get("area"), 120),
        "tipo": _clip(item.get("tipo"), 40),
        "nome": _clip(item.get("nome"), 255),
        "url": _clip(item.get("url"), 600),
    }
    sets = {
        "empresa_id": item.get("empresa_id") or None,
        "subtitulo": _clip(item.get("subtitulo"), 255),
        "bairro": _clip(item.get("bairro"), 120),
        "municipio": _clip(item.get("municipio"), 120),
        "uf": _clip(item.get("uf"), 2),
        "endereco": _clip(item.get("endereco"), 255),
        "valor_venda": _clip(item.get("valor_venda"), 50),
        "valor_locacao": _clip(item.get("valor_locacao"), 50),
        "dormitorios": item.get("dormitorios"),
        "suites": item.get("suites"),
        "vagas": item.get("vagas"),
        "area_privativa": item.get("area_privativa"),
        "status": _clip(item.get("status"), 50),
        "empreendimento": _clip(item.get("empreendimento"), 255),
        "fonte": _clip(item.get("fonte"), 255),
        "dados": item.get("dados", {}),
        "score": item.get("score", 0),
        "updated_at": now(),
    }
    row = await db.mercado_itens.find_one_and_update(
        chave,
        {"$set": sets, "$setOnInsert": {"_id": new_id(), "created_at": now()}},
        upsert=True,
        return_document=True,
    )
    return serialize(row)


@router.get("/areas")
async def sugerir_areas(q: Optional[str] = None, limit: int = 8, conta_id: str = Depends(conta_atual)):
    """Autocomplete de área: sugere bairros/regiões a partir dos dados já cadastrados
    (empresas + itens de mercado). Não depende de API externa."""
    db = get_db()
    brutos: list[str] = []
    async for e in db.empresas.find({"conta_id": conta_id}, {"regiao": 1, "bairro": 1, "municipio": 1}):
        for campo in ("regiao", "bairro", "municipio"):
            if e.get(campo):
                brutos.append(e[campo])
    async for m in db.mercado_itens.find({"conta_id": conta_id}, {"bairro": 1, "area": 1}):
        for campo in ("bairro", "area"):
            if m.get(campo):
                brutos.append(m[campo])

    # Aceita só o que parece nome de lugar (evita lixo que o scraper gravou em bairro/area)
    LUGAR_RE = re.compile(r"^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\- ]+$")
    PREFIXOS_RUA = ("rua ", "r. ", "av ", "av. ", "avenida ", "alameda ", "al. ",
                    "travessa ", "praca ", "praça ", "rod ", "rodovia ", "estrada ")

    def parece_lugar(p: str) -> bool:
        if not (2 <= len(p) <= 28) or len(p.split()) > 4:
            return False
        if any(ch.isdigit() for ch in p):
            return False
        if _strip_accents(p.lower()).startswith(tuple(_strip_accents(x) for x in PREFIXOS_RUA)):
            return False
        return bool(LUGAR_RE.match(p))

    # Quebra valores compostos ("Consolação/Jardins/Bela Vista") em itens individuais
    contagem = {}      # chave sem acento -> [rótulo exibido, frequência]
    for bruto in brutos:
        bruto = (bruto or "").strip()
        for parte in re.split(r"[\/,;]+", bruto):
            parte = parte.strip(" .-")
            if not parece_lugar(parte):
                continue
            rotulo = " ".join(w.capitalize() for w in parte.lower().split())
            chave = _strip_accents(rotulo.lower())
            if chave not in contagem:
                contagem[chave] = [rotulo, 0]
            else:
                # prefere o rótulo que tem acento (mais "bonito")
                atual = contagem[chave][0]
                if any(ord(c) > 127 for c in rotulo) and not any(ord(c) > 127 for c in atual):
                    contagem[chave][0] = rotulo
            contagem[chave][1] += 1

    termo = _strip_accents((q or "").strip().lower())
    candidatos = list(contagem.values())
    if termo:
        comeca = [c for c in candidatos if _strip_accents(c[0].lower()).startswith(termo)]
        contem = [c for c in candidatos if termo in _strip_accents(c[0].lower()) and c not in comeca]
        ordenados = comeca + contem
    else:
        ordenados = sorted(candidatos, key=lambda c: (-c[1], c[0]))

    return [c[0] for c in ordenados[: max(1, min(limit, 20))]]


@router.get("/items")
async def listar_itens(
    area: Optional[str] = None,
    tipo: Optional[str] = None,
    empresa_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    conta_id: str = Depends(conta_atual),
):
    db = get_db()
    filtro: dict = {"conta_id": conta_id}
    if area:
        filtro["area"] = like(area)
    if tipo:
        filtro["tipo"] = tipo
    if empresa_id:
        filtro["empresa_id"] = empresa_id

    total = await db.mercado_itens.count_documents(filtro)
    rows = await (
        db.mercado_itens.find(filtro)
        .sort([("score", -1), ("created_at", -1)])
        .skip(offset)
        .limit(limit)
        .to_list(length=limit)
    )
    items = [serialize(r) for r in rows]
    await _anexar_empresa_nome(db, items, conta_id)
    return {"total": total, "items": items, "limit": limit, "offset": offset}


async def _anexar_empresa_nome(db, items: list[dict], conta_id=None) -> None:
    """Anexa empresa_nome a cada item (substitui o LEFT JOIN com empresas)."""
    emp_ids = list({i["empresa_id"] for i in items if i.get("empresa_id")})
    if not emp_ids:
        for i in items:
            i["empresa_nome"] = None
        return
    filtro = {"_id": {"$in": emp_ids}}
    if conta_id is not None:
        filtro["conta_id"] = conta_id
    empresas = await db.empresas.find(filtro, {"nome": 1}).to_list(length=None)
    nome_map = {e["_id"]: e.get("nome") for e in empresas}
    for i in items:
        i["empresa_nome"] = nome_map.get(i.get("empresa_id"))


@router.get("/summary")
async def resumo_mercado(area: Optional[str] = None, conta_id: str = Depends(conta_atual)):
    db = get_db()
    filtro = {"conta_id": conta_id, "area": like(area)} if area else {"conta_id": conta_id}
    total = await db.mercado_itens.count_documents(filtro)

    por_tipo_raw = await (await db.mercado_itens.aggregate([
        {"$match": filtro},
        {"$group": {"_id": "$tipo", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ])).to_list(length=None)
    por_tipo = [{"tipo": r["_id"], "total": r["total"]} for r in por_tipo_raw]

    # por empresa: agrupa por empresa_id, depois resolve o nome
    por_emp_raw = await (await db.mercado_itens.aggregate([
        {"$match": filtro},
        {"$group": {"_id": "$empresa_id", "total": {"$sum": 1}}},
    ])).to_list(length=None)
    emp_ids = [r["_id"] for r in por_emp_raw if r["_id"]]
    nome_map = {}
    if emp_ids:
        empresas = await db.empresas.find({"_id": {"$in": emp_ids}, "conta_id": conta_id}, {"nome": 1}).to_list(length=None)
        nome_map = {e["_id"]: e.get("nome") for e in empresas}
    por_empresa = [
        {"nome": nome_map.get(r["_id"]) or "Sem empresa", "total": r["total"]}
        for r in por_emp_raw
    ]
    por_empresa.sort(key=lambda x: (-x["total"], x["nome"]))
    por_empresa = por_empresa[:8]

    recentes_raw = await db.mercado_itens.find(filtro).sort("created_at", -1).limit(8).to_list(length=8)
    recentes = [serialize(r) for r in recentes_raw]
    await _anexar_empresa_nome(db, recentes, conta_id)

    return {
        "total": total,
        "por_tipo": por_tipo,
        "por_empresa": por_empresa,
        "recentes": recentes,
    }


@router.post("/scan")
async def escanear_mercado(body: MarketScanRequest, conta_id: str = Depends(conta_atual)):
    db = get_db()
    if body.empresa_ids:
        companies = await db.empresas.find(
            {"_id": {"$in": body.empresa_ids}, "conta_id": conta_id}
        ).sort([("score", -1), ("created_at", -1)]).to_list(length=None)
    else:
        terms = [term.strip() for term in re.split(r"[\/,]+", body.area) if term.strip()]
        if not terms:
            terms = [body.area]
        ors = []
        for term in terms:
            ors.append({"regiao": like(term)})
            ors.append({"bairro": like(term)})
            ors.append({"municipio": like(term)})
        companies = await db.empresas.find({"conta_id": conta_id, "$or": ors}).sort(
            [("score", -1), ("created_at", -1)]
        ).to_list(length=None)

    result = await scan_market(
        [serialize(r) for r in companies],
        body.area,
        include_company_projects=body.include_company_projects,
        include_area_listings=body.include_area_listings,
        limit=body.limit or 60,
    )

    saved = []
    for item in result["items"]:
        saved.append(await _save_market_item(db, item, conta_id))

    return {
        "ok": True,
        "area": body.area,
        "saved": len(saved),
        "total": result["total"],
        "summary": result["summary"],
        "sources": result["sources"],
        "items": saved,
    }
