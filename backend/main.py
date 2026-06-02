from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from contextlib import asynccontextmanager
from routers import auth, empresas, cnpj, whatsapp, campanhas, templates, dashboard, mercado, dmc, decisores
from services.schema import ensure_schema
from services.auth import require_auth
from database import init_pool, close_pool
import asyncio
import os


async def wait_for_schema():
    last_error = None
    for _ in range(20):
        try:
            await ensure_schema()
            return
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(1)
    raise last_error

@asynccontextmanager
async def lifespan(app: FastAPI):
    await wait_for_schema()
    await init_pool()
    yield
    await close_pool()

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

@app.get("/")
async def root():
    return {"status": "ok", "sistema": "ImobPro", "versao": "1.0.0"}
