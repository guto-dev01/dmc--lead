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
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db, new_id, now, serialize, ieq
from services.people_search import pesquisar_decisores, buscar_contato
from services.cnpj_enrichment import casar_email_dono
from services.auth import require_auth, conta_atual
from services.atividades import registrar
from services.ramos import normalizar_ramo


def _autor(user) -> Optional[str]:
    return (user or {}).get("sub") if isinstance(user, dict) else None

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
    ramo: Optional[str] = None,
    empresa_id: Optional[str] = None,
    conta_id: str = Depends(conta_atual),
):
    """Agrega os decisores (QSA da Receita + contatos salvos) de todas as
    empresas enriquecidas, com filtros."""
    db = get_db()
    filtro_emp: dict = {"conta_id": conta_id}
    if ramo:
        filtro_emp["ramo"] = normalizar_ramo(ramo)
    proj = {
        "nome": 1, "razao_social": 1, "nome_fantasia": 1, "tipo": 1, "ramo": 1, "municipio": 1,
        "uf": 1, "bairro": 1, "whatsapp": 1, "telefone": 1, "website": 1, "dados_cnpj": 1,
    }
    rows = await db.empresas.find(filtro_emp, proj).sort([("score", -1), ("nome", 1)]).to_list(length=None)
    contatos = [serialize(c) for c in await db.contatos.find({"conta_id": conta_id}).to_list(length=None)]

    # contatos por empresa, e set de (empresa_id, nome_lower) para marcar 'salvo'
    contatos_por_emp: dict[str, list] = {}
    salvos: set[tuple] = set()
    for c in contatos:
        eid = c["empresa_id"] if c.get("empresa_id") else None
        if eid:
            contatos_por_emp.setdefault(eid, []).append(c)
            salvos.add((eid, (c.get("nome") or "").strip().lower()))

    pessoas: list[dict] = []
    quals: dict[str, int] = {}

    for r in rows:
        r = serialize(r)
        eid = r["id"]
        emp_nome = r.get("nome_fantasia") or r.get("nome") or r.get("razao_social")
        emp_meta = {
            "empresa_id": eid,
            "empresa_nome": emp_nome,
            "empresa_tipo": r.get("tipo"),
            "cidade": r.get("municipio"),
            "uf": r.get("uf"),
            "empresa_whatsapp": r.get("whatsapp"),
            "empresa_telefone": r.get("telefone"),
            "empresa_website": r.get("website"),
        }

        # 1) QSA (Receita Federal)
        dados = _parse_dados(r.get("dados_cnpj"))
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
            qual = c.get("cargo") or "Contato"
            quals[qual] = quals.get(qual, 0) + 1
            pessoas.append({
                **emp_meta,
                "nome": c.get("nome"), "qualificacao": qual,
                "faixa_etaria": None, "data_entrada": None,
                "fonte": "Contato salvo",
                "salvo": True,
                "contato_id": c["id"],
                "email": c.get("email"), "telefone": c.get("telefone"),
                "whatsapp_pessoa": c.get("whatsapp"), "linkedin": c.get("linkedin"),
                "notas": c.get("notas"),
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


class PesquisaRequest(BaseModel):
    empresa: Optional[str] = None
    empresa_id: Optional[str] = None
    termo: Optional[str] = ""


@router.post("/pesquisar")
async def pesquisar(body: PesquisaRequest, conta_id: str = Depends(conta_atual)):
    """Pesquisa decisores de uma empresa na web (material de estudo)."""
    nome = (body.empresa or "").strip()
    if not nome and body.empresa_id:
        db = get_db()
        r = await db.empresas.find_one(
            {"_id": body.empresa_id, "conta_id": conta_id}, {"nome": 1, "nome_fantasia": 1, "razao_social": 1}
        )
        if r:
            nome = r.get("nome_fantasia") or r.get("nome") or r.get("razao_social") or ""
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
async def buscar_contato_decisor(body: ContatoBuscaRequest, conta_id: str = Depends(conta_atual)):
    """Procura e-mail e telefone de um decisor (ou da empresa): Hunter.io + web."""
    nome = (body.nome or "").strip()
    empresa = (body.empresa or "").strip()
    website = (body.website or "").strip()
    if (not empresa or not website) and body.empresa_id:
        db = get_db()
        r = await db.empresas.find_one(
            {"_id": body.empresa_id, "conta_id": conta_id},
            {"nome": 1, "nome_fantasia": 1, "razao_social": 1, "website": 1},
        )
        if r:
            empresa = empresa or (r.get("nome_fantasia") or r.get("nome") or r.get("razao_social") or "")
            website = website or (r.get("website") or "")
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
async def buscar_contato_massa(body: BuscaMassaRequest, conta_id: str = Depends(conta_atual)):
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
    db = get_db()
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
                existe = await db.empresas.find_one({"_id": alvo.empresa_id, "conta_id": conta_id}, {"_id": 1})
                if existe:
                    ja = await db.contatos.find_one(
                        {"empresa_id": alvo.empresa_id, "nome": ieq(alvo.nome.strip())}, {"_id": 1}
                    )
                    if ja:
                        sets = {}
                        if email:
                            sets["email"] = email
                        if telefone:
                            sets["telefone"] = telefone
                            sets["whatsapp"] = telefone
                        # cargo só se ainda não houver (COALESCE(cargo, ...))
                        atual = await db.contatos.find_one({"_id": ja["_id"]}, {"cargo": 1})
                        if not (atual or {}).get("cargo") and alvo.qualificacao:
                            sets["cargo"] = alvo.qualificacao
                        if sets:
                            await db.contatos.update_one({"_id": ja["_id"]}, {"$set": sets})
                    else:
                        await db.contatos.insert_one({
                            "_id": new_id(), "conta_id": conta_id, "empresa_id": alvo.empresa_id,
                            "nome": alvo.nome.strip(), "cargo": alvo.qualificacao,
                            "email": email, "telefone": telefone, "whatsapp": telefone,
                            "created_at": now(),
                        })
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


@router.get("/clientes")
async def listar_clientes(busca: Optional[str] = None, ramo: Optional[str] = None, conta_id: str = Depends(conta_atual)):
    """Lista os clientes cadastrados (contatos salvos), com a empresa de origem.
    Quando `ramo` é informado, traz só os clientes de empresas daquele ramo."""
    db = get_db()
    ramo_alvo = normalizar_ramo(ramo) if ramo else None
    contatos = await db.contatos.find({"conta_id": conta_id}).sort("created_at", -1).to_list(length=None)
    emp_ids = list({c["empresa_id"] for c in contatos if c.get("empresa_id")})
    emp_map = {}
    if emp_ids:
        empresas = await db.empresas.find(
            {"_id": {"$in": emp_ids}, "conta_id": conta_id},
            {"nome": 1, "nome_fantasia": 1, "razao_social": 1, "ramo": 1},
        ).to_list(length=None)
        emp_map = {e["_id"]: e for e in empresas}

    items = []
    for c in contatos:
        c = serialize(c)
        e = emp_map.get(c.get("empresa_id"))
        if ramo_alvo:
            # ramo do cliente = ramo da empresa de origem (padrão quando não marcado)
            emp_ramo = normalizar_ramo((e or {}).get("ramo")) if e else normalizar_ramo(None)
            if emp_ramo != ramo_alvo:
                continue
        emp_nome = (e.get("nome_fantasia") or e.get("nome") or e.get("razao_social")) if e else None
        items.append({
            "id": c["id"],
            "nome": c.get("nome"),
            "cargo": c.get("cargo"),
            "email": c.get("email"),
            "telefone": c.get("telefone"),
            "whatsapp": c.get("whatsapp"),
            "linkedin": c.get("linkedin"),
            "notas": c.get("notas"),
            "empresa_id": c.get("empresa_id"),
            "empresa_nome": emp_nome,
        })
    if busca:
        b = busca.lower()
        items = [
            i for i in items
            if b in f"{i['nome']} {i['empresa_nome'] or ''} {i['cargo'] or ''} {i['email'] or ''} {i['telefone'] or ''}".lower()
        ]
    return {"total": len(items), "items": items}


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
async def salvar_contato(body: ContatoCreate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Salva um decisor como contato vinculado à empresa."""
    if not body.nome.strip():
        raise HTTPException(status_code=400, detail="Informe o nome.")
    db = get_db()
    existe = await db.empresas.find_one({"_id": body.empresa_id, "conta_id": conta_id}, {"_id": 1})
    if not existe:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    doc = {
        "_id": new_id(), "conta_id": conta_id, "empresa_id": body.empresa_id, "nome": body.nome.strip(),
        "cargo": body.cargo, "email": body.email, "telefone": body.telefone,
        "whatsapp": body.whatsapp, "linkedin": body.linkedin, "notas": body.notas,
        "created_at": now(),
    }
    await db.contatos.insert_one(doc)
    await registrar(db, "contato_criado", autor=_autor(user),
                    descricao=f"Contato \"{doc['nome']}\" cadastrado",
                    empresa_id=body.empresa_id, conta_id=conta_id)
    return {"ok": True, "contato": serialize(doc)}


@router.delete("/contato/{contato_id}")
async def excluir_contato(contato_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    await db.contatos.delete_one({"_id": contato_id, "conta_id": conta_id})
    return {"ok": True}
