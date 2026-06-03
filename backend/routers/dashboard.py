import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from database import get_db, serialize
from routers.whatsapp import normalizar_numero
from services.auth import conta_atual

router = APIRouter()

# Validação simples de e-mail (mesma usada nos disparos: precisa de @ e domínio com ponto)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Status normalizados das campanhas (tolerante a variações já gravadas no banco)
_ST_ANDAMENTO = {"em_andamento", "andamento"}
_ST_FINALIZADA = {"concluida", "concluída", "finalizada", "finalizado"}
_ST_PAUSADA = {"pausada", "pausado"}
_ST_ERRO = {"erro", "falha"}


def _bucket_campanha() -> dict:
    return {
        "criadas": 0, "em_andamento": 0, "finalizadas": 0, "pausadas": 0, "erro": 0,
        "enviadas": 0, "pendentes": 0, "falha": 0, "taxa_sucesso": None,
    }


async def _resumo_campanhas(db, conta_id) -> dict:
    """Resumo das campanhas separado por canal (WhatsApp / e-mail).

    Campanhas antigas sem o campo `canal` são contabilizadas como WhatsApp, que era
    o único canal de disparo do sistema antes da inclusão do e-mail.
    """
    resumo = {"whatsapp": _bucket_campanha(), "email": _bucket_campanha()}

    docs = await db.campanhas.find({"conta_id": conta_id}, {"canal": 1, "status": 1}).to_list(length=None)
    canal_por_id = {}
    for c in docs:
        canal = (c.get("canal") or "whatsapp").lower()
        if canal not in resumo:
            canal = "whatsapp"
        canal_por_id[c["_id"]] = canal
        b = resumo[canal]
        b["criadas"] += 1
        st = (c.get("status") or "").lower()
        if st in _ST_ANDAMENTO:
            b["em_andamento"] += 1
        elif st in _ST_FINALIZADA:
            b["finalizadas"] += 1
        elif st in _ST_PAUSADA:
            b["pausadas"] += 1
        elif st in _ST_ERRO:
            b["erro"] += 1

    # Mensagens por status (enviado/pendente/erro) vindas dos itens reais da campanha
    itens = await (await db.campanha_itens.aggregate([
        {"$match": {"conta_id": conta_id}},
        {"$group": {"_id": {"c": "$campanha_id", "s": "$status"}, "n": {"$sum": 1}}},
    ])).to_list(length=None)
    for row in itens:
        canal = canal_por_id.get(row["_id"].get("c"))
        if not canal:
            continue  # item de campanha removida — ignora
        st = (row["_id"].get("s") or "").lower()
        n = row.get("n", 0)
        b = resumo[canal]
        if st == "enviado":
            b["enviadas"] += n
        elif st == "pendente":
            b["pendentes"] += n
        elif st == "erro":
            b["falha"] += n

    for b in resumo.values():
        base = b["enviadas"] + b["falha"]
        b["taxa_sucesso"] = round(b["enviadas"] / base * 100, 1) if base else None

    return resumo


async def _contar_emails_unicos(db, conta_id) -> int:
    """E-mails únicos válidos cadastrados (empresas + contatos), ignorando vazios."""
    unicos = set()
    for coll in (db.empresas, db.contatos):
        async for doc in coll.find({"conta_id": conta_id, "email": {"$nin": [None, ""]}}, {"email": 1}):
            email = (doc.get("email") or "").strip().lower()
            if _EMAIL_RE.match(email):
                unicos.add(email)
    return len(unicos)


async def _contar_telefones_unicos(db, conta_id) -> int:
    """Telefones únicos cadastrados (empresas + contatos), ignorando vazios/incompletos.

    Normaliza para só dígitos com DDI 55 (formato usado no sistema) para deduplicar
    o mesmo número escrito de formas diferentes.
    """
    unicos = set()
    async for doc in db.empresas.find({"conta_id": conta_id}, {"whatsapp": 1, "telefone": 1, "telefone2": 1}):
        for campo in ("whatsapp", "telefone", "telefone2"):
            n = normalizar_numero(doc.get(campo) or "")
            if len(n) >= 10:  # DDI(55) + ao menos 8 dígitos
                unicos.add(n)
    async for doc in db.contatos.find({"conta_id": conta_id}, {"whatsapp": 1, "telefone": 1}):
        for campo in ("whatsapp", "telefone"):
            n = normalizar_numero(doc.get(campo) or "")
            if len(n) >= 10:
                unicos.add(n)
    return len(unicos)


@router.get("")
async def dashboard_stats(conta_id: str = Depends(conta_atual)):
    db = get_db()
    total_empresas = await db.empresas.count_documents({"conta_id": conta_id})
    total_com_cnpj = await db.empresas.count_documents({"conta_id": conta_id, "cnpj": {"$nin": [None, ""]}})
    total_com_whatsapp = await db.empresas.count_documents({"conta_id": conta_id, "whatsapp": {"$nin": [None, ""]}})
    total_conversas = await db.conversas.count_documents({"conta_id": conta_id})
    total_mensagens = await db.mensagens.count_documents({"conta_id": conta_id})

    agora = datetime.now(timezone.utc)
    inicio_hoje = datetime(agora.year, agora.month, agora.day, tzinfo=timezone.utc)
    msgs_hoje = await db.mensagens.count_documents({"conta_id": conta_id, "created_at": {"$gte": inicio_hoje}})
    campanhas_ativas = await db.campanhas.count_documents({"conta_id": conta_id, "status": "em_andamento"})

    # Empresas em atendimento no WhatsApp: empresas com ao menos uma conversa registrada
    empresas_atendimento = await db.conversas.distinct("empresa_id", {"conta_id": conta_id, "empresa_id": {"$ne": None}})
    empresas_em_atendimento = len(empresas_atendimento)

    total_emails = await _contar_emails_unicos(db, conta_id)
    total_telefones = await _contar_telefones_unicos(db, conta_id)
    campanhas_resumo = await _resumo_campanhas(db, conta_id)

    por_tipo_raw = await (await db.empresas.aggregate([
        {"$match": {"conta_id": conta_id, "tipo": {"$ne": None}}},
        {"$group": {"_id": "$tipo", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ])).to_list(length=None)
    por_tipo = [{"tipo": r["_id"], "total": r["total"]} for r in por_tipo_raw]

    # 5 empresas mais recentes + nº de mensagens (via conversas da empresa)
    recentes_raw = await db.empresas.find(
        {"conta_id": conta_id}, {"nome": 1, "tipo": 1, "bairro": 1, "score": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(length=5)
    recentes = []
    for e in recentes_raw:
        d = serialize(e)
        conv_ids = [c["_id"] for c in await db.conversas.find(
            {"empresa_id": d["id"], "conta_id": conta_id}, {"_id": 1}
        ).to_list(length=None)]
        d["msgs"] = await db.mensagens.count_documents({"conversa_id": {"$in": conv_ids}}) if conv_ids else 0
        recentes.append(d)

    # 10 atividades mais recentes vinculadas a uma empresa (equivale ao INNER JOIN)
    atividades_raw = await db.atividades.find(
        {"conta_id": conta_id, "empresa_id": {"$ne": None}}
    ).sort("created_at", -1).limit(40).to_list(length=40)
    emp_ids = list({a["empresa_id"] for a in atividades_raw if a.get("empresa_id")})
    nome_map = {}
    if emp_ids:
        empresas = await db.empresas.find({"_id": {"$in": emp_ids}, "conta_id": conta_id}, {"nome": 1}).to_list(length=None)
        nome_map = {e["_id"]: e.get("nome") for e in empresas}
    atividades = []
    for a in atividades_raw:
        if a.get("empresa_id") not in nome_map:
            continue  # empresa removida: INNER JOIN não traria
        d = serialize(a)
        d["empresa_nome"] = nome_map.get(a["empresa_id"])
        atividades.append(d)
        if len(atividades) >= 10:
            break

    return {
        "stats": {
            "total_empresas": total_empresas,
            "com_cnpj": total_com_cnpj,
            "com_whatsapp": total_com_whatsapp,
            "total_conversas": total_conversas,
            "total_mensagens": total_mensagens,
            "msgs_hoje": msgs_hoje,
            "campanhas_ativas": campanhas_ativas,
            "empresas_em_atendimento": empresas_em_atendimento,
            "total_emails": total_emails,
            "total_telefones": total_telefones,
        },
        "campanhas_resumo": campanhas_resumo,
        "por_tipo": por_tipo,
        "recentes": recentes,
        "atividades": atividades,
    }
