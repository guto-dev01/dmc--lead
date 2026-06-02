from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
from database import get_conn

# ---- TEMPLATES ----
router = APIRouter()


@router.get("")
async def listar_templates():
    conn = await get_conn()
    try:
        rows = await conn.fetch("SELECT * FROM templates WHERE ativo = true ORDER BY nome")
        return [dict(r) for r in rows]
    finally:
        await conn.close()

class TemplateCreate(BaseModel):
    nome: str
    categoria: Optional[str] = None
    conteudo: str
    variaveis: Optional[List[str]] = []

@router.post("")
async def criar_template(body: TemplateCreate):
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            "INSERT INTO templates (nome, categoria, conteudo, variaveis) VALUES ($1,$2,$3,$4) RETURNING *",
            body.nome, body.categoria, body.conteudo, body.variaveis,
        )
        return dict(row)
    finally:
        await conn.close()

class TemplateUpdate(BaseModel):
    nome: Optional[str] = None
    categoria: Optional[str] = None
    conteudo: Optional[str] = None
    variaveis: Optional[List[str]] = None

@router.put("/{template_id}")
async def atualizar_template(template_id: str, body: TemplateUpdate):
    fields = body.dict(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    conn = await get_conn()
    try:
        sets = ", ".join(f"{k} = ${i}" for i, k in enumerate(fields, start=1))
        values = list(fields.values())
        row = await conn.fetchrow(
            f"UPDATE templates SET {sets} WHERE id = ${len(values)+1} AND ativo = true RETURNING *",
            *values, uuid.UUID(template_id),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Template não encontrado")
        return dict(row)
    finally:
        await conn.close()

@router.delete("/{template_id}")
async def deletar_template(template_id: str):
    conn = await get_conn()
    try:
        await conn.execute("UPDATE templates SET ativo = false WHERE id = $1", uuid.UUID(template_id))
        return {"ok": True}
    finally:
        await conn.close()
