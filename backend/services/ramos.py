"""Configuração dos ramos (verticais) do sistema: corporativa | imobiliaria | funeraria.

Tudo que muda de um ramo para o outro mora aqui — em um único lugar, dirigido por
dados — para que toda a "mesma lógica de programação" sirva os três ramos:

  - rótulos e textos (label, subtitulo)
  - tipos de empresa e suas cores (consumidos pelo frontend via /api/config/ramos)
  - parâmetros da busca de mercado real (termos de busca, classificação, etc.)

Os registros (empresas, contatos, templates, itens de mercado) carregam o campo
`ramo`, e as listas filtram por ele. O ramo ativo é um seletor global no topo do app
(um único login opera os três ramos).
"""
from typing import Optional

RAMO_PADRAO = "imobiliaria"

# Stopwords comuns a todos os ramos ao derivar o slug de domínio de uma empresa.
_STOPWORDS_COMUNS = {
    "grupo", "sa", "s.a", "s.a.", "ltda", "me", "epp", "eireli",
    "de", "da", "do", "dos", "das", "e",
}


RAMO_CONFIG = {
    "corporativa": {
        "label": "Corporativa",
        "subtitulo": "Aquisição institucional de ativos",
        "tipo_padrao": "fundo",
        # A "corporativa" é o módulo Complexo DMC (intermediação institucional).
        "usa_dmc": True,
        "tipos": [
            {"value": "fundo", "label": "Fundo / Gestora", "cor": "violet"},
            {"value": "incorporadora", "label": "Incorporadora", "cor": "amber"},
            {"value": "proprietario", "label": "Proprietário de ativo", "cor": "sky"},
            {"value": "family_office", "label": "Family Office", "cor": "emerald"},
            {"value": "administradora", "label": "Administradora", "cor": "orange"},
            {"value": "outro", "label": "Outro", "cor": "slate"},
        ],
        "busca": {
            "termos_area": [
                "fundo imobiliário {term} {cidade}",
                "imóvel comercial à venda {term} {cidade}",
                "laje corporativa {term} {cidade}",
                "galpão logístico {term} {cidade}",
            ],
            "termo_rua": 'imóvel comercial OR laje corporativa OR galpão "{rua}" {bairro} {cidade}',
            "listing_hints": [
                "laje", "lajes", "galpao", "galpão", "comercial", "corporativo",
                "logistico", "logístico", "investimento", "ativo", "cap rate",
                "imovel", "imóvel", "sala", "salas", "andar",
            ],
            "crawl_keywords": [
                "ativos", "portfolio", "portfólio", "empreend", "comercial",
                "galpao", "galpão", "investimento", "produtos", "imov",
            ],
            "stopwords": ["incorporadora", "construtora", "fundo", "gestora", "capital", "realty"],
            "paths": ["/ativos", "/portfolio", "/empreendimentos", "/comercial", "/galpoes", "/investimentos"],
            "default_name": "Ativo corporativo",
            "blocklist": ["vivareal", "zapimoveis", "imovelweb", "quintoandar", "olx", "chavesnamao"],
            "kinds": [
                ("fundo", ["fundo imobiliario", "fundo imobiliário", "fii", "gestora", "asset"]),
                ("imovel", ["laje", "galpao", "galpão", "imovel comercial", "imóvel comercial", "sala comercial", "loja"]),
                ("incorporadora", ["incorporadora", "construtora"]),
                ("empreendimento", ["empreendimento", "lancamento", "lançamento", "condominio", "condomínio"]),
            ],
        },
    },
    "imobiliaria": {
        "label": "Imobiliária",
        "subtitulo": "Prospecção imobiliária",
        "tipo_padrao": "incorporadora",
        "usa_dmc": False,
        "tipos": [
            {"value": "incorporadora", "label": "Incorporadora", "cor": "violet"},
            {"value": "construtora", "label": "Construtora", "cor": "amber"},
            {"value": "imobiliaria", "label": "Imobiliária", "cor": "sky"},
            {"value": "corretora", "label": "Corretora", "cor": "emerald"},
            {"value": "administradora", "label": "Administradora", "cor": "orange"},
            {"value": "outro", "label": "Outro", "cor": "slate"},
        ],
        "busca": {
            "termos_area": [
                "incorporadora {term} {cidade}",
                "construtora {term} {cidade}",
                "imobiliária {term} {cidade}",
            ],
            "termo_rua": 'empreendimento OR lançamento "{rua}" {bairro} {cidade}',
            "listing_hints": [
                "apartamento", "studio", "studios", "cobertura", "sala", "salas",
                "loja", "lancamento", "lançamento", "empreendimento", "residencial",
                "condominio", "condomínio", "imovel", "imóvel",
            ],
            "crawl_keywords": [
                "empreend", "lanc", "lanç", "imov", "venda", "alug", "busca",
                "resid", "decor", "projeto", "produto", "plantao", "plantão",
            ],
            "stopwords": [
                "incorporadora", "construtora", "imobiliaria", "imobiliária",
                "consultoria", "assessoria", "empreendimentos", "realty", "brazil",
            ],
            "paths": [
                "/empreendimentos", "/empreendimento", "/lancamentos", "/lancamento",
                "/imoveis", "/imovel", "/busca", "/imoveis-a-venda", "/imoveis-para-alugar",
            ],
            "default_name": "Item imobiliário",
            "blocklist": ["vivareal", "zapimoveis", "imovelweb", "quintoandar", "olx", "chavesnamao"],
            "kinds": [
                ("construtora", ["incorporadora", "construtora"]),
                ("imobiliaria", ["imobiliaria", "imobiliária", "creci", "consultoria de imoveis", "consultoria de imóveis"]),
                ("empreendimento", ["empreendimento", "lancamento", "lançamento", "condominio", "condomínio"]),
                ("imovel", ["apartamento", "studio", "cobertura", "sala", "loja", "imovel", "imóvel"]),
            ],
        },
    },
    "funeraria": {
        "label": "Funerária",
        "subtitulo": "Prospecção do setor funerário",
        "tipo_padrao": "funeraria",
        "usa_dmc": False,
        "tipos": [
            {"value": "funeraria", "label": "Funerária", "cor": "slate"},
            {"value": "plano_funerario", "label": "Plano Funerário", "cor": "violet"},
            {"value": "cemiterio", "label": "Cemitério", "cor": "emerald"},
            {"value": "crematorio", "label": "Crematório", "cor": "amber"},
            {"value": "floricultura", "label": "Floricultura", "cor": "rose"},
            {"value": "outro", "label": "Outro", "cor": "slate"},
        ],
        "busca": {
            "termos_area": [
                "funerária {term} {cidade}",
                "plano funerário {term} {cidade}",
                "cemitério {term} {cidade}",
                "crematório {term} {cidade}",
                "floricultura velório {term} {cidade}",
            ],
            "termo_rua": 'funerária OR "plano funerário" OR cemitério "{rua}" {bairro} {cidade}',
            "listing_hints": [
                "velorio", "velório", "sepultamento", "cremacao", "cremação",
                "jazigo", "gaveta", "plano funeral", "plano funerário",
                "assistencia funeral", "assistência funeral", "traslado", "urna",
                "capela", "funeraria", "funerária", "obito", "óbito",
            ],
            "crawl_keywords": [
                "planos", "servicos", "serviços", "cremacao", "cremação",
                "velorio", "velório", "cemiterio", "cemitério", "sepultamento",
                "coroas", "traslado", "funeral", "assistencia", "assistência",
            ],
            "stopwords": [
                "funeraria", "funerária", "funerario", "funerário", "cemiterio",
                "cemitério", "crematorio", "crematório", "luto", "sepultamento",
                "velorio", "velório", "assistencia", "assistência",
            ],
            "paths": [
                "/planos", "/servicos", "/cremacao", "/velorio", "/cemiterio",
                "/funeraria", "/assistencia", "/sobre", "/plano-funeral",
            ],
            "default_name": "Serviço funerário",
            "blocklist": [],
            "kinds": [
                ("funeraria", ["funeraria", "funerária", "assistencia funeral", "assistência funeral", "servico funerario", "serviço funerário", "agencia funeraria", "agência funerária"]),
                ("cemiterio", ["cemiterio", "cemitério", "jazigo", "gaveta", "columbario", "columbário", "sepultamento"]),
                ("crematorio", ["crematorio", "crematório", "cremacao", "cremação"]),
                ("plano_funerario", ["plano funeral", "plano funerário", "previdencia funeraria", "previdência funerária", "assistencia familiar", "assistência familiar"]),
                ("floricultura", ["floricultura", "coroa de flores", "coroas"]),
            ],
        },
    },
}

RAMOS = list(RAMO_CONFIG.keys())


def normalizar_ramo(valor: Optional[str]) -> str:
    """Devolve um ramo válido; cai no padrão quando vazio/desconhecido."""
    v = (valor or "").strip().lower()
    return v if v in RAMO_CONFIG else RAMO_PADRAO


def ramo_config(ramo: Optional[str]) -> dict:
    return RAMO_CONFIG[normalizar_ramo(ramo)]


def ramo_busca(ramo: Optional[str]) -> dict:
    return RAMO_CONFIG[normalizar_ramo(ramo)]["busca"]


def ramo_stopwords(ramo: Optional[str]) -> set:
    return set(ramo_busca(ramo).get("stopwords") or []) | _STOPWORDS_COMUNS


def config_publica() -> dict:
    """Payload consumido pelo frontend (/api/config/ramos)."""
    return {
        "ramos": RAMOS,
        "padrao": RAMO_PADRAO,
        "config": {
            ramo: {
                "label": cfg["label"],
                "subtitulo": cfg["subtitulo"],
                "tipo_padrao": cfg["tipo_padrao"],
                "usa_dmc": cfg.get("usa_dmc", False),
                "tipos": cfg["tipos"],
            }
            for ramo, cfg in RAMO_CONFIG.items()
        },
    }
