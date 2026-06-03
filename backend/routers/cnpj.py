from fastapi import APIRouter, HTTPException
import httpx
import re

from services.cnpj_enrichment import map_cnpja

router = APIRouter()

def format_cnpj(cnpj: str) -> str:
    return re.sub(r'\D', '', cnpj)

@router.get("/consulta/{cnpj}")
async def consultar_cnpj(cnpj: str):
    """Consulta dados de empresa na Receita Federal via BrasilAPI"""
    cnpj_limpo = format_cnpj(cnpj)
    if len(cnpj_limpo) != 14:
        raise HTTPException(status_code=400, detail="CNPJ inválido")

    async with httpx.AsyncClient(timeout=30) as client:
        # Tenta BrasilAPI primeiro
        try:
            r = await client.get(f"https://brasilapi.com.br/api/cnpj/v1/{cnpj_limpo}")
            if r.status_code == 200:
                data = r.json()
                return {
                    "cnpj": cnpj_limpo,
                    "razao_social": data.get("razao_social"),
                    "nome_fantasia": data.get("nome_fantasia"),
                    "situacao_cadastral": data.get("descricao_situacao_cadastral"),
                    "data_situacao_cadastral": data.get("data_situacao_cadastral"),
                    "data_abertura": data.get("data_inicio_atividade"),
                    "natureza_juridica": data.get("natureza_juridica"),
                    "porte": data.get("porte"),
                    "capital_social": data.get("capital_social"),
                    "cnae_principal": data.get("cnae_fiscal"),
                    "cnae_descricao": data.get("cnae_fiscal_descricao"),
                    "logradouro": data.get("logradouro"),
                    "numero": data.get("numero"),
                    "complemento": data.get("complemento"),
                    "bairro": data.get("bairro"),
                    "municipio": data.get("municipio"),
                    "uf": data.get("uf"),
                    "cep": data.get("cep"),
                    "email": data.get("email"),
                    "telefone": data.get("ddd_telefone_1"),
                    "telefone2": data.get("ddd_telefone_2"),
                    "qsa": data.get("qsa", []),
                    "fonte": "BrasilAPI",
                }
        except Exception:
            pass

        # Fallback: ReceitaWS
        try:
            r = await client.get(f"https://receitaws.com.br/v1/cnpj/{cnpj_limpo}")
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "ERROR":
                    raise HTTPException(status_code=404, detail="CNPJ não encontrado")
                return {
                    "cnpj": cnpj_limpo,
                    "razao_social": data.get("nome"),
                    "nome_fantasia": data.get("fantasia"),
                    "situacao_cadastral": data.get("situacao"),
                    "data_abertura": data.get("abertura"),
                    "natureza_juridica": data.get("natureza_juridica"),
                    "porte": data.get("porte"),
                    "capital_social": data.get("capital_social"),
                    "logradouro": data.get("logradouro"),
                    "numero": data.get("numero"),
                    "complemento": data.get("complemento"),
                    "bairro": data.get("bairro"),
                    "municipio": data.get("municipio"),
                    "uf": data.get("uf"),
                    "cep": data.get("cep"),
                    "email": data.get("email"),
                    "telefone": data.get("telefone"),
                    "qsa": data.get("qsa", []),
                    "fonte": "ReceitaWS",
                }
        except HTTPException:
            raise
        except Exception:
            pass

        # Fallback final: CNPJá (open.cnpja.com)
        try:
            r = await client.get(f"https://open.cnpja.com/office/{cnpj_limpo}")
            if r.status_code == 200:
                return map_cnpja(r.json(), cnpj_limpo)
        except Exception:
            pass

    raise HTTPException(status_code=503, detail="Serviço de consulta CNPJ indisponível")


@router.get("/busca-nome/{nome}")
async def buscar_por_nome(nome: str):
    """Busca empresas por nome na BrasilAPI"""
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.get(
                f"https://brasilapi.com.br/api/cnpj/v1/search",
                params={"query": nome}
            )
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return {"resultados": [], "mensagem": "Busca por nome não disponível neste endpoint"}
