from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://imobpro:imobpro123@localhost:5432/imobpro"
    evolution_api_url: str = "http://localhost:8080"
    evolution_api_key: str = ""
    evolution_instance: str = "imobpro"
    # URL do backend acessivel pela Evolution (rede docker) p/ receber webhooks
    webhook_url: str = "http://backend:8000/api/whatsapp/webhook"
    secret_key: str = "supersecretkey123"
    # Chaves de busca usadas pelo "Mapear mercado" (basta um provedor)
    google_api_key: str = ""
    google_cse_id: str = ""
    serper_api_key: str = ""
    brave_api_key: str = ""
    admin_username: str = "admin"
    admin_password: str = "admin123"

    class Config:
        env_file = ".env"

settings = Settings()

DATABASE_URL = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
