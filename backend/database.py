from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic_settings import BaseSettings
import asyncpg

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://imobpro:imobpro123@localhost:5432/imobpro"
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

DATABASE_URL = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,          # conexões persistentes para o ORM/SQLAlchemy
    max_overflow=10,       # picos
    pool_pre_ping=True,    # descarta conexões mortas antes de usar
    pool_recycle=1800,     # recicla a cada 30 min (evita timeouts do Postgres)
)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Pool asyncpg compartilhado
#
# Os routers usam SQL cru via asyncpg. Antes cada request abria UMA conexão
# nova (asyncpg.connect) e fechava no fim — caro e frágil sob carga. Agora há
# um pool único, criado no startup. `get_conn()` é um drop-in: os routers
# continuam fazendo `conn = await get_conn()` / `await conn.close()`, mas agora
# pegam/devolvem do pool em vez de abrir/derrubar a conexão TCP.
# ---------------------------------------------------------------------------

_RAW_DSN = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """Cria o pool asyncpg (idempotente). Chamado no lifespan do app."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            _RAW_DSN,
            min_size=2,
            max_size=10,
            command_timeout=60,
            max_inactive_connection_lifetime=1800,
        )


async def close_pool() -> None:
    """Fecha o pool no shutdown do app."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


class _PooledConn:
    """Wrapper drop-in de uma conexão do pool.

    Proxia todos os métodos do asyncpg (fetch/fetchrow/fetchval/execute/
    transaction/...) para a conexão real e, no `.close()`, devolve a conexão
    ao pool em vez de encerrá-la.
    """

    __slots__ = ("_pool", "_conn")

    def __init__(self, pool: asyncpg.Pool, conn: asyncpg.Connection):
        self._pool = pool
        self._conn = conn

    def __getattr__(self, name):
        # só chega aqui para atributos fora dos __slots__ → delega ao asyncpg
        return getattr(self._conn, name)

    async def close(self):
        await self._pool.release(self._conn)


async def get_conn() -> _PooledConn:
    """Pega uma conexão do pool (cria o pool sob demanda se preciso)."""
    if _pool is None:
        await init_pool()
    conn = await _pool.acquire()
    return _PooledConn(_pool, conn)
