"""Pesquisa de decisores (donos, sócios, diretores) na web.

Usa o mesmo provedor de busca do módulo Mercado (Google CSE > Serper > Brave,
conforme as chaves no ambiente) e devolve resultados estruturados — título,
trecho, link e, quando há, o perfil de LinkedIn da pessoa — como material de
estudo. Não inventa nomes/dados: só organiza o que a busca retorna.
"""
import asyncio
import re
from typing import Optional
from urllib.parse import urlparse

import urllib.parse

from services.market_intelligence import (
    _web_search, _has_search_provider, _tem_provedor_keyed, aviso_busca,
)
from services.hunter import (
    hunter_ativo, hunter_email_finder, hunter_domain_search, dominio_de,
)
from services.cnpj_enrichment import (
    descobrir_emails, descobrir_whatsapp, casar_email_dono,
    _guess_company_domains, _fetch_url_sync, _links_resultado_busca,
)

# Perfis de pessoas no LinkedIn (não confundir com /company/)
LINKEDIN_IN_RE = re.compile(r"https?://[a-z0-9.]*linkedin\.com/in/[^\s\"'<>)]+", re.I)

# E-mails
EMAIL_RE = re.compile(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}", re.I)
# Domínios/sufixos que não são contato de verdade (assets, tracking, exemplos)
EMAIL_LIXO = (
    "example.com", "email.com", "domain.com", "sentry.io", "wixpress.com",
    "gstatic.com", "googleapis.com", "schema.org", "w3.org", "sentry-next",
)
EMAIL_LIXO_EXT = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js")

# Telefones BR: (11) 99999-9999, +55 11 3333-4444, 11 3333-4444, 0800 ...
TELEFONE_RE = re.compile(
    r"(?:\+?55[\s.\-]?)?(?:\(?\d{2}\)?[\s.\-]?)?(?:9?\d{4})[\s.\-]?\d{4}"
    r"|0800[\s.\-]?\d{3}[\s.\-]?\d{4}",
)

# Cargos/relações que indicam decisor de negócio no ramo imobiliário
CARGOS = (
    "diretor", "diretora", "sócio", "socio", "sócia", "proprietário", "proprietaria",
    "fundador", "fundadora", "presidente", "ceo", "cofundador", "co-fundador", "head",
    "superintendente", "vice-presidente", "vp", "owner", "partner", "conselheiro",
)


def _limpar_linkedin(url: str) -> str:
    return url.split("?")[0].rstrip("/")


def _cargo_no_texto(texto: str) -> Optional[str]:
    baixo = (texto or "").lower()
    for c in CARGOS:
        if c in baixo:
            return c
    return None


def _montar_queries(empresa: str, termo_extra: str) -> list[str]:
    base = empresa.strip()
    queries = []
    if termo_extra:
        queries.append(f"{base} {termo_extra}")
    queries += [
        f"{base} diretor sócio proprietário fundador",
        f"{base} linkedin diretor OR sócio OR fundador",
        f"{base} CEO OR presidente OR fundador",
    ]
    vistos, out = set(), []
    for q in queries:
        if q not in vistos:
            vistos.add(q); out.append(q)
    return out


def _pesquisar_sync(empresa: str, termo_extra: str) -> dict:
    queries = _montar_queries(empresa, termo_extra)
    vistos: set[str] = set()
    resultados: list[dict] = []
    linkedins: set[str] = set()

    for query in queries:
        for item in _web_search(query, limit=10):
            url = (item.get("url") or "").strip()
            if not url.startswith("http"):
                continue
            titulo = item.get("title") or ""
            snippet = item.get("snippet") or ""

            # perfis de LinkedIn citados no texto do resultado
            for m in LINKEDIN_IN_RE.finditer(f"{url} {titulo} {snippet}"):
                linkedins.add(_limpar_linkedin(m.group(0)))

            if url in vistos:
                continue
            vistos.add(url)

            eh_perfil = "linkedin.com/in/" in url.lower()
            if eh_perfil:
                linkedins.add(_limpar_linkedin(url))
            resultados.append({
                "titulo": titulo,
                "url": url,
                "snippet": snippet,
                "fonte": urlparse(url).netloc.lower(),
                "linkedin": url if eh_perfil else None,
                "cargo": _cargo_no_texto(f"{titulo} {snippet}"),
            })

    # perfis de pessoa primeiro; depois quem cita um cargo
    resultados.sort(key=lambda r: (0 if r.get("linkedin") else 1, 0 if r.get("cargo") else 1))
    return {
        "empresa": empresa,
        "tem_provedor": _tem_provedor_keyed(),
        "aviso": aviso_busca(),
        "resultados": resultados[:25],
        "linkedin": sorted(linkedins)[:15],
    }


async def pesquisar_decisores(
    empresa: str, termo_extra: str = "", deadline_s: float = 22.0
) -> dict:
    """Pesquisa na web por decisores de uma empresa (material de estudo)."""
    empresa = (empresa or "").strip()
    if not empresa:
        return {"empresa": empresa, "tem_provedor": _tem_provedor_keyed(),
                "aviso": aviso_busca(), "resultados": [], "linkedin": []}
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_pesquisar_sync, empresa, (termo_extra or "").strip()),
            timeout=deadline_s,
        )
    except asyncio.TimeoutError:
        return {"empresa": empresa, "tem_provedor": _tem_provedor_keyed(),
                "aviso": "A pesquisa demorou demais e foi interrompida. Tente de novo.",
                "resultados": [], "linkedin": []}


# ---------------------------------------------------------------------------
# Busca de e-mail e telefone de um decisor / empresa
# ---------------------------------------------------------------------------

def _limpar_telefone(bruto: str) -> str:
    """Normaliza para exibição e descarta números que claramente não são telefone."""
    digitos = re.sub(r"\D", "", bruto)
    # remove DDI 55 redundante
    if len(digitos) > 11 and digitos.startswith("55"):
        digitos = digitos[2:]
    if len(digitos) not in (8, 9, 10, 11) and not digitos.startswith("0800"):
        return ""
    # 0800
    if digitos.startswith("0800") and len(digitos) == 11:
        return f"0800 {digitos[4:7]} {digitos[7:]}"
    if len(digitos) == 11:  # celular com DDD
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    if len(digitos) == 10:  # fixo com DDD
        return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
    if len(digitos) == 9:  # celular sem DDD
        return f"{digitos[:5]}-{digitos[5:]}"
    if len(digitos) == 8:  # fixo sem DDD
        return f"{digitos[:4]}-{digitos[4:]}"
    return ""


def _email_valido(e: str) -> bool:
    baixo = e.lower()
    if any(j in baixo for j in EMAIL_LIXO):
        return False
    if baixo.endswith(EMAIL_LIXO_EXT):
        return False
    # e-mails gerados por hash/assets costumam ser longos sem sentido
    return len(baixo) <= 80


# Agregadores/redes que não são o site oficial da empresa
_NAO_OFICIAIS = (
    "linkedin.", "facebook.", "instagram.", "twitter.", "x.com", "youtube.",
    "wikipedia.", "reclameaqui.", "glassdoor.", "google.", "gov.br", "jusbrasil.",
    "cnpj", "econodata.", "serasa", "b2brazil.", "apontador.", "telelistas.",
    "guiamais.", "solutudo.", "empresas", "consultas", "vivareal.", "zapimoveis.",
    "imovelweb.", "quintoandar.", "olx.", "mercadolivre.", "wa.me", "whatsapp.",
)


def _dominio_oficial_sync(empresa: str, website: str = "") -> str:
    """Descobre o domínio oficial da empresa SEM depender de chave de API.
    1) do website cadastrado; 2) adivinha o slug e testa se o site responde;
    3) busca no Bing/DuckDuckGo (HTML, sem chave)."""
    d = dominio_de(website)
    if d:
        return d
    empresa = (empresa or "").strip()
    if not empresa:
        return ""
    # 2) slug adivinhado + teste de carregamento
    for slug in _guess_company_domains(empresa):
        if len(slug) < 4:
            continue
        for dom in (f"{slug}.com.br", f"{slug}.com"):
            try:
                _fetch_url_sync(f"https://{dom}/")
                return dom
            except Exception:
                continue
    # 3) busca sem chave (Bing e DuckDuckGo)
    for engine in ("https://www.bing.com/search?q=", "https://duckduckgo.com/html/?q="):
        try:
            html = _fetch_url_sync(engine + urllib.parse.quote(f"{empresa} site oficial"))
        except Exception:
            continue
        for href in _links_resultado_busca(html)[:8]:
            host = dominio_de(href)
            if host and not any(a in host for a in _NAO_OFICIAIS):
                return host
    return ""


def _hunter_sync(dominio: str, nome: str) -> list[dict]:
    """Roda as duas chamadas do Hunter e devolve a lista de e-mails."""
    out = []
    if nome:
        out += hunter_email_finder(dominio, nome)
    out += hunter_domain_search(dominio, limit=10)
    return out


async def buscar_contato(
    nome: str, empresa: str = "", website: str = "", deadline_s: float = 26.0
) -> dict:
    """Procura e-mails e telefones de um decisor (ou da empresa).
    Combina Hunter.io (quando há domínio) + descoberta sem chave (scraping do
    site + Bing/DuckDuckGo) reaproveitada do enriquecimento de CNPJ."""
    nome = (nome or "").strip()
    empresa = (empresa or "").strip()
    website = (website or "").strip()

    emails: dict[str, dict] = {}
    telefones: dict[str, str] = {}

    def _add_email(valor: str, **extra):
        if not valor or "@" not in valor:
            return
        chave = valor.lower()
        if chave not in emails:
            emails[chave] = {"email": valor, "fonte": None, "score": None,
                             "cargo": None, "nome": None}
        for k, v in extra.items():
            if v and not emails[chave].get(k):
                emails[chave][k] = v

    base = {"nome": nome, "empresa": empresa, "tem_provedor": _has_search_provider(),
            "hunter": hunter_ativo()}
    if not nome and not empresa:
        return {**base, "hunter": False, "dominio": "", "emails": [], "telefones": [], "fontes": []}

    try:
        # 1) Descobre o domínio oficial (sem chave)
        dominio = await asyncio.wait_for(
            asyncio.to_thread(_dominio_oficial_sync, empresa, website), timeout=12.0
        )
        site = website or (f"https://{dominio}" if dominio else None)

        # 2) Hunter.io — e-mails nomeados com cargo e score (precisa de domínio)
        hunter_usado = False
        if hunter_ativo() and dominio:
            hunter_usado = True
            try:
                for h in await asyncio.wait_for(
                    asyncio.to_thread(_hunter_sync, dominio, nome), timeout=12.0
                ):
                    _add_email(h["email"], fonte=h.get("fonte"), score=h.get("score"),
                               cargo=h.get("cargo"), nome=h.get("nome"))
            except asyncio.TimeoutError:
                pass

        # 3) Descoberta sem chave: e-mails do próprio site + busca Bing/DuckDuckGo
        try:
            r_em = await descobrir_emails(empresa or nome, site, deadline_s=14.0)
            achados = r_em.get("emails") or []
            dono = casar_email_dono(nome, achados) if nome else None
            if dono:
                _add_email(dono, fonte="site (provável do decisor)", score=75, nome=nome)
            for e in achados[:10]:
                _add_email(e, fonte="site")
        except Exception:
            pass

        # 4) WhatsApp/telefone do site (sem chave)
        try:
            r_wa = await descobrir_whatsapp(empresa or nome, site, deadline_s=12.0)
            if r_wa and r_wa.get("whatsapp"):
                t = _limpar_telefone(r_wa["whatsapp"])
                if t:
                    telefones[t] = t
        except Exception:
            pass

    except asyncio.TimeoutError:
        return {**base, "dominio": "", "emails": [], "telefones": [], "fontes": []}

    lista_emails = sorted(emails.values(), key=lambda e: -(e.get("score") or 0))
    return {
        **base,
        "hunter": hunter_usado,
        "dominio": dominio,
        "emails": lista_emails[:12],
        "telefones": list(telefones.values())[:8],
        "fontes": [],
    }
