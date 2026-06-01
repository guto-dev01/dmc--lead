import asyncio
import base64
import unicodedata
import re
from typing import Optional
import urllib.parse
from urllib.parse import parse_qs, unquote, urljoin, urlparse
import urllib.request

import httpx
from bs4 import BeautifulSoup

SEARCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
}

CNPJ_RE = re.compile(r"\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b")
DOMAIN_STOPWORDS = {
    "incorporadora",
    "construtora",
    "imobiliaria",
    "imobiliária",
    "consultoria",
    "assessoria",
    "empreendimentos",
    "realty",
    "brazil",
    "grupo",
    "sa",
    "s.a",
    "s.a.",
    "de",
    "da",
    "do",
    "dos",
    "das",
    "e",
}


def clean_cnpj(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def extract_cnpj(text: str) -> Optional[str]:
    if not text:
        return None
    match = CNPJ_RE.search(text)
    if not match:
        return None
    return clean_cnpj(match.group(0))


def decode_bing_url(url: str) -> str:
    if not url:
        return ""

    if "bing.com/ck/a" not in url:
        return url

    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    encoded = params.get("u", [None])[0]
    if not encoded:
        return url

    encoded = unquote(encoded)
    if encoded.startswith("a1"):
        encoded = encoded[2:]

    try:
        padded = encoded + "=" * (-len(encoded) % 4)
        decoded = base64.b64decode(padded).decode("utf-8", "ignore")
        if decoded.startswith("http"):
            return decoded
    except Exception:
        pass

    return url


# ---- Extração de telefone / WhatsApp -------------------------------------

# Links diretos de WhatsApp (melhor fonte): wa.me / api.whatsapp.com/send?phone=
WA_LINK_RE = re.compile(
    r"(?:wa\.me/|api\.whatsapp\.com/send\?phone=|whatsapp\.com/send\?phone=)(\+?\d[\d]{8,16})",
    re.I,
)
# Celular BR no texto: (DD) 9XXXX-XXXX
CEL_RE = re.compile(r"\(?\b(\d{2})\)?[\s.\-]?9\d{4}[\s.\-]?\d{4}\b")


def _so_digitos(valor: str) -> str:
    return re.sub(r"\D", "", valor or "")


def _para_e164_br(raw: str) -> Optional[str]:
    """Normaliza um telefone BR para 55+DDD+numero. Retorna None se invalido."""
    d = _so_digitos(raw)
    if d.startswith("55") and len(d) > 11:
        d = d[2:]
    if len(d) == 11 and d[2] == "9":   # celular: DDD + 9 + 8 digitos
        return "55" + d
    if len(d) == 10 and d[2] in "2345": # fixo: DDD + 8 digitos
        return "55" + d
    return None


def whatsapp_de_telefones(*telefones) -> Optional[str]:
    """Escolhe, entre os telefones dados, o primeiro que for celular (WhatsApp)."""
    for tel in telefones:
        e164 = _para_e164_br(tel or "")
        if e164 and len(_so_digitos(e164)) == 13:  # 55 + 11 = celular
            return _so_digitos(e164)
    return None


def extrair_whatsapp(texto: str) -> Optional[str]:
    """Procura um numero de WhatsApp (link wa.me ou celular) em um texto/html."""
    if not texto:
        return None
    for m in WA_LINK_RE.finditer(texto):
        e164 = _para_e164_br(m.group(1))
        if e164 and len(_so_digitos(e164)) == 13:
            return _so_digitos(e164)
    for m in CEL_RE.finditer(texto):
        e164 = _para_e164_br(m.group(0))
        if e164:
            return _so_digitos(e164)
    return None


def _descobrir_whatsapp_sync(company_name: str, website: Optional[str] = None) -> Optional[dict]:
    """Varre o site da empresa (home + paginas de contato) atras de um WhatsApp."""
    urls: list[str] = []
    if website:
        base = website if website.startswith("http") else f"https://{website}"
        base = base.rstrip("/")
        urls += [base + "/", base + "/contato", base + "/fale-conosco"]
    for slug in _guess_company_domains(company_name):
        for template in ("https://{s}.com.br/", "https://www.{s}.com.br/", "https://{s}.com/"):
            urls.append(template.format(s=slug))

    visitados: set[str] = set()
    for url in urls:
        if url in visitados:
            continue
        visitados.add(url)
        try:
            html = _fetch_url_sync(url)
        except Exception:
            continue
        texto = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
        whats = extrair_whatsapp(html + " " + texto)
        if whats:
            return {"whatsapp": whats, "fonte_whatsapp": url}
        for link in _candidate_internal_links(html, url)[:4]:
            if link in visitados:
                continue
            visitados.add(link)
            try:
                ihtml = _fetch_url_sync(link)
            except Exception:
                continue
            itexto = BeautifulSoup(ihtml, "html.parser").get_text(" ", strip=True)
            whats = extrair_whatsapp(ihtml + " " + itexto)
            if whats:
                return {"whatsapp": whats, "fonte_whatsapp": link}
    return None


async def descobrir_whatsapp(company_name: str, website: Optional[str] = None) -> Optional[dict]:
    return await asyncio.to_thread(_descobrir_whatsapp_sync, company_name, website)


async def fetch_cnpj_data(cnpj: str) -> dict:
    cnpj_limpo = clean_cnpj(cnpj)
    if len(cnpj_limpo) != 14:
        raise ValueError("CNPJ inválido")

    async with httpx.AsyncClient(timeout=30, headers=SEARCH_HEADERS) as client:
        try:
            response = await client.get(f"https://brasilapi.com.br/api/cnpj/v1/{cnpj_limpo}")
            if response.status_code == 200:
                data = response.json()
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
                    "whatsapp": whatsapp_de_telefones(data.get("ddd_telefone_1"), data.get("ddd_telefone_2")),
                    "qsa": data.get("qsa", []),
                    "fonte": "BrasilAPI",
                    "raw": data,
                }
        except Exception:
            pass

        try:
            response = await client.get(f"https://receitaws.com.br/v1/cnpj/{cnpj_limpo}")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ERROR":
                    raise ValueError("CNPJ não encontrado")
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
                    "telefone2": None,
                    "whatsapp": whatsapp_de_telefones(data.get("telefone")),
                    "qsa": data.get("qsa", []),
                    "fonte": "ReceitaWS",
                    "raw": data,
                }
        except Exception:
            pass

    raise ValueError("Serviço de consulta CNPJ indisponível")


async def _fetch_text(client: httpx.AsyncClient, url: str) -> str:
    response = await client.get(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    return soup.get_text(" ", strip=True)


def _candidate_internal_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    keywords = (
        "sobre",
        "contato",
        "privacidade",
        "termo",
        "fornecedor",
        "fale",
        "institucional",
        "empresa",
        "quem-somos",
        "quem somos",
        "ri",
    )
    seen = set()
    links = []

    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "")
        text = anchor.get_text(" ", strip=True)
        absolute = urljoin(base_url, href)
        if not absolute.startswith("http"):
            continue
        if urlparse(absolute).netloc != urlparse(base_url).netloc:
            continue
        haystack = f"{text} {absolute}".lower()
        if not any(keyword in haystack for keyword in keywords):
            continue
        if absolute in seen:
            continue
        seen.add(absolute)
        links.append(absolute)
    return links


def _normalize_company_tokens(company_name: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", company_name.lower())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    parts = re.split(r"[^a-z0-9]+", normalized)
    tokens = []
    for part in parts:
        if not part or part in DOMAIN_STOPWORDS:
            continue
        tokens.append(part)
    return tokens


def _guess_company_domains(company_name: str) -> list[str]:
    tokens = _normalize_company_tokens(company_name)
    if not tokens:
        return []

    candidates = []
    joined = "".join(tokens)
    first = tokens[0]
    first_two = "".join(tokens[:2]) if len(tokens) >= 2 else first
    first_three = "".join(tokens[:3]) if len(tokens) >= 3 else first_two

    for slug in [joined, first_three, first_two, first]:
        if slug and slug not in candidates:
            candidates.append(slug)

    return candidates


def _try_domain_candidates_sync(company_name: str) -> Optional[dict]:
    suffixes = [
        "{slug}.com.br",
        "www.{slug}.com.br",
        "{slug}.com",
    ]

    for slug in _guess_company_domains(company_name):
        for template in suffixes:
            domain = template.format(slug=slug)
            url = f"https://{domain}/"
            try:
                page_html = _fetch_url_sync(url)
            except Exception:
                continue

            page_text = BeautifulSoup(page_html, "html.parser").get_text(" ", strip=True)
            cnpj = extract_cnpj(page_text)
            if cnpj:
                return {
                    "cnpj": cnpj,
                    "fonte": url,
                    "consulta": company_name,
                    "evidencia": f"dominio={domain}",
                }

            for internal_url in _candidate_internal_links(page_html, url)[:4]:
                try:
                    internal_html = _fetch_url_sync(internal_url)
                except Exception:
                    continue
                internal_text = BeautifulSoup(internal_html, "html.parser").get_text(" ", strip=True)
                cnpj = extract_cnpj(internal_text)
                if cnpj:
                    return {
                        "cnpj": cnpj,
                        "fonte": internal_url,
                        "consulta": company_name,
                        "evidencia": f"dominio={domain}",
                    }

    return None


def _fetch_url_sync(url: str) -> str:
    request = urllib.request.Request(url, headers=SEARCH_HEADERS)
    with urllib.request.urlopen(request, timeout=4) as response:
        return response.read().decode("utf-8", "ignore")


def _search_cnpj_by_name_sync(company_name: str) -> Optional[dict]:
    domain_result = _try_domain_candidates_sync(company_name)
    if domain_result:
        return domain_result

    queries = [
        f"{company_name} CNPJ",
        f"{company_name} cadastro nacional pessoa juridica",
        f'"{company_name}" CNPJ',
    ]

    for query in queries:
        try:
            response_text = _fetch_url_sync("https://www.bing.com/search?q=" + urllib.parse.quote(query))
        except Exception:
            continue

        soup = BeautifulSoup(response_text, "html.parser")
        candidates = []

        for item in soup.select("li.b_algo")[:8]:
            anchor = item.select_one("h2 a")
            if not anchor:
                continue

            title = anchor.get_text(" ", strip=True)
            href = decode_bing_url(anchor.get("href", ""))
            snippet_tag = item.select_one("p")
            snippet = snippet_tag.get_text(" ", strip=True) if snippet_tag else ""

            for text in (title, snippet):
                cnpj = extract_cnpj(text)
                if cnpj:
                    return {
                        "cnpj": cnpj,
                        "fonte": "bing-snippet",
                        "consulta": query,
                        "evidencia": text,
                    }

            if href:
                candidates.append({"url": href, "title": title, "snippet": snippet})

        for candidate in candidates[:6]:
            try:
                page_html = _fetch_url_sync(candidate["url"])
                page_text = BeautifulSoup(page_html, "html.parser").get_text(" ", strip=True)
            except Exception:
                continue

            cnpj = extract_cnpj(page_text)
            if cnpj:
                return {
                    "cnpj": cnpj,
                    "fonte": candidate["url"],
                    "consulta": query,
                    "evidencia": candidate["title"] or candidate["snippet"],
                }

            for internal_url in _candidate_internal_links(page_html, candidate["url"])[:8]:
                try:
                    internal_text = _fetch_url_sync(internal_url)
                except Exception:
                    continue
                cnpj = extract_cnpj(BeautifulSoup(internal_text, "html.parser").get_text(" ", strip=True))
                if cnpj:
                    return {
                        "cnpj": cnpj,
                        "fonte": internal_url,
                        "consulta": query,
                        "evidencia": candidate["title"] or candidate["snippet"],
                    }

    return None


async def search_cnpj_by_name(company_name: str) -> Optional[dict]:
    return await asyncio.to_thread(_search_cnpj_by_name_sync, company_name)


def calculate_completeness_score(data: dict) -> int:
    fields = [
        "cnpj",
        "razao_social",
        "nome_fantasia",
        "situacao_cadastral",
        "data_abertura",
        "natureza_juridica",
        "porte",
        "capital_social",
        "cnae_principal",
        "cnae_descricao",
        "logradouro",
        "numero",
        "bairro",
        "municipio",
        "uf",
        "cep",
        "email",
        "telefone",
        "telefone2",
    ]
    filled = sum(1 for field in fields if data.get(field))
    qsa_bonus = 2 if data.get("qsa") else 0
    score = int((filled / len(fields)) * 90) + qsa_bonus
    return max(0, min(100, score))
