import json
import uuid
import re
from typing import List, Optional

import asyncpg
from fastapi import APIRouter
from pydantic import BaseModel

from database import settings
from services.market_intelligence import scan_market, _strip_accents

router = APIRouter()


async def get_conn():
    return await asyncpg.connect(
        settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    )


def _as_uuid(value):
    if not value:
        return None
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


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


async def _save_market_item(conn, item: dict) -> dict:
    row = await conn.fetchrow(
        """
        INSERT INTO mercado_itens (
            empresa_id, area, tipo, nome, subtitulo, bairro, municipio, uf, endereco,
            valor_venda, valor_locacao, dormitorios, suites, vagas, area_privativa,
            status, empreendimento, url, fonte, dados, score, updated_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20::jsonb, $21, NOW()
        )
        ON CONFLICT (area, tipo, nome, url) DO UPDATE SET
            empresa_id = EXCLUDED.empresa_id,
            subtitulo = EXCLUDED.subtitulo,
            bairro = EXCLUDED.bairro,
            municipio = EXCLUDED.municipio,
            uf = EXCLUDED.uf,
            endereco = EXCLUDED.endereco,
            valor_venda = EXCLUDED.valor_venda,
            valor_locacao = EXCLUDED.valor_locacao,
            dormitorios = EXCLUDED.dormitorios,
            suites = EXCLUDED.suites,
            vagas = EXCLUDED.vagas,
            area_privativa = EXCLUDED.area_privativa,
            status = EXCLUDED.status,
            empreendimento = EXCLUDED.empreendimento,
            fonte = EXCLUDED.fonte,
            dados = EXCLUDED.dados,
            score = EXCLUDED.score,
            updated_at = NOW()
        RETURNING *;
        """,
        _as_uuid(item.get("empresa_id")),
        _clip(item.get("area"), 120),
        _clip(item.get("tipo"), 40),
        _clip(item.get("nome"), 255),
        _clip(item.get("subtitulo"), 255),
        _clip(item.get("bairro"), 120),
        _clip(item.get("municipio"), 120),
        _clip(item.get("uf"), 2),
        _clip(item.get("endereco"), 255),
        _clip(item.get("valor_venda"), 50),
        _clip(item.get("valor_locacao"), 50),
        item.get("dormitorios"),
        item.get("suites"),
        item.get("vagas"),
        item.get("area_privativa"),
        _clip(item.get("status"), 50),
        _clip(item.get("empreendimento"), 255),
        _clip(item.get("url"), 600),
        _clip(item.get("fonte"), 255),
        json.dumps(item.get("dados", {}), ensure_ascii=False),
        item.get("score", 0),
    )
    return dict(row)


@router.get("/areas")
async def sugerir_areas(q: Optional[str] = None, limit: int = 8):
    """Autocomplete de área: sugere bairros/regiões a partir dos dados já cadastrados
    (empresas + itens de mercado). Não depende de API externa."""
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """
            SELECT regiao AS v FROM empresas WHERE regiao IS NOT NULL
            UNION ALL SELECT bairro FROM empresas WHERE bairro IS NOT NULL
            UNION ALL SELECT municipio FROM empresas WHERE municipio IS NOT NULL
            UNION ALL SELECT bairro FROM mercado_itens WHERE bairro IS NOT NULL
            UNION ALL SELECT area FROM mercado_itens WHERE area IS NOT NULL
            """
        )
    finally:
        await conn.close()

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
    for r in rows:
        bruto = (r["v"] or "").strip()
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
):
    conn = await get_conn()
    try:
        where = []
        params = []
        i = 1

        if area:
            where.append(f"area ILIKE ${i}")
            params.append(f"%{area}%")
            i += 1
        if tipo:
            where.append(f"tipo = ${i}")
            params.append(tipo)
            i += 1
        if empresa_id:
            where.append(f"empresa_id = ${i}")
            params.append(uuid.UUID(empresa_id))
            i += 1

        where_sql = "WHERE " + " AND ".join(where) if where else ""
        params += [limit, offset]
        rows = await conn.fetch(
            f"""
            SELECT mi.*, e.nome as empresa_nome
            FROM mercado_itens mi
            LEFT JOIN empresas e ON e.id = mi.empresa_id
            {where_sql}
            ORDER BY mi.score DESC, mi.created_at DESC
            LIMIT ${i} OFFSET ${i + 1}
            """,
            *params,
        )
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM mercado_itens mi {where_sql}",
            *params[:-2],
        )
        return {
            "total": total,
            "items": [dict(r) for r in rows],
            "limit": limit,
            "offset": offset,
        }
    finally:
        await conn.close()


@router.get("/summary")
async def resumo_mercado(area: Optional[str] = None):
    conn = await get_conn()
    try:
        where_sql = "WHERE area ILIKE $1" if area else ""
        params = [f"%{area}%"] if area else []
        total = await conn.fetchval(f"SELECT COUNT(*) FROM mercado_itens {where_sql}", *params)
        por_tipo = await conn.fetch(
            f"""
            SELECT tipo, COUNT(*) as total
            FROM mercado_itens
            {where_sql}
            GROUP BY tipo
            ORDER BY total DESC
            """,
            *params,
        )
        por_empresa = await conn.fetch(
            f"""
            SELECT COALESCE(e.nome, 'Sem empresa') as nome, COUNT(*) as total
            FROM mercado_itens mi
            LEFT JOIN empresas e ON e.id = mi.empresa_id
            {where_sql}
            GROUP BY COALESCE(e.nome, 'Sem empresa')
            ORDER BY total DESC, nome
            LIMIT 8
            """,
            *params,
        )
        recentes = await conn.fetch(
            f"""
            SELECT mi.*, e.nome as empresa_nome
            FROM mercado_itens mi
            LEFT JOIN empresas e ON e.id = mi.empresa_id
            {where_sql}
            ORDER BY mi.created_at DESC
            LIMIT 8
            """,
            *params,
        )
        return {
            "total": total,
            "por_tipo": [dict(r) for r in por_tipo],
            "por_empresa": [dict(r) for r in por_empresa],
            "recentes": [dict(r) for r in recentes],
        }
    finally:
        await conn.close()


@router.post("/scan")
async def escanear_mercado(body: MarketScanRequest):
    conn = await get_conn()
    try:
        if body.empresa_ids:
            companies = await conn.fetch(
                "SELECT * FROM empresas WHERE id = ANY($1::uuid[]) ORDER BY score DESC, created_at DESC",
                [uuid.UUID(x) for x in body.empresa_ids],
            )
        else:
            terms = [term.strip() for term in re.split(r"[\/,]+", body.area) if term.strip()]
            if not terms:
                terms = [body.area]
            where_parts = []
            params = []
            for idx, term in enumerate(terms, start=1):
                where_parts.append(f"(regiao ILIKE ${idx} OR bairro ILIKE ${idx} OR municipio ILIKE ${idx})")
                params.append(f"%{term}%")
            where_sql = " OR ".join(where_parts)
            query = f"""
                SELECT *
                FROM empresas
                WHERE {where_sql}
                ORDER BY score DESC, created_at DESC
            """
            companies = await conn.fetch(
                query,
                *params,
            )

        result = await scan_market(
            [dict(r) for r in companies],
            body.area,
            include_company_projects=body.include_company_projects,
            include_area_listings=body.include_area_listings,
            limit=body.limit or 60,
        )

        saved = []
        for item in result["items"]:
            saved.append(await _save_market_item(conn, item))

        return {
            "ok": True,
            "area": body.area,
            "saved": len(saved),
            "total": result["total"],
            "summary": result["summary"],
            "sources": result["sources"],
            "items": saved,
        }
    finally:
        await conn.close()
