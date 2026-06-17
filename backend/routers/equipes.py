"""Módulo de Equipes e Colaboradores.

Organiza os usuários do sistema em equipes e funções organizacionais e mede a
produtividade — individual e por equipe — exclusivamente a partir de EVENTOS
REAIS já registrados em `db.atividades` (com o autor de cada ação). Nenhum
indicador é fabricado: o que não tem autor real simplesmente não é contado.

Importante (decisão de produto): a FUNÇÃO é organizacional, não restringe acesso.
Todos os usuários continuam acessando todas as telas; aqui só identificamos quem
é quem e o que cada um produziu.
"""
import asyncio
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from database import get_db, new_id, now, serialize, settings
from services.auth import (
    require_auth, conta_atual, create_action_token, RESET_TTL_SECONDS,
)
from services.atividades import TIPOS_PRODUTIVIDADE
from services import auth_emails, mailer

router = APIRouter()

# Funções organizacionais possíveis (não restringem acesso).
FUNCOES = ["dono", "prospector", "vendedor", "atendente", "auxiliar"]
FUNCOES_LABEL = {
    "dono": "Dono",
    "prospector": "Prospector",
    "vendedor": "Vendedor",
    "atendente": "Atendente",
    "auxiliar": "Auxiliar do Sistema",
}

# Convite de colaborador: link para definir a senha vale 7 dias.
CONVITE_TTL_SECONDS = 60 * 60 * 24 * 7

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _autor(user) -> Optional[str]:
    return (user or {}).get("sub") if isinstance(user, dict) else None


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


def _frontend_base() -> str:
    """Mesma resolução usada no fluxo de senha (auth)."""
    import os
    if settings.app_public_url:
        base = settings.app_public_url
    else:
        origins = [o.strip() for o in (os.environ.get("FRONTEND_ORIGIN", "") or "").split(",") if o.strip()]
        base = origins[0] if origins else settings.backend_public_url
    return base.rstrip("/")


# ---------------------------------------------------------------------------
# Agregação de produtividade (a partir de db.atividades)
# ---------------------------------------------------------------------------

def _inicio_periodo(periodo: Optional[str]) -> Optional[datetime]:
    """Converte um período textual em data inicial (UTC). None = desde sempre."""
    agora = now()
    if periodo == "hoje":
        return agora - timedelta(days=1)
    if periodo == "semana":
        return agora - timedelta(days=7)
    if periodo == "mes":
        return agora - timedelta(days=30)
    return None  # "tudo" ou não informado


async def _carregar_atividades(db, inicio: Optional[datetime], conta_id):
    """Eventos de produtividade COM autor (sem autor = não atribuível)."""
    query = {"conta_id": conta_id, "autor": {"$nin": [None, ""]}, "tipo": {"$in": list(TIPOS_PRODUTIVIDADE.keys())}}
    if inicio is not None:
        query["created_at"] = {"$gte": inicio}
    return await db.atividades.find(
        query, {"autor": 1, "tipo": 1, "created_at": 1}
    ).to_list(length=None)


async def _mapa_usuarios(db, conta_id):
    """email -> doc do usuário (colaborador) da conta."""
    usuarios = await db.usuarios.find({"conta_id": conta_id}).to_list(length=None)
    return {u["email"]: u for u in usuarios}


async def _mapa_equipes(db, conta_id):
    equipes = await db.equipes.find({"conta_id": conta_id}).to_list(length=None)
    return {e["_id"]: e for e in equipes}


def _bucket_dia(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


async def _agregar(db, periodo: Optional[str], conta_id):
    """Monta produção por colaborador e por equipe a partir dos eventos reais."""
    inicio = _inicio_periodo(periodo)
    atividades = await _carregar_atividades(db, inicio, conta_id)
    usuarios = await _mapa_usuarios(db, conta_id)
    equipes = await _mapa_equipes(db, conta_id)

    # contadores por autor
    por_autor: dict = {}
    evol: dict = {}
    for a in atividades:
        autor = a.get("autor")
        tipo = a.get("tipo")
        slot = por_autor.setdefault(autor, {"total": 0, "por_tipo": {}})
        slot["total"] += 1
        slot["por_tipo"][tipo] = slot["por_tipo"].get(tipo, 0) + 1
        dia = _bucket_dia(a.get("created_at"))
        evol[dia] = evol.get(dia, 0) + 1

    # Colaboradores = MEMBROS DO TIME (não-gestores). O próprio dono/gestor NÃO
    # aparece nesta lista — esta visão é para medir a equipe, não o gestor que a
    # acompanha. Autores avulsos sem cadastro (ex.: admin do ambiente) também
    # ficam de fora.
    colaboradores = []
    for email, u in usuarios.items():
        funcao = u.get("funcao") or "dono"
        if funcao == "dono":
            continue
        prod = por_autor.get(email, {"total": 0, "por_tipo": {}})
        eq = equipes.get(u.get("equipe_id"))
        colaboradores.append({
            "id": u["_id"], "email": email, "nome": u.get("nome") or email,
            "funcao": funcao, "status": u.get("status"),
            "equipe_id": u.get("equipe_id"), "equipe_nome": eq.get("nome") if eq else None,
            "total": prod["total"], "por_tipo": prod["por_tipo"],
        })

    # produção por equipe (soma dos membros)
    por_equipe = []
    for eid, e in equipes.items():
        membros = [c for c in colaboradores if c["equipe_id"] == eid]
        total = sum(c["total"] for c in membros)
        agg_tipo: dict = {}
        for c in membros:
            for t, n in c["por_tipo"].items():
                agg_tipo[t] = agg_tipo.get(t, 0) + n
        por_equipe.append({
            "id": eid, "nome": e.get("nome"), "status": e.get("status"),
            "membros": len(membros), "total": total, "por_tipo": agg_tipo,
        })

    colaboradores.sort(key=lambda c: c["total"], reverse=True)
    por_equipe.sort(key=lambda e: e["total"], reverse=True)

    # evolução diária dos últimos 14 dias (série contínua)
    serie = []
    base = now()
    for i in range(13, -1, -1):
        dia = _bucket_dia(base - timedelta(days=i))
        serie.append({"data": dia, "total": evol.get(dia, 0)})

    return {
        "periodo": periodo or "tudo",
        "colaboradores": colaboradores,
        "equipes": por_equipe,
        "evolucao": serie,
        "tipos": TIPOS_PRODUTIVIDADE,
    }


# ===========================================================================
# DASHBOARD / DESEMPENHO  (rotas literais ANTES das com {id})
# ===========================================================================

@router.get("/dashboard")
async def dashboard_equipes(user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    total_equipes = await db.equipes.count_documents({"conta_id": conta_id})
    equipes_ativas = await db.equipes.count_documents({"conta_id": conta_id, "status": "ativa"})
    # "Colaboradores" = membros do time (todas as funções, menos o gestor/dono).
    membros_funcoes = [f for f in FUNCOES if f != "dono"]
    total_colab = await db.usuarios.count_documents(
        {"conta_id": conta_id, "funcao": {"$in": membros_funcoes}}
    )
    por_funcao = {}
    for f in FUNCOES:
        por_funcao[f] = await db.usuarios.count_documents({"conta_id": conta_id, "funcao": f})
    # usuários sem função definida contam como dono (auto-cadastro legado)
    sem_funcao = await db.usuarios.count_documents({"conta_id": conta_id, "funcao": {"$in": [None, ""]}})
    por_funcao["dono"] += sem_funcao
    return {
        "total_equipes": total_equipes,
        "equipes_ativas": equipes_ativas,
        "total_colaboradores": total_colab,
        "por_funcao": por_funcao,
        "funcoes_label": FUNCOES_LABEL,
    }


@router.get("/desempenho")
async def desempenho(periodo: Optional[str] = Query(None), user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    return await _agregar(db, periodo, conta_id)


# ===========================================================================
# COLABORADORES  (rotas literais ANTES de /{equipe_id})
# ===========================================================================

class ColaboradorCreate(BaseModel):
    nome: str
    email: str
    telefone: Optional[str] = ""
    funcao: str = "prospector"
    equipe_id: Optional[str] = None


class ColaboradorUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    funcao: Optional[str] = None
    equipe_id: Optional[str] = None
    status: Optional[str] = None


@router.get("/colaboradores")
async def listar_colaboradores(
    busca: Optional[str] = None,
    funcao: Optional[str] = None,
    equipe_id: Optional[str] = None,
    periodo: Optional[str] = Query(None),
    user=Depends(require_auth),
    conta_id: str = Depends(conta_atual),
):
    db = get_db()
    dados = await _agregar(db, periodo, conta_id)
    itens = [c for c in dados["colaboradores"] if c["id"]]  # só usuários cadastrados
    if funcao:
        itens = [c for c in itens if c["funcao"] == funcao]
    if equipe_id:
        itens = [c for c in itens if c["equipe_id"] == equipe_id]
    if busca:
        b = busca.lower()
        itens = [c for c in itens if b in (c["nome"] or "").lower() or b in (c["email"] or "").lower()]
    return {"items": itens, "tipos": TIPOS_PRODUTIVIDADE, "funcoes_label": FUNCOES_LABEL}


@router.post("/colaboradores")
async def criar_colaborador(body: ColaboradorCreate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    nome = (body.nome or "").strip()
    email = _norm_email(body.email)
    funcao = body.funcao if body.funcao in FUNCOES else "prospector"
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do colaborador.")
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Informe um e-mail válido.")

    db = get_db()
    if await db.usuarios.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Já existe um usuário com este e-mail.")
    if body.equipe_id and not await db.equipes.find_one({"_id": body.equipe_id, "conta_id": conta_id}):
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")

    if not mailer.email_configurado():
        raise HTTPException(
            status_code=503,
            detail="Configure o e-mail (RESEND_API_KEY/BREVO_API_KEY ou SMTP) para cadastrar colaboradores (eles recebem um e-mail para definir a senha).",
        )

    ts = now()
    uid = new_id()
    jti = secrets.token_urlsafe(16)
    doc = {
        "_id": uid, "nome": nome, "email": email, "telefone": (body.telefone or "").strip(),
        "senha_hash": "", "papel": "dono" if funcao == "dono" else "colaborador",
        # Colaborador pertence à conta (tenant) do dono que o cadastrou.
        "conta_id": conta_id,
        "funcao": funcao, "equipe_id": body.equipe_id or None,
        "status": "aprovado",  # criado pelo dono → já liberado (falta só definir a senha)
        "reset_jti": jti, "reset_exp": int(ts.timestamp()) + CONVITE_TTL_SECONDS,
        "criado_por": _autor(user), "created_at": ts, "updated_at": ts,
        "ultimo_acesso": None, "aprovado_em": ts, "recusado_em": None,
    }
    await db.usuarios.insert_one(doc)

    # envia o convite para a pessoa definir a senha (reusa o fluxo de senha)
    try:
        token = create_action_token("reset", uid, jti, CONVITE_TTL_SECONDS)
        link = f"{_frontend_base()}/redefinir-senha?token={token}"
        corpo = auth_emails.email_definir_senha(nome, link, FUNCOES_LABEL.get(funcao, "colaborador"))
        await asyncio.to_thread(mailer.enviar_email, email, "Bem-vindo ao sistema — defina sua senha", corpo)
    except Exception:
        await db.usuarios.delete_one({"_id": uid})
        raise HTTPException(
            status_code=503,
            detail="Não foi possível enviar o e-mail de acesso ao colaborador. Tente novamente.",
        )

    return {"ok": True, "colaborador": serialize(doc),
            "message": "Colaborador cadastrado. Ele receberá um e-mail para definir a senha."}


@router.get("/colaboradores/{colaborador_id}")
async def perfil_colaborador(colaborador_id: str, periodo: Optional[str] = Query(None),
                             user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    u = await db.usuarios.find_one({"_id": colaborador_id, "conta_id": conta_id})
    if not u:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")

    eq = None
    if u.get("equipe_id"):
        eq = await db.equipes.find_one({"_id": u["equipe_id"], "conta_id": conta_id}, {"nome": 1})

    inicio = _inicio_periodo(periodo)
    query = {"conta_id": conta_id, "autor": u["email"], "tipo": {"$in": list(TIPOS_PRODUTIVIDADE.keys())}}
    if inicio is not None:
        query["created_at"] = {"$gte": inicio}

    eventos = await db.atividades.find(query).sort("created_at", -1).to_list(length=None)
    por_tipo: dict = {}
    for e in eventos:
        por_tipo[e["tipo"]] = por_tipo.get(e["tipo"], 0) + 1
    historico = [
        {"tipo": e["tipo"], "descricao": e.get("descricao"), "created_at": e.get("created_at")}
        for e in eventos[:50]
    ]

    return {
        "colaborador": {
            "id": u["_id"], "nome": u.get("nome"), "email": u["email"],
            "telefone": u.get("telefone"), "funcao": u.get("funcao") or "dono",
            "status": u.get("status"), "equipe_id": u.get("equipe_id"),
            "equipe_nome": eq.get("nome") if eq else None,
            "criado_em": u.get("created_at"), "ultimo_acesso": u.get("ultimo_acesso"),
        },
        "total": len(eventos),
        "por_tipo": por_tipo,
        "historico": historico,
        "tipos": TIPOS_PRODUTIVIDADE,
        "funcoes_label": FUNCOES_LABEL,
    }


@router.get("/colaboradores/{colaborador_id}/atividades")
async def atividades_colaborador(
    colaborador_id: str,
    limit: int = Query(40, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user=Depends(require_auth),
    conta_id: str = Depends(conta_atual),
):
    """Registro COMPLETO de tudo que o colaborador fez (auditoria), em ordem
    cronológica decrescente e paginado. É a visão "cada detalhe" usada pelo
    gestor: inclui criações, edições, exclusões, envios e enriquecimentos."""
    db = get_db()
    u = await db.usuarios.find_one(
        {"_id": colaborador_id, "conta_id": conta_id}, {"email": 1, "nome": 1}
    )
    if not u:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")

    query = {"conta_id": conta_id, "autor": u["email"]}
    total = await db.auditoria.count_documents(query)
    rows = (
        await db.auditoria.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )
    itens = [
        {
            "id": r["_id"], "acao": r.get("acao"), "metodo": r.get("metodo"),
            "caminho": r.get("caminho"), "recurso": r.get("recurso"),
            "status_code": r.get("status_code"), "ok": r.get("ok"),
            "created_at": r.get("created_at"),
        }
        for r in rows
    ]
    return {
        "items": itens,
        "total": total,
        "skip": skip,
        "limit": limit,
        "tem_mais": skip + len(itens) < total,
        "colaborador": {"id": u["_id"], "nome": u.get("nome"), "email": u["email"]},
    }


@router.patch("/colaboradores/{colaborador_id}")
async def atualizar_colaborador(colaborador_id: str, body: ColaboradorUpdate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    u = await db.usuarios.find_one({"_id": colaborador_id, "conta_id": conta_id})
    if not u:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")

    sets = {"updated_at": now()}
    if body.nome is not None:
        nome = body.nome.strip()
        if not nome:
            raise HTTPException(status_code=400, detail="O nome não pode ficar vazio.")
        sets["nome"] = nome
    if body.telefone is not None:
        sets["telefone"] = body.telefone.strip()
    if body.funcao is not None:
        if body.funcao not in FUNCOES:
            raise HTTPException(status_code=400, detail="Função inválida.")
        sets["funcao"] = body.funcao
    if body.equipe_id is not None:
        if body.equipe_id and not await db.equipes.find_one({"_id": body.equipe_id, "conta_id": conta_id}):
            raise HTTPException(status_code=404, detail="Equipe não encontrada.")
        sets["equipe_id"] = body.equipe_id or None
    if body.status is not None:
        if body.status not in ("aprovado", "inativo"):
            raise HTTPException(status_code=400, detail="Status inválido (use aprovado ou inativo).")
        sets["status"] = body.status

    row = await db.usuarios.find_one_and_update(
        {"_id": colaborador_id, "conta_id": conta_id}, {"$set": sets}, return_document=True
    )
    return {"ok": True, "colaborador": serialize(row)}


# ===========================================================================
# EQUIPES
# ===========================================================================

class EquipeCreate(BaseModel):
    nome: str
    descricao: Optional[str] = ""
    responsavel: Optional[str] = ""
    status: str = "ativa"


class EquipeUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    responsavel: Optional[str] = None
    status: Optional[str] = None


@router.get("")
async def listar_equipes(busca: Optional[str] = None, status: Optional[str] = None,
                         user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    query: dict = {"conta_id": conta_id}
    if status in ("ativa", "inativa"):
        query["status"] = status
    if busca:
        query["nome"] = {"$regex": re.escape(busca), "$options": "i"}
    equipes = await db.equipes.find(query).sort("created_at", -1).to_list(length=None)

    # contagem de membros por equipe
    itens = []
    for e in equipes:
        membros = await db.usuarios.count_documents({"equipe_id": e["_id"], "conta_id": conta_id})
        d = serialize(e)
        d["membros"] = membros
        itens.append(d)
    return {"items": itens}


@router.post("")
async def criar_equipe(body: EquipeCreate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    nome = (body.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da equipe.")
    status = body.status if body.status in ("ativa", "inativa") else "ativa"
    db = get_db()
    ts = now()
    doc = {
        "_id": new_id(), "conta_id": conta_id, "nome": nome, "descricao": (body.descricao or "").strip(),
        "responsavel": (body.responsavel or "").strip(), "status": status,
        "criado_por": _autor(user), "created_at": ts, "updated_at": ts,
    }
    await db.equipes.insert_one(doc)
    d = serialize(doc)
    d["membros"] = 0
    return {"ok": True, "equipe": d}


@router.get("/{equipe_id}")
async def obter_equipe(equipe_id: str, periodo: Optional[str] = Query(None),
                       user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    e = await db.equipes.find_one({"_id": equipe_id, "conta_id": conta_id})
    if not e:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")

    dados = await _agregar(db, periodo, conta_id)
    membros = [c for c in dados["colaboradores"] if c["equipe_id"] == equipe_id]
    total = sum(c["total"] for c in membros)
    por_tipo: dict = {}
    for c in membros:
        for t, n in c["por_tipo"].items():
            por_tipo[t] = por_tipo.get(t, 0) + n

    d = serialize(e)
    d["membros"] = len(membros)
    return {
        "equipe": d,
        "total": total,
        "por_tipo": por_tipo,
        "colaboradores": membros,
        "tipos": TIPOS_PRODUTIVIDADE,
        "funcoes_label": FUNCOES_LABEL,
    }


@router.patch("/{equipe_id}")
async def atualizar_equipe(equipe_id: str, body: EquipeUpdate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    sets = {"updated_at": now()}
    if body.nome is not None:
        nome = body.nome.strip()
        if not nome:
            raise HTTPException(status_code=400, detail="O nome não pode ficar vazio.")
        sets["nome"] = nome
    if body.descricao is not None:
        sets["descricao"] = body.descricao.strip()
    if body.responsavel is not None:
        sets["responsavel"] = body.responsavel.strip()
    if body.status is not None:
        if body.status not in ("ativa", "inativa"):
            raise HTTPException(status_code=400, detail="Status inválido (use ativa ou inativa).")
        sets["status"] = body.status

    row = await db.equipes.find_one_and_update(
        {"_id": equipe_id, "conta_id": conta_id}, {"$set": sets}, return_document=True
    )
    if not row:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    d = serialize(row)
    d["membros"] = await db.usuarios.count_documents({"equipe_id": equipe_id, "conta_id": conta_id})
    return {"ok": True, "equipe": d}
