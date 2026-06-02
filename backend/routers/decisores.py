"""Decisores: encontrar donos, sócios, diretores e demais pessoas com quem dá
para fazer negócio no ramo imobiliário.

Duas fontes:
1. QSA (quadro de sócios e administradores) já guardado no enriquecimento de
   CNPJ das empresas — donos/diretores reais da Receita Federal.
2. Pesquisa na web (Bing/DuckDuckGo) por empresa, para estudo.

E permite salvar a pessoa como `contato` vinculado à empresa.
"""
import asyncio
import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database import get_conn
from services.people_search import pesquisar_decisores, buscar_contato
from services.cnpj_enrichment import casar_email_dono

router = APIRouter()


def _norm_socio(s: dict) -> dict:
    """Normaliza uma entrada de QSA (formatos BrasilAPI e ReceitaWS)."""
    nome = s.get("nome_socio") or s.get("nome") or s.get("nome_razao_social")
    qual = s.get("qualificacao_socio") or s.get("qual") or s.get("qualificacao")
    return {
        "nome": (nome or "").strip(),
        "qualificacao": (qual or "").strip() or "Sócio/Administrador",
        "faixa_etaria": s.get("faixa_etaria"),
        "data_entrada": s.get("data_entrada_sociedade") or s.get("data_entrada"),
    }


def _parse_dados(dados) -> dict:
    if not dados:
        return {}
    if isinstance(dados, str):
        try:
            return json.loads(dados)
        except Exception:
            return {}
    return dict(dados)


@router.get("")
async def listar_decisores(
    busca: Optional[str] = None,
    qualificacao: Optional[str] = None,
    tipo: Optional[str] = None,
    empresa_id: Optional[str] = None,
):
    """Agrega os decisores (QSA da Receita + contatos salvos) de todas as
    empresas enriquecidas, com filtros."""
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """SELECT id, nome, razao_social, nome_fantasia, tipo, municipio, uf,
                      bairro, whatsapp, telefone, website, dados_cnpj
               FROM empresas
               ORDER BY score DESC, nome"""
        )
        contatos = await conn.fetch("SELECT * FROM contatos")

        # contatos por empresa, e set de (empresa_id, nome_lower) para marcar 'salvo'
        contatos_por_emp: dict[str, list] = {}
        salvos: set[tuple] = set()
        for c in contatos:
            eid = str(c["empresa_id"]) if c["empresa_id"] else None
            if eid:
                contatos_por_emp.setdefault(eid, []).append(c)
                salvos.add((eid, (c["nome"] or "").strip().lower()))

        pessoas: list[dict] = []
        quals: dict[str, int] = {}

        for r in rows:
            eid = str(r["id"])
            emp_nome = r["nome_fantasia"] or r["nome"] or r["razao_social"]
            emp_meta = {
                "empresa_id": eid,
                "empresa_nome": emp_nome,
                "empresa_tipo": r["tipo"],
                "cidade": r["municipio"],
                "uf": r["uf"],
                "empresa_whatsapp": r["whatsapp"],
                "empresa_telefone": r["telefone"],
                "empresa_website": r["website"],
            }

            # 1) QSA (Receita Federal)
            dados = _parse_dados(r["dados_cnpj"])
            for s in (dados.get("qsa") or []):
                p = _norm_socio(s)
                if not p["nome"]:
                    continue
                quals[p["qualificacao"]] = quals.get(p["qualificacao"], 0) + 1
                pessoas.append({
                    **emp_meta, **p,
                    "fonte": "Receita Federal (QSA)",
                    "salvo": (eid, p["nome"].lower()) in salvos,
                    "email": None, "telefone": None, "linkedin": None,
                })

            # 2) Contatos já salvos para a empresa
            for c in contatos_por_emp.get(eid, []):
                qual = c["cargo"] or "Contato"
                quals[qual] = quals.get(qual, 0) + 1
                pessoas.append({
                    **emp_meta,
                    "nome": c["nome"], "qualificacao": qual,
                    "faixa_etaria": None, "data_entrada": None,
                    "fonte": "Contato salvo",
                    "salvo": True,
                    "contato_id": str(c["id"]),
                    "email": c["email"], "telefone": c["telefone"],
                    "whatsapp_pessoa": c["whatsapp"], "linkedin": c["linkedin"],
                    "notas": c["notas"],
                })

        # filtros
        def _ok(p: dict) -> bool:
            if empresa_id and p["empresa_id"] != empresa_id:
                return False
            if tipo and (p.get("empresa_tipo") or "") != tipo:
                return False
            if qualificacao and qualificacao.lower() not in (p.get("qualificacao") or "").lower():
                return False
            if busca:
                alvo = f"{p.get('nome','')} {p.get('empresa_nome','')} {p.get('qualificacao','')}".lower()
                if busca.lower() not in alvo:
                    return False
            return True

        filtradas = [p for p in pessoas if _ok(p)]
        # salvos/contatos primeiro, depois ordena por empresa
        filtradas.sort(key=lambda p: (0 if p["fonte"] == "Contato salvo" else 1, p.get("empresa_nome") or "", p.get("nome") or ""))

        return {
            "total": len(filtradas),
            "total_geral": len(pessoas),
            "qualificacoes": [
                {"label": k, "total": v}
                for k, v in sorted(quals.items(), key=lambda kv: -kv[1])
            ],
            "items": filtradas,
        }
    finally:
        await conn.close()


class PesquisaRequest(BaseModel):
    empresa: Optional[str] = None
    empresa_id: Optional[str] = None
    termo: Optional[str] = ""


@router.post("/pesquisar")
async def pesquisar(body: PesquisaRequest):
    """Pesquisa decisores de uma empresa na web (material de estudo)."""
    nome = (body.empresa or "").strip()
    conn = None
    if not nome and body.empresa_id:
        conn = await get_conn()
        try:
            r = await conn.fetchrow(
                "SELECT nome, nome_fantasia, razao_social FROM empresas WHERE id = $1",
                uuid.UUID(body.empresa_id),
            )
            if r:
                nome = r["nome_fantasia"] or r["nome"] or r["razao_social"] or ""
        finally:
            await conn.close()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe a empresa para pesquisar.")

    resultado = await pesquisar_decisores(nome, body.termo or "")
    return {"ok": True, **resultado}


class ContatoBuscaRequest(BaseModel):
    nome: Optional[str] = ""
    empresa: Optional[str] = None
    empresa_id: Optional[str] = None
    website: Optional[str] = None


@router.post("/contato/buscar")
async def buscar_contato_decisor(body: ContatoBuscaRequest):
    """Procura e-mail e telefone de um decisor (ou da empresa): Hunter.io + web."""
    nome = (body.nome or "").strip()
    empresa = (body.empresa or "").strip()
    website = (body.website or "").strip()
    if (not empresa or not website) and body.empresa_id:
        conn = await get_conn()
        try:
            r = await conn.fetchrow(
                "SELECT nome, nome_fantasia, razao_social, website FROM empresas WHERE id = $1",
                uuid.UUID(body.empresa_id),
            )
            if r:
                empresa = empresa or (r["nome_fantasia"] or r["nome"] or r["razao_social"] or "")
                website = website or (r["website"] or "")
        finally:
            await conn.close()
    if not nome and not empresa:
        raise HTTPException(status_code=400, detail="Informe a pessoa ou a empresa.")
    resultado = await buscar_contato(nome, empresa, website)
    return {"ok": True, **resultado}


class BuscaMassaAlvo(BaseModel):
    nome: str
    empresa_nome: Optional[str] = None
    empresa_id: Optional[str] = None
    empresa_website: Optional[str] = None
    qualificacao: Optional[str] = None


class BuscaMassaRequest(BaseModel):
    alvos: List[BuscaMassaAlvo]
    salvar: bool = True


@router.post("/contato/buscar-massa")
async def buscar_contato_massa(body: BuscaMassaRequest):
    """Busca e-mail/telefone de vários decisores de uma vez e, quando `salvar`,
    cadastra cada um como cliente (contato) com os dados encontrados.

    Otimização: a busca na web é feita **uma vez por empresa** (não por pessoa);
    os e-mails/telefones encontrados são distribuídos aos sócios daquela empresa,
    casando o e-mail pelo nome quando dá. Isso evita refazer a mesma busca para
    cada sócio da mesma incorporadora."""
    alvos = (body.alvos or [])[:120]
    if not alvos:
        raise HTTPException(status_code=400, detail="Nenhum decisor informado.")

    # Agrupa por empresa (chave preferida: empresa_id)
    empresas: dict[str, dict] = {}
    for a in alvos:
        chave = a.empresa_id or (a.empresa_nome or "").strip().lower()
        if not chave:
            continue
        emp = empresas.setdefault(chave, {"nome": "", "website": ""})
        if not emp["nome"] and (a.empresa_nome or "").strip():
            emp["nome"] = a.empresa_nome.strip()
        if not emp["website"] and (a.empresa_website or "").strip():
            emp["website"] = a.empresa_website.strip()

    sem = asyncio.Semaphore(8)

    async def _buscar_empresa(chave: str, dados: dict):
        async with sem:
            try:
                r = await buscar_contato("", dados.get("nome") or "", dados.get("website") or "")
            except Exception:
                r = {}
            emails = [
                (e.get("email") if isinstance(e, dict) else e)
                for e in (r.get("emails") or [])
                if (e.get("email") if isinstance(e, dict) else e)
            ]
            telefones = r.get("telefones") or []
            return chave, {"emails": emails, "telefone": telefones[0] if telefones else None}

    pares = await asyncio.gather(*[_buscar_empresa(k, v) for k, v in empresas.items()])
    por_empresa = {chave: dados for chave, dados in pares}

    salvos = 0
    com_contato = 0
    items: list[dict] = []
    conn = await get_conn()
    try:
        for alvo in alvos:
            chave = alvo.empresa_id or (alvo.empresa_nome or "").strip().lower()
            achado = por_empresa.get(chave, {})
            emails = achado.get("emails") or []
            telefone = achado.get("telefone")
            email = casar_email_dono(alvo.nome or "", emails) or (emails[0] if emails else None)
            tem = bool(email or telefone)
            if tem:
                com_contato += 1
            salvo = False
            if body.salvar and tem and alvo.empresa_id and (alvo.nome or "").strip():
                try:
                    emp = uuid.UUID(alvo.empresa_id)
                    existe = await conn.fetchval("SELECT 1 FROM empresas WHERE id = $1", emp)
                    if existe:
                        ja = await conn.fetchval(
                            "SELECT id FROM contatos WHERE empresa_id = $1 AND lower(nome) = lower($2)",
                            emp, alvo.nome.strip(),
                        )
                        if ja:
                            await conn.execute(
                                """UPDATE contatos
                                   SET email = COALESCE(NULLIF($2, ''), email),
                                       telefone = COALESCE(NULLIF($3, ''), telefone),
                                       whatsapp = COALESCE(NULLIF($4, ''), whatsapp),
                                       cargo = COALESCE(cargo, NULLIF($5, ''))
                                   WHERE id = $1""",
                                ja, email or "", telefone or "", telefone or "", alvo.qualificacao or "",
                            )
                        else:
                            await conn.execute(
                                """INSERT INTO contatos (empresa_id, nome, cargo, email, telefone, whatsapp)
                                   VALUES ($1, $2, $3, $4, $5, $6)""",
                                emp, alvo.nome.strip(), alvo.qualificacao, email, telefone, telefone,
                            )
                        salvo = True
                        salvos += 1
                except Exception:
                    pass
            items.append({
                "nome": alvo.nome,
                "empresa_id": alvo.empresa_id,
                "email": email,
                "telefone": telefone,
                "tem_contato": tem,
                "salvo": salvo,
            })

        return {
            "ok": True,
            "total": len(items),
            "com_contato": com_contato,
            "salvos": salvos,
            "items": items,
        }
    finally:
        await conn.close()


@router.get("/clientes")
async def listar_clientes(busca: Optional[str] = None):
    """Lista os clientes cadastrados (contatos salvos), com a empresa de origem."""
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """SELECT c.id, c.nome, c.cargo, c.email, c.telefone, c.whatsapp,
                      c.linkedin, c.notas, c.empresa_id, c.created_at,
                      e.nome_fantasia, e.nome AS empresa_nome_raw, e.razao_social
               FROM contatos c
               LEFT JOIN empresas e ON c.empresa_id = e.id
               ORDER BY c.created_at DESC"""
        )
        items = []
        for r in rows:
            emp_nome = r["nome_fantasia"] or r["empresa_nome_raw"] or r["razao_social"]
            items.append({
                "id": str(r["id"]),
                "nome": r["nome"],
                "cargo": r["cargo"],
                "email": r["email"],
                "telefone": r["telefone"],
                "whatsapp": r["whatsapp"],
                "linkedin": r["linkedin"],
                "notas": r["notas"],
                "empresa_id": str(r["empresa_id"]) if r["empresa_id"] else None,
                "empresa_nome": emp_nome,
            })
        if busca:
            b = busca.lower()
            items = [
                i for i in items
                if b in f"{i['nome']} {i['empresa_nome'] or ''} {i['cargo'] or ''} {i['email'] or ''} {i['telefone'] or ''}".lower()
            ]
        return {"total": len(items), "items": items}
    finally:
        await conn.close()


class ContatoCreate(BaseModel):
    empresa_id: str
    nome: str
    cargo: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    linkedin: Optional[str] = None
    notas: Optional[str] = None


@router.post("/contato")
async def salvar_contato(body: ContatoCreate):
    """Salva um decisor como contato vinculado à empresa."""
    if not body.nome.strip():
        raise HTTPException(status_code=400, detail="Informe o nome.")
    conn = await get_conn()
    try:
        try:
            emp = uuid.UUID(body.empresa_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="empresa_id inválido.")
        existe = await conn.fetchval("SELECT 1 FROM empresas WHERE id = $1", emp)
        if not existe:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")
        row = await conn.fetchrow(
            """INSERT INTO contatos (empresa_id, nome, cargo, email, telefone, whatsapp, linkedin, notas)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *""",
            emp, body.nome.strip(), body.cargo, body.email, body.telefone,
            body.whatsapp, body.linkedin, body.notas,
        )
        return {"ok": True, "contato": dict(row)}
    finally:
        await conn.close()


@router.delete("/contato/{contato_id}")
async def excluir_contato(contato_id: str):
    conn = await get_conn()
    try:
        await conn.execute("DELETE FROM contatos WHERE id = $1", uuid.UUID(contato_id))
        return {"ok": True}
    finally:
        await conn.close()
