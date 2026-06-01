import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import uuid, asyncpg, asyncio, httpx
from database import settings
from services.cnpj_enrichment import (
    calculate_completeness_score,
    clean_cnpj,
    fetch_cnpj_data,
    search_cnpj_by_name,
    descobrir_whatsapp,
)

router = APIRouter()

async def get_conn():
    return await asyncpg.connect(
        settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    )


async def log_atividade(conn, empresa_id: uuid.UUID, tipo: str, descricao: str, dados=None):
    await conn.execute(
        """INSERT INTO atividades (empresa_id, tipo, descricao, dados)
           VALUES ($1, $2, $3, $4::jsonb)""",
        empresa_id,
        tipo,
        descricao,
        json.dumps(dados, ensure_ascii=False) if dados is not None else None,
    )


async def salvar_dados_cnpj(conn, empresa_id: uuid.UUID, data: dict, cnpj_origem: Optional[str] = None):
    cnpj_valor = clean_cnpj(cnpj_origem or data.get("cnpj") or "")
    data_abertura = data.get("data_abertura")
    if isinstance(data_abertura, str) and data_abertura:
        try:
            data_abertura = date.fromisoformat(data_abertura)
        except ValueError:
            data_abertura = None
    cnae_principal = data.get("cnae_principal")
    if cnae_principal is not None:
        cnae_principal = str(cnae_principal)
    dados_cnpj_json = json.dumps(data, ensure_ascii=False)
    row = await conn.fetchrow(
        """UPDATE empresas SET
           cnpj = COALESCE($2, cnpj),
           razao_social = COALESCE($3, razao_social, nome),
           nome_fantasia = COALESCE($4, nome_fantasia),
           situacao_cadastral = $5,
           data_abertura = $6::date,
           natureza_juridica = $7,
           porte = $8,
           capital_social = $9,
           cnaes_principal = $10::varchar,
           descricao_cnae = $11,
           logradouro = $12,
           numero = $13,
           complemento = $14,
           bairro = $15,
           municipio = $16,
           uf = $17,
           cep = $18,
           email = COALESCE($19, email),
           telefone = COALESCE($20, telefone),
           telefone2 = COALESCE($21, telefone2),
           whatsapp = COALESCE($25, whatsapp),
           dados_cnpj = $22::jsonb,
           cnpj_fonte = $23,
           cnpj_enriquecido_em = NOW(),
           score = $24,
           updated_at = NOW()
           WHERE id = $1
           RETURNING *""",
        empresa_id,
        cnpj_valor or None,
        data.get("razao_social"),
        data.get("nome_fantasia"),
        data.get("situacao_cadastral"),
        data_abertura,
        data.get("natureza_juridica"),
        data.get("porte"),
        data.get("capital_social"),
        cnae_principal,
        data.get("cnae_descricao"),
        data.get("logradouro"),
        data.get("numero"),
        data.get("complemento"),
        data.get("bairro"),
        data.get("municipio"),
        data.get("uf"),
        data.get("cep"),
        data.get("email"),
        data.get("telefone"),
        data.get("telefone2"),
        dados_cnpj_json,
        data.get("fonte"),
        calculate_completeness_score(data),
        whatsapp_normalizado(data.get("whatsapp")),
    )
    return row


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
    busca: Optional[str] = None,
    regiao: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    conn = await get_conn()
    try:
        where = []
        params = []
        i = 1

        if tipo:
            where.append(f"tipo = ${i}")
            params.append(tipo)
            i += 1
        if busca:
            where.append(f"(nome ILIKE ${i} OR cnpj ILIKE ${i})")
            params.append(f"%{busca}%")
            i += 1
        if regiao:
            where.append(f"regiao ILIKE ${i}")
            params.append(f"%{regiao}%")
            i += 1

        where_str = "WHERE " + " AND ".join(where) if where else ""
        params += [limit, offset]

        rows = await conn.fetch(
            f"""SELECT e.*, 
                (SELECT COUNT(*) FROM conversas c WHERE c.empresa_id = e.id) as total_conversas,
                (SELECT COUNT(*) FROM contatos ct WHERE ct.empresa_id = e.id) as total_contatos
                FROM empresas e {where_str}
                ORDER BY e.score DESC, e.created_at DESC
                LIMIT ${i} OFFSET ${i+1}""",
            *params,
        )
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM empresas {where_str}", *params[:-2]
        )
        return {
            "total": total,
            "items": [dict(r) for r in rows],
            "limit": limit,
            "offset": offset,
        }
    finally:
        await conn.close()


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
async def empresas_geo():
    """Empresas com coordenadas + status, para o Mapa de Ativos."""
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """SELECT id, nome, status_prospeccao, lat, lng, bairro, municipio, uf,
                      logradouro, numero, telefone, whatsapp
               FROM empresas ORDER BY nome"""
        )
        itens = [dict(r) for r in rows]
        sem = sum(1 for i in itens if not (i.get("lat") and i.get("lng")))
        return {
            "total": len(itens),
            "com_coords": len(itens) - sem,
            "sem_coords": sem,
            "empresas": itens,
        }
    finally:
        await conn.close()


@router.post("/geocodificar")
async def geocodificar_empresas(limite: int = 80):
    """Geocodifica (OSM/Nominatim) as empresas sem coordenadas. Respeita 1 req/s."""
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """SELECT id, logradouro, numero, bairro, regiao, municipio, uf FROM empresas
               WHERE (lat IS NULL OR lng IS NULL)
                 AND (logradouro IS NOT NULL OR bairro IS NOT NULL OR regiao IS NOT NULL OR municipio IS NOT NULL)
               LIMIT $1""",
            limite,
        )
        geocodificadas = 0
        headers = {"User-Agent": "ImobPro/1.0 (contato@complexodmc.com.br)"}
        async with httpx.AsyncClient(timeout=20, headers=headers) as client:
            for r in rows:
                queries = _queries_geocode(dict(r))
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
                    await conn.execute(
                        "UPDATE empresas SET lat=$1, lng=$2 WHERE id=$3",
                        float(achou["lat"]), float(achou["lon"]), r["id"],
                    )
                    geocodificadas += 1
        restantes = await conn.fetchval(
            "SELECT COUNT(*) FROM empresas WHERE lat IS NULL OR lng IS NULL"
        )
        return {"ok": True, "geocodificadas": geocodificadas, "restantes": int(restantes)}
    finally:
        await conn.close()


@router.get("/{empresa_id}")
async def obter_empresa(empresa_id: str):
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM empresas WHERE id = $1", uuid.UUID(empresa_id)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")

        contatos = await conn.fetch(
            "SELECT * FROM contatos WHERE empresa_id = $1 ORDER BY nome", uuid.UUID(empresa_id)
        )
        conversas = await conn.fetch(
            """SELECT cv.*, 
               (SELECT COUNT(*) FROM mensagens m WHERE m.conversa_id = cv.id) as total_mensagens
               FROM conversas cv WHERE cv.empresa_id = $1 ORDER BY cv.ultimo_contato DESC NULLS LAST""",
            uuid.UUID(empresa_id),
        )
        atividades = await conn.fetch(
            "SELECT * FROM atividades WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT 20",
            uuid.UUID(empresa_id),
        )
        return {
            **dict(row),
            "contatos": [dict(c) for c in contatos],
            "conversas": [dict(c) for c in conversas],
            "atividades": [dict(a) for a in atividades],
        }
    finally:
        await conn.close()


@router.post("")
async def criar_empresa(empresa: EmpresaCreate):
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            """INSERT INTO empresas (nome, cnpj, tipo, regiao, bairro, municipio, uf,
               email, telefone, whatsapp, website, observacoes, tags)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
               RETURNING *""",
            empresa.nome, empresa.cnpj, empresa.tipo, empresa.regiao,
            empresa.bairro, empresa.municipio, empresa.uf, empresa.email,
            empresa.telefone, empresa.whatsapp, empresa.website,
            empresa.observacoes, empresa.tags,
        )
        return dict(row)
    finally:
        await conn.close()


@router.patch("/{empresa_id}")
async def atualizar_empresa(empresa_id: str, dados: EmpresaUpdate):
    conn = await get_conn()
    try:
        campos = {k: v for k, v in dados.model_dump().items() if v is not None}
        if not campos:
            raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

        casts = {"data_agendada": "::timestamp", "data_abertura": "::date"}
        sets = ", ".join([f"{k} = ${i+2}{casts.get(k, '')}" for i, k in enumerate(campos)])
        valores = list(campos.values())

        row = await conn.fetchrow(
            f"UPDATE empresas SET {sets}, updated_at = NOW() WHERE id = $1 RETURNING *",
            uuid.UUID(empresa_id), *valores,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        return dict(row)
    finally:
        await conn.close()


@router.delete("/{empresa_id}")
async def deletar_empresa(empresa_id: str):
    conn = await get_conn()
    try:
        await conn.execute("DELETE FROM empresas WHERE id = $1", uuid.UUID(empresa_id))
        return {"ok": True}
    finally:
        await conn.close()


@router.post("/{empresa_id}/enrich-cnpj")
async def enriquecer_com_cnpj(empresa_id: str):
    """Busca dados da Receita Federal e atualiza a empresa"""
    conn = await get_conn()
    try:
        empresa = await conn.fetchrow(
            "SELECT cnpj, nome, website FROM empresas WHERE id = $1", uuid.UUID(empresa_id)
        )
        if not empresa or not empresa["cnpj"]:
            raise HTTPException(status_code=400, detail="Empresa sem CNPJ cadastrado")

        data = await fetch_cnpj_data(empresa["cnpj"])
        # Se a Receita nao trouxe um celular, tenta achar o WhatsApp no site da empresa
        if not data.get("whatsapp"):
            try:
                achado = await descobrir_whatsapp(empresa["nome"], empresa["website"])
                if achado and achado.get("whatsapp"):
                    data["whatsapp"] = achado["whatsapp"]
                    data["fonte_whatsapp"] = achado.get("fonte_whatsapp")
            except Exception:
                pass
        row = await salvar_dados_cnpj(conn, uuid.UUID(empresa_id), data, empresa["cnpj"])
        await log_atividade(
            conn,
            uuid.UUID(empresa_id),
            "enrich_cnpj",
            "Dados enriquecidos via Receita Federal",
            {"fonte": data.get("fonte"), "cnpj": data.get("cnpj")},
        )

        return {
            "ok": True,
            "empresa": dict(row),
            "qsa": data.get("qsa", []),
            "fonte": data.get("fonte"),
        }
    finally:
        await conn.close()


@router.post("/{empresa_id}/discover-whatsapp")
async def descobrir_whatsapp_empresa(empresa_id: str):
    """Procura o WhatsApp da empresa no site e salva o numero encontrado."""
    conn = await get_conn()
    try:
        empresa = await conn.fetchrow(
            "SELECT id, nome, website, whatsapp FROM empresas WHERE id = $1",
            uuid.UUID(empresa_id),
        )
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")

        achado = await descobrir_whatsapp(empresa["nome"], empresa["website"])
        if not achado or not achado.get("whatsapp"):
            raise HTTPException(status_code=404, detail="Não foi possível descobrir um WhatsApp válido para esta empresa")

        whatsapp = whatsapp_normalizado(achado.get("whatsapp"))
        row = await conn.fetchrow(
            """UPDATE empresas SET
               whatsapp = COALESCE($2, whatsapp),
               updated_at = NOW()
               WHERE id = $1
               RETURNING *""",
            uuid.UUID(empresa_id),
            whatsapp,
        )

        await log_atividade(
            conn,
            uuid.UUID(empresa_id),
            "discover_whatsapp",
            "WhatsApp descoberto no site da empresa",
            {"whatsapp": whatsapp, "fonte_whatsapp": achado.get("fonte_whatsapp")},
        )

        return {
            "ok": True,
            "empresa": dict(row),
            "whatsapp": whatsapp,
            "fonte_whatsapp": achado.get("fonte_whatsapp"),
        }
    finally:
        await conn.close()


@router.post("/{empresa_id}/enrich-auto")
async def enriquecer_automaticamente(empresa_id: str):
    """Descobre CNPJ por nome quando necessário e enriquece com o máximo de dados."""
    conn = await get_conn()
    try:
        empresa = await conn.fetchrow(
            "SELECT id, nome, cnpj, dados_cnpj FROM empresas WHERE id = $1",
            uuid.UUID(empresa_id),
        )
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")

        cnpj = clean_cnpj(empresa["cnpj"] or "")
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

        row = await salvar_dados_cnpj(conn, uuid.UUID(empresa_id), data, cnpj)
        await log_atividade(
            conn,
            uuid.UUID(empresa_id),
            "enrich_auto",
            "Empresa enriquecida automaticamente com descoberta de CNPJ",
            {"cnpj": cnpj, "fonte": data.get("fonte"), "descoberta": descoberta},
        )

        return {
            "ok": True,
            "empresa": dict(row),
            "cnpj": cnpj,
            "qsa": data.get("qsa", []),
            "descoberta": descoberta,
            "fonte": data.get("fonte"),
        }
    finally:
        await conn.close()


@router.post("/enrich-all")
async def enriquecer_todas_empresas(body: EnrichBatchRequest):
    """Enriquecimento em lote para todas as empresas cadastradas."""
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """SELECT id, nome, cnpj, dados_cnpj
               FROM empresas
               ORDER BY score DESC, created_at DESC"""
        )

        total = len(rows)
        processed = enriched = discovered = skipped = 0
        errors = []
        items = []

        for row in rows:
            if body.limit is not None and processed >= body.limit:
                break

            processed += 1
            empresa_id = row["id"]
            nome = row["nome"]
            cnpj = clean_cnpj(row["cnpj"] or "")
            descoberta = None

            already_enriched = bool(row["dados_cnpj"]) and bool(cnpj)
            if body.only_missing and already_enriched and not body.force:
                skipped += 1
                items.append(
                    {
                        "id": str(empresa_id),
                        "nome": nome,
                        "status": "skipped",
                        "motivo": "já enriquecida",
                    }
                )
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

                saved = await salvar_dados_cnpj(conn, empresa_id, data, cnpj)
                await log_atividade(
                    conn,
                    empresa_id,
                    "enrich_auto",
                    "Empresa enriquecida em lote com descoberta de CNPJ" if descoberta else "Empresa enriquecida em lote via CNPJ",
                    {"cnpj": cnpj, "fonte": data.get("fonte"), "descoberta": descoberta},
                )
                enriched += 1
                items.append(
                    {
                        "id": str(empresa_id),
                        "nome": nome,
                        "status": "ok",
                        "cnpj": cnpj,
                        "fonte": data.get("fonte"),
                        "razao_social": saved["razao_social"],
                    }
                )
            except Exception as exc:
                errors.append(
                    {
                        "id": str(empresa_id),
                        "nome": nome,
                        "error": str(exc),
                    }
                )
                items.append(
                    {
                        "id": str(empresa_id),
                        "nome": nome,
                        "status": "error",
                        "error": str(exc),
                    }
                )

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
    finally:
        await conn.close()
