import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic_settings import BaseSettings
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase


class Settings(BaseSettings):
    # MongoDB — dados do ImobPro. Em produção use uma URI do MongoDB Atlas
    # (mongodb+srv://...). Local/docker: mongodb://mongo:27017
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db: str = "imobpro"
    evolution_api_url: str = "http://localhost:8080"
    evolution_api_key: str = ""
    evolution_instance: str = "imobpro"
    # URL do backend acessivel pela Evolution (rede docker) p/ receber webhooks
    webhook_url: str = "http://backend:8000/api/whatsapp/webhook"
    # URL interna/publica do backend para a Evolution baixar anexos enviados nas campanhas
    backend_public_url: str = "http://backend:8000"
    secret_key: str = "supersecretkey123"
    # Chaves de busca usadas pelo "Mapear mercado" (basta um provedor)
    google_api_key: str = ""
    google_cse_id: str = ""
    serper_api_key: str = ""
    brave_api_key: str = ""
    admin_username: str = "admin"
    admin_password: str = "admin123"
    # E-mail do dono principal — recebe as solicitações de novos cadastros para
    # aprovar/recusar. Se vazio, usa o SMTP_FROM como destinatário.
    dono_principal_email: str = ""
    # E-mail do dono da "conta principal" — dono dos dados legados (migração) e
    # da base semeada (seed). Usado pelo script de migração e pelo schema.
    conta_principal_email: str = "nathalial@complexodmc.com.br"
    # URL pública do frontend (usada para montar o link de redefinição de senha
    # enviado por e-mail). Ex.: https://app.suaempresa.com. Se vazio, tenta o
    # FRONTEND_ORIGIN; por fim cai no backend_public_url.
    app_public_url: str = ""
    # SMTP (disparo de e-mail). Porta 465 = SSL implícito; 587 = STARTTLS.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_from_nome: str = "Complexo DMC"
    smtp_use_tls: bool = True

    class Config:
        env_file = ".env"


settings = Settings()


# ---------------------------------------------------------------------------
# Cliente MongoDB compartilhado
#
# Os routers usam SQL cru via asyncpg foi substituído pelo driver async do
# PyMongo (AsyncMongoClient). Em vez de `conn = await get_conn()` / SQL, os
# routers chamam `db = get_db()` e usam as coleções (db.empresas, db.contatos…).
# O client mantém seu próprio pool de conexões internamente.
# ---------------------------------------------------------------------------

_client: Optional[AsyncMongoClient] = None


def _build_client() -> AsyncMongoClient:
    return AsyncMongoClient(settings.mongo_url, tz_aware=True)


def get_db() -> AsyncDatabase:
    """Retorna o database Mongo (cria o client sob demanda se preciso)."""
    global _client
    if _client is None:
        _client = _build_client()
    return _client[settings.mongo_db]


async def init_db() -> None:
    """Cria o client e valida a conexão (chamado no lifespan do app)."""
    global _client
    if _client is None:
        _client = _build_client()
    await _client.admin.command("ping")


async def close_db() -> None:
    """Fecha o client no shutdown do app."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None


# ---------------------------------------------------------------------------
# Helpers de documento / consulta
# ---------------------------------------------------------------------------

def new_id() -> str:
    """ID de documento (UUID em texto), usado como _id das coleções."""
    return str(uuid.uuid4())


def now() -> datetime:
    """Timestamp UTC (equivalente ao NOW() do Postgres)."""
    return datetime.now(timezone.utc)


def serialize(doc: Optional[dict]) -> Optional[dict]:
    """Converte um documento Mongo para um formato amigável à API: renomeia
    `_id` -> `id`. Mantém os demais campos como estão (datas, listas, dicts)."""
    if doc is None:
        return None
    out = dict(doc)
    if "_id" in out:
        out["id"] = out.pop("_id")
    return out


def like(value: str) -> dict:
    """Equivalente ao `ILIKE '%value%'` do Postgres: regex case-insensitive."""
    return {"$regex": re.escape(value), "$options": "i"}


def ieq(value: str) -> dict:
    """Igualdade case-insensitive (equivale a `lower(campo) = lower(value)`)."""
    return {"$regex": f"^{re.escape(value)}$", "$options": "i"}
