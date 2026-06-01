from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid, asyncpg
from database import settings

# ---- TEMPLATES ----
router = APIRouter()

async def get_conn():
    return await asyncpg.connect(
        settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    )

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

@router.delete("/{template_id}")
async def deletar_template(template_id: str):
    conn = await get_conn()
    try:
        await conn.execute("UPDATE templates SET ativo = false WHERE id = $1", uuid.UUID(template_id))
        return {"ok": True}
    finally:
        await conn.close()
