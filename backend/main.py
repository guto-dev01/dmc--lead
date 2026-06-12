from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from contextlib import asynccontextmanager
from routers import auth, empresas, cnpj, whatsapp, campanhas, templates, dashboard, mercado, dmc, decisores, tarefas, equipes, config
from services.schema import ensure_schema
from services.auth import require_auth
from database import init_db, close_db
import asyncio
import os


async def wait_for_schema():
    last_error = None
    for _ in range(20):
        try:
            await init_db()
            await ensure_schema()
            return
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(1)
    raise last_error

@asynccontextmanager
async def lifespan(app: FastAPI):
    await wait_for_schema()
    yield
    await close_db()

app = FastAPI(
    title="ImobPro API",
    description="Sistema de prospecção imobiliária para Consolação/Jardins/Bela Vista",
    version="1.0.0",
    lifespan=lifespan,
)

_origins = [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:8443",
]
# Em produção (Render), informe a URL do frontend em FRONTEND_ORIGIN (separe várias por vírgula)
for _o in (os.environ.get("FRONTEND_ORIGIN", "") or "").split(","):
    _o = _o.strip().rstrip("/")
    if _o:
        _origins.append(_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config.router, prefix="/api/config", tags=["Config"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"], dependencies=[Depends(require_auth)])
app.include_router(empresas.router, prefix="/api/empresas", tags=["Empresas"], dependencies=[Depends(require_auth)])
app.include_router(cnpj.router, prefix="/api/cnpj", tags=["Receita Federal"], dependencies=[Depends(require_auth)])
app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["WhatsApp"], dependencies=[Depends(require_auth)])
app.include_router(whatsapp.webhook_router, prefix="/api/whatsapp", tags=["WhatsApp Webhook"])
app.include_router(campanhas.router, prefix="/api/campanhas", tags=["Campanhas"], dependencies=[Depends(require_auth)])
app.include_router(campanhas.public_router, prefix="/api/campanhas", tags=["Campanhas Public"])
app.include_router(templates.router, prefix="/api/templates", tags=["Templates"], dependencies=[Depends(require_auth)])
app.include_router(mercado.router, prefix="/api/mercado", tags=["Mercado"], dependencies=[Depends(require_auth)])
app.include_router(dmc.router, prefix="/api/dmc", tags=["Complexo DMC"], dependencies=[Depends(require_auth)])
app.include_router(decisores.router, prefix="/api/decisores", tags=["Decisores"], dependencies=[Depends(require_auth)])
app.include_router(tarefas.router, prefix="/api/tarefas", tags=["Tarefas"], dependencies=[Depends(require_auth)])
app.include_router(equipes.router, prefix="/api/equipes", tags=["Equipes"], dependencies=[Depends(require_auth)])

@app.get("/")
async def root():
    # Diagnóstico de readiness (sem expor segredos): ajuda a saber, em produção,
    # se o SMTP e o e-mail do dono foram lidos do ambiente.
    from services import mailer
    from database import settings
    return {
        "status": "ok",
        "sistema": "ImobPro",
        "versao": "1.0.0",
        "smtp": mailer.smtp_configurado(),
        "smtp_host": bool(settings.smtp_host),
        "smtp_from": bool(settings.smtp_from),
        "dono_principal_email": bool((settings.dono_principal_email or settings.smtp_from or "").strip()),
    }
