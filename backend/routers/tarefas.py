"""Tarefas — organização de atividades internas do sistema.

Segue o mesmo padrão dos demais routers (MongoDB via get_db, serialize, new_id,
now). Exclusão é "soft" (arquivar): a tarefa recebe arquivada=True e some das
listagens, preservando o histórico — mesmo critério usado nos templates.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from database import get_db, new_id, now, serialize, like
from services.auth import require_auth, conta_atual
from services.atividades import registrar


def _autor(user) -> Optional[str]:
    return (user or {}).get("sub") if isinstance(user, dict) else None

router = APIRouter()

PRIORIDADES = ("baixa", "media", "alta", "urgente")
STATUS = ("pendente", "em_andamento", "concluida", "cancelada")
# Status que não contam como "em aberto" (não podem estar vencidos nem pendentes)
STATUS_FECHADOS = ("concluida", "cancelada")


def _hoje_str() -> str:
    """Data de hoje em ISO (YYYY-MM-DD) — usada na comparação de vencimento."""
    return now().date().isoformat()


def _validar_vencimento(valor: Optional[str]) -> Optional[str]:
    """Aceita vazio/None (sem vencimento) ou uma data ISO válida (YYYY-MM-DD)."""
    if valor is None:
        return None
    valor = valor.strip()
    if not valor:
        return None
    try:
        return date.fromisoformat(valor).isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Data de vencimento inválida (use AAAA-MM-DD)") from exc


def _com_flags(doc: dict) -> dict:
    """Adiciona o campo derivado `vencida` ao documento serializado."""
    out = serialize(doc)
    venc = out.get("data_vencimento") or ""
    aberta = out.get("status") not in STATUS_FECHADOS
    out["vencida"] = bool(venc) and aberta and venc < _hoje_str()
    return out


# ---------------------------------------------------------------------------
# Listagem (com filtros e pesquisa)
# ---------------------------------------------------------------------------
@router.get("")
async def listar_tarefas(
    busca: Optional[str] = None,
    status: Optional[str] = None,
    prioridade: Optional[str] = None,
    responsavel: Optional[str] = None,
    vencidas: Optional[bool] = None,
    vence_ate: Optional[str] = None,
    conta_id: str = Depends(conta_atual),
):
    db = get_db()
    query: dict = {"conta_id": conta_id, "arquivada": {"$ne": True}}

    if status:
        query["status"] = status
    if prioridade:
        query["prioridade"] = prioridade
    if responsavel:
        if responsavel == "__sem__":
            query["responsavel"] = {"$in": ["", None]}
        else:
            query["responsavel"] = responsavel
    if busca:
        query["$or"] = [{"titulo": like(busca)}, {"descricao": like(busca)}]
    if vence_ate:
        venc = _validar_vencimento(vence_ate)
        query["data_vencimento"] = {"$ne": "", "$lte": venc}
    if vencidas:
        # vencida = tem vencimento, no passado, e ainda em aberto
        query["data_vencimento"] = {"$ne": "", "$lt": _hoje_str()}
        query["status"] = {"$nin": list(STATUS_FECHADOS)}

    rows = await db.tarefas.find(query).sort(
        [("data_vencimento", 1), ("created_at", -1)]
    ).to_list(length=None)
    return [_com_flags(r) for r in rows]


# ---------------------------------------------------------------------------
# Resumo (cards do topo) — sempre sobre todas as tarefas não arquivadas
# ---------------------------------------------------------------------------
@router.get("/resumo")
async def resumo_tarefas(conta_id: str = Depends(conta_atual)):
    db = get_db()
    base = {"conta_id": conta_id, "arquivada": {"$ne": True}}
    hoje = _hoje_str()
    total = await db.tarefas.count_documents(base)
    pendentes = await db.tarefas.count_documents({**base, "status": "pendente"})
    em_andamento = await db.tarefas.count_documents({**base, "status": "em_andamento"})
    concluidas = await db.tarefas.count_documents({**base, "status": "concluida"})
    vencidas = await db.tarefas.count_documents({
        **base,
        "data_vencimento": {"$ne": "", "$lt": hoje},
        "status": {"$nin": list(STATUS_FECHADOS)},
    })
    return {
        "total": total,
        "pendentes": pendentes,
        "em_andamento": em_andamento,
        "concluidas": concluidas,
        "vencidas": vencidas,
    }


# ---------------------------------------------------------------------------
# Criar
# ---------------------------------------------------------------------------
class TarefaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = ""
    responsavel: Optional[str] = ""
    prioridade: Optional[str] = "media"
    status: Optional[str] = "pendente"
    data_vencimento: Optional[str] = None
    observacoes: Optional[str] = ""


@router.post("")
async def criar_tarefa(body: TarefaCreate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    titulo = (body.titulo or "").strip()
    if not titulo:
        raise HTTPException(status_code=400, detail="O título é obrigatório")

    prioridade = body.prioridade or "media"
    if prioridade not in PRIORIDADES:
        raise HTTPException(status_code=400, detail="Prioridade inválida")

    status = body.status or "pendente"
    if status not in STATUS:
        raise HTTPException(status_code=400, detail="Status inválido")

    venc = _validar_vencimento(body.data_vencimento)
    ts = now()
    doc = {
        "_id": new_id(),
        "conta_id": conta_id,
        "titulo": titulo,
        "descricao": (body.descricao or "").strip(),
        "responsavel": (body.responsavel or "").strip(),
        "prioridade": prioridade,
        "status": status,
        "data_vencimento": venc or "",
        "observacoes": (body.observacoes or "").strip(),
        "arquivada": False,
        "concluida_em": ts if status == "concluida" else None,
        "created_at": ts,
        "updated_at": ts,
    }
    db = get_db()
    await db.tarefas.insert_one(doc)
    if status == "concluida":
        await registrar(db, "tarefa_concluida", autor=_autor(user),
                        descricao=f"Tarefa \"{titulo}\" concluída", conta_id=conta_id)
    return _com_flags(doc)


# ---------------------------------------------------------------------------
# Atualizar (edição geral e/ou mudança de status)
# ---------------------------------------------------------------------------
class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    responsavel: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None
    data_vencimento: Optional[str] = None
    observacoes: Optional[str] = None


@router.put("/{tarefa_id}")
async def atualizar_tarefa(tarefa_id: str, body: TarefaUpdate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    fields = body.dict(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nada para atualizar")

    update: dict = {}

    if "titulo" in fields:
        titulo = (fields["titulo"] or "").strip()
        if not titulo:
            raise HTTPException(status_code=400, detail="O título é obrigatório")
        update["titulo"] = titulo
    if "descricao" in fields:
        update["descricao"] = (fields["descricao"] or "").strip()
    if "responsavel" in fields:
        update["responsavel"] = (fields["responsavel"] or "").strip()
    if "observacoes" in fields:
        update["observacoes"] = (fields["observacoes"] or "").strip()
    if "prioridade" in fields:
        if fields["prioridade"] not in PRIORIDADES:
            raise HTTPException(status_code=400, detail="Prioridade inválida")
        update["prioridade"] = fields["prioridade"]
    if "data_vencimento" in fields:
        update["data_vencimento"] = _validar_vencimento(fields["data_vencimento"]) or ""
    if "status" in fields:
        if fields["status"] not in STATUS:
            raise HTTPException(status_code=400, detail="Status inválido")
        update["status"] = fields["status"]
        # registra/limpa o momento de conclusão conforme o novo status
        update["concluida_em"] = now() if fields["status"] == "concluida" else None

    update["updated_at"] = now()
    db = get_db()
    anterior = await db.tarefas.find_one({"_id": tarefa_id, "conta_id": conta_id, "arquivada": {"$ne": True}}, {"status": 1})
    row = await db.tarefas.find_one_and_update(
        {"_id": tarefa_id, "conta_id": conta_id, "arquivada": {"$ne": True}},
        {"$set": update},
        return_document=True,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    # Conclusão de tarefa é evento de produtividade (apenas na transição p/ concluída).
    if (update.get("status") == "concluida"
            and (anterior or {}).get("status") != "concluida"):
        await registrar(db, "tarefa_concluida", autor=_autor(user),
                        descricao=f"Tarefa \"{row.get('titulo','')}\" concluída", conta_id=conta_id)
    return _com_flags(row)


# ---------------------------------------------------------------------------
# Excluir = arquivar (soft delete — preserva histórico)
# ---------------------------------------------------------------------------
@router.delete("/{tarefa_id}")
async def arquivar_tarefa(tarefa_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    res = await db.tarefas.update_one(
        {"_id": tarefa_id, "conta_id": conta_id}, {"$set": {"arquivada": True, "updated_at": now()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return {"ok": True}
