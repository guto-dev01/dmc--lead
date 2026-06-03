from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import get_db, new_id, serialize
from services.auth import conta_atual

# ---- TEMPLATES ----
router = APIRouter()


@router.get("")
async def listar_templates(conta_id: str = Depends(conta_atual)):
    db = get_db()
    rows = await db.templates.find({"conta_id": conta_id, "ativo": True}).sort("nome", 1).to_list(length=None)
    return [serialize(r) for r in rows]

class TemplateCreate(BaseModel):
    nome: str
    categoria: Optional[str] = None
    conteudo: str
    variaveis: Optional[List[str]] = []

@router.post("")
async def criar_template(body: TemplateCreate, conta_id: str = Depends(conta_atual)):
    db = get_db()
    doc = {
        "_id": new_id(), "conta_id": conta_id, "nome": body.nome, "categoria": body.categoria,
        "conteudo": body.conteudo, "variaveis": body.variaveis or [], "ativo": True,
    }
    await db.templates.insert_one(doc)
    return serialize(doc)

class TemplateUpdate(BaseModel):
    nome: Optional[str] = None
    categoria: Optional[str] = None
    conteudo: Optional[str] = None
    variaveis: Optional[List[str]] = None

@router.put("/{template_id}")
async def atualizar_template(template_id: str, body: TemplateUpdate, conta_id: str = Depends(conta_atual)):
    fields = body.dict(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    db = get_db()
    row = await db.templates.find_one_and_update(
        {"_id": template_id, "conta_id": conta_id, "ativo": True}, {"$set": fields}, return_document=True
    )
    if not row:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    return serialize(row)

@router.delete("/{template_id}")
async def deletar_template(template_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    await db.templates.update_one({"_id": template_id, "conta_id": conta_id}, {"$set": {"ativo": False}})
    return {"ok": True}
