"""Configuração pública do app: lista de ramos (verticais) e seus rótulos/tipos.

Consumido pelo frontend para montar o seletor de ramo, as opções de tipo de
empresa, as cores e os textos — tudo dirigido por dados (services/ramos.py)."""
from fastapi import APIRouter

from services.ramos import config_publica

router = APIRouter()


@router.get("/ramos")
async def listar_ramos():
    return config_publica()
