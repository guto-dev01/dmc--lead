from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid, asyncpg, asyncio
from database import settings

router = APIRouter()

async def get_conn():
    return await asyncpg.connect(
        settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    )

class CampanhaCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    template_id: Optional[str] = None
    empresa_ids: Optional[List[str]] = []

@router.get("")
async def listar_campanhas():
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            "SELECT * FROM campanhas ORDER BY created_at DESC"
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.post("")
async def criar_campanha(body: CampanhaCreate):
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            """INSERT INTO campanhas (nome, descricao, template_id, total_envios)
               VALUES ($1, $2, $3, $4) RETURNING *""",
            body.nome, body.descricao,
            uuid.UUID(body.template_id) if body.template_id else None,
            len(body.empresa_ids),
        )
        campanha_id = row["id"]

        for emp_id in body.empresa_ids:
            await conn.execute(
                "INSERT INTO campanha_itens (campanha_id, empresa_id) VALUES ($1, $2)",
                campanha_id, uuid.UUID(emp_id),
            )

        return dict(row)
    finally:
        await conn.close()

@router.post("/{campanha_id}/iniciar")
async def iniciar_campanha(campanha_id: str):
    """Inicia disparo da campanha"""
    import httpx
    conn = await get_conn()
    try:
        campanha = await conn.fetchrow("SELECT * FROM campanhas WHERE id = $1", uuid.UUID(campanha_id))
        if not campanha:
            raise HTTPException(status_code=404, detail="Campanha não encontrada")

        template = await conn.fetchrow(
            "SELECT conteudo FROM templates WHERE id = $1", campanha["template_id"]
        )

        itens = await conn.fetch(
            """SELECT ci.id, e.whatsapp, e.telefone, e.nome as empresa_nome
               FROM campanha_itens ci JOIN empresas e ON ci.empresa_id = e.id
               WHERE ci.campanha_id = $1 AND ci.status = 'pendente'""",
            uuid.UUID(campanha_id),
        )

        await conn.execute(
            "UPDATE campanhas SET status = 'em_andamento', data_inicio = NOW() WHERE id = $1",
            uuid.UUID(campanha_id),
        )

        enviados = 0
        for item in itens:
            numero = item["whatsapp"] or item["telefone"]
            if not numero:
                continue
            numero = numero.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
            if not numero.startswith("55"):
                numero = "55" + numero

            texto = template["conteudo"].replace("{{empresa}}", item["empresa_nome"])

            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    await client.post(
                        f"{settings.evolution_api_url}/message/sendText/{settings.evolution_instance}",
                        json={
                            "number": f"{numero}@s.whatsapp.net",
                            "options": {"delay": 1500},
                            "textMessage": {"text": texto},
                        },
                        headers={"apikey": settings.evolution_api_key},
                    )
                await conn.execute(
                    "UPDATE campanha_itens SET status = 'enviado', enviado_em = NOW() WHERE id = $1",
                    item["id"],
                )
                enviados += 1
                await asyncio.sleep(2)  # delay entre envios
            except Exception:
                await conn.execute(
                    "UPDATE campanha_itens SET status = 'erro' WHERE id = $1", item["id"]
                )

        await conn.execute(
            "UPDATE campanhas SET enviados = $2, status = 'concluida', data_fim = NOW() WHERE id = $1",
            uuid.UUID(campanha_id), enviados,
        )

        return {"ok": True, "enviados": enviados, "total": len(itens)}
    finally:
        await conn.close()

@router.get("/{campanha_id}")
async def obter_campanha(campanha_id: str):
    conn = await get_conn()
    try:
        row = await conn.fetchrow("SELECT * FROM campanhas WHERE id = $1", uuid.UUID(campanha_id))
        itens = await conn.fetch(
            """SELECT ci.*, e.nome as empresa_nome, e.whatsapp
               FROM campanha_itens ci JOIN empresas e ON ci.empresa_id = e.id
               WHERE ci.campanha_id = $1""",
            uuid.UUID(campanha_id),
        )
        return {**dict(row), "itens": [dict(i) for i in itens]}
    finally:
        await conn.close()
