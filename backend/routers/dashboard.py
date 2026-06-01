from fastapi import APIRouter
import asyncpg
from database import settings

router = APIRouter()

async def get_conn():
    return await asyncpg.connect(
        settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    )

@router.get("")
async def dashboard_stats():
    conn = await get_conn()
    try:
        total_empresas = await conn.fetchval("SELECT COUNT(*) FROM empresas")
        total_com_cnpj = await conn.fetchval("SELECT COUNT(*) FROM empresas WHERE cnpj IS NOT NULL")
        total_com_whatsapp = await conn.fetchval("SELECT COUNT(*) FROM empresas WHERE whatsapp IS NOT NULL")
        total_conversas = await conn.fetchval("SELECT COUNT(*) FROM conversas")
        total_mensagens = await conn.fetchval("SELECT COUNT(*) FROM mensagens")
        msgs_hoje = await conn.fetchval("SELECT COUNT(*) FROM mensagens WHERE created_at >= CURRENT_DATE")
        campanhas_ativas = await conn.fetchval("SELECT COUNT(*) FROM campanhas WHERE status = 'em_andamento'")

        por_tipo = await conn.fetch(
            "SELECT tipo, COUNT(*) as total FROM empresas WHERE tipo IS NOT NULL GROUP BY tipo ORDER BY total DESC"
        )

        recentes = await conn.fetch(
            """SELECT e.nome, e.tipo, e.bairro, e.score, e.created_at,
               (SELECT COUNT(*) FROM mensagens m JOIN conversas c ON m.conversa_id = c.id WHERE c.empresa_id = e.id) as msgs
               FROM empresas e ORDER BY e.created_at DESC LIMIT 5"""
        )

        atividades = await conn.fetch(
            """SELECT a.*, e.nome as empresa_nome FROM atividades a
               JOIN empresas e ON a.empresa_id = e.id
               ORDER BY a.created_at DESC LIMIT 10"""
        )

        return {
            "stats": {
                "total_empresas": total_empresas,
                "com_cnpj": total_com_cnpj,
                "com_whatsapp": total_com_whatsapp,
                "total_conversas": total_conversas,
                "total_mensagens": total_mensagens,
                "msgs_hoje": msgs_hoje,
                "campanhas_ativas": campanhas_ativas,
            },
            "por_tipo": [dict(r) for r in por_tipo],
            "recentes": [dict(r) for r in recentes],
            "atividades": [dict(r) for r in atividades],
        }
    finally:
        await conn.close()
