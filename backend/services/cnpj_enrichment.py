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
    r"(?:wa\.me/|wa\.link/|api\.whatsapp\.com/send/?\?phone=|web\.whatsapp\.com/send/?\?phone=|whatsapp\.com/send/?\?phone=)(\+?\d[\d]{8,16})",
    re.I,
)
# Links tel: (href="tel:+55...") — boa fonte quando o número está num botão de ligação
TEL_HREF_RE = re.compile(r"tel:(\+?[\d\s().\-]{8,20})", re.I)
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
    """Procura um numero de WhatsApp (link wa.me, tel: ou celular) em um texto/html."""
    if not texto:
        return None
    # 1) Link direto de WhatsApp = melhor evidência. Aceita celular (13) e fixo
    #    de WhatsApp Business (12), pois o link em si já confirma que é WhatsApp.
    for m in WA_LINK_RE.finditer(texto):
        e164 = _para_e164_br(m.group(1))
        if e164 and len(_so_digitos(e164)) in (12, 13):
            return _so_digitos(e164)
    # 2) Link tel: que seja celular (provável WhatsApp)
    for m in TEL_HREF_RE.finditer(texto):
        e164 = _para_e164_br(m.group(1))
        if e164 and len(_so_digitos(e164)) == 13:
            return _so_digitos(e164)
    # 3) Celular escrito no texto da página
    for m in CEL_RE.finditer(texto):
        e164 = _para_e164_br(m.group(0))
        if e164:
            return _so_digitos(e164)
    return None


# Caminhos comuns onde empresas publicam contato/WhatsApp
CONTACT_PATHS = [
    "", "contato", "contato/", "fale-conosco", "fale-conosco/", "contact",
    "contato-2", "atendimento", "quem-somos", "sobre", "institucional",
]


def _candidatos_url(company_name: str, website: Optional[str]) -> list[str]:
    """Monta a lista de URLs a varrer. Prioriza o site cadastrado e, como rede
    de segurança (site errado/fora do ar), também tenta domínios adivinhados
    pelo nome da empresa."""
    urls: list[str] = []
    if website:
        base = website if website.startswith("http") else f"https://{website}"
        base = base.rstrip("/")
        urls += [f"{base}/{p}" if p else f"{base}/" for p in CONTACT_PATHS]
    for slug in _guess_company_domains(company_name):
        for template in ("https://{s}.com.br/", "https://www.{s}.com.br/", "https://{s}.com/"):
            urls.append(template.format(s=slug))
    # remove duplicados preservando ordem
    vistos, out = set(), []
    for u in urls:
        if u not in vistos:
            vistos.add(u); out.append(u)
    return out


def _dominio_da_empresa(url: str, company_name: str) -> bool:
    """True se o host parece ser o site OFICIAL da empresa (e não um portal/
    agregador que apenas menciona o nome). Usa só slugs específicos (>= 7
    caracteres) para evitar falsos positivos com tokens genéricos curtos."""
    host = urlparse(url).netloc.lower()
    especificos = [s for s in _guess_company_domains(company_name) if len(s) >= 7]
    return any(slug in host for slug in especificos)


def _links_resultado_busca(html: str) -> list[str]:
    """Extrai os links de resultado de uma SERP do Bing/DuckDuckGo."""
    soup = BeautifulSoup(html, "html.parser")
    out, vistos = [], set()
    for a in soup.select("a[href]"):
        href = decode_bing_url(a.get("href", ""))
        # DuckDuckGo embrulha o destino em /l/?uddg=<url>
        if "/l/?" in href and "uddg=" in href:
            qs = parse_qs(urlparse(href).query)
            if qs.get("uddg"):
                href = unquote(qs["uddg"][0])
        if not href.startswith("http"):
            continue
        host = urlparse(href).netloc.lower()
        if any(b in host for b in ("bing.com", "duckduckgo.com", "microsoft.com", "msn.com", "go.microsoft")):
            continue
        if href not in vistos:
            vistos.add(href); out.append(href)
    return out


async def _whatsapp_por_busca(client, company_name: str, loop, fim) -> Optional[dict]:
    """Fallback: pesquisa o nome da empresa num buscador e abre os primeiros
    resultados procurando um WhatsApp, validando a relevância da página."""
    engines = ("https://www.bing.com/search?q=", "https://duckduckgo.com/html/?q=")
    queries = (f"{company_name} whatsapp", f"{company_name} contato whatsapp")
    visitados: set[str] = set()
    for engine in engines:
        for query in queries:
            if loop.time() >= fim:
                return None
            try:
                resp = await client.get(engine + urllib.parse.quote(query))
                serp = resp.text
            except Exception:
                continue
            for href in _links_resultado_busca(serp)[:5]:
                if loop.time() >= fim:
                    return None
                if href in visitados:
                    continue
                visitados.add(href)
                try:
                    phtml = await _fetch_html_async(client, href)
                except Exception:
                    continue
                if not phtml:
                    continue
                # Só confia em página do domínio oficial da empresa (evita
                # pegar número de portal/agregador ou de empresa homônima).
                if not _dominio_da_empresa(href, company_name):
                    continue
                ptexto = BeautifulSoup(phtml, "html.parser").get_text(" ", strip=True)
                whats = extrair_whatsapp(phtml + " " + ptexto)
                if whats:
                    return {"whatsapp": whats, "fonte_whatsapp": href}
    return None


async def _fetch_html_async(client: "httpx.AsyncClient", url: str) -> str:
    resp = await client.get(url)
    resp.raise_for_status()
    ctype = (resp.headers.get("content-type") or "").lower()
    if "html" not in ctype and "text" not in ctype and ctype:
        return ""
    return resp.text


async def descobrir_whatsapp(
    company_name: str, website: Optional[str] = None, deadline_s: float = 25.0
) -> Optional[dict]:
    """Varre o site da empresa (home + paginas de contato + links internos)
    atras de um WhatsApp. Usa httpx seguindo redirects e tolerante a SSL.
    Para tudo apos `deadline_s` segundos para nao travar a requisicao."""
    urls = _candidatos_url(company_name, website)
    if not urls:
        return None

    loop = asyncio.get_event_loop()
    fim = loop.time() + deadline_s
    visitados: set[str] = set()
    timeout = httpx.Timeout(8.0, connect=5.0)
    async with httpx.AsyncClient(
        timeout=timeout, headers=SEARCH_HEADERS, follow_redirects=True, verify=False
    ) as client:
        for url in urls:
            if loop.time() >= fim:
                break
            if url in visitados:
                continue
            visitados.add(url)
            try:
                html = await _fetch_html_async(client, url)
            except Exception:
                continue
            if not html:
                continue
            texto = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
            whats = extrair_whatsapp(html + " " + texto)
            if whats:
                return {"whatsapp": whats, "fonte_whatsapp": url}
            for link in _candidate_internal_links(html, url)[:5]:
                if loop.time() >= fim:
                    break
                if link in visitados:
                    continue
                visitados.add(link)
                try:
                    ihtml = await _fetch_html_async(client, link)
                except Exception:
                    continue
                if not ihtml:
                    continue
                itexto = BeautifulSoup(ihtml, "html.parser").get_text(" ", strip=True)
                whats = extrair_whatsapp(ihtml + " " + itexto)
                if whats:
                    return {"whatsapp": whats, "fonte_whatsapp": link}

        # Fallback: não achou no site -> pesquisa no buscador (Bing/DuckDuckGo)
        if loop.time() < fim:
            achado = await _whatsapp_por_busca(client, company_name, loop, fim)
            if achado:
                return achado
    return None


# ---- Descoberta de e-mails (empresa + donos) ------------------------------

EMAIL_RE = re.compile(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}", re.I)
# locais/domínios que não são e-mail de negócio (placeholders, libs, imagens)
EMAIL_BLOQUEIO = (
    "sentry", "wixpress", "example.", "@example", "noreply", "no-reply", "donotreply",
    "do-not-reply", "godaddy", "core.windows", "cloudflare", "schema.org", "sentry.io",
    "@2x", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", "u003e", "email@",
    "seuemail", "seu-email", "nome@", "test@", "teste@",
)
# locais preferidos para o e-mail "oficial" da empresa
EMAIL_LOCAL_PREF = (
    "contato", "comercial", "atendimento", "faleconosco", "fale", "vendas",
    "sac", "imprensa", "negocios", "incorporacao", "relacionamento", "rh",
)


def emails_validos(texto: str) -> list[str]:
    """Extrai e-mails de um HTML/texto (mailto: + padrão), filtrando lixo."""
    if not texto:
        return []
    achados: list[str] = []
    for m in re.finditer(r"mailto:([^\"'>?\s]+)", texto, re.I):
        achados.append(m.group(1))
    for m in EMAIL_RE.finditer(texto):
        achados.append(m.group(0))

    out, vistos = [], set()
    for e in achados:
        e = (e or "").strip().strip(".").lower()
        if "@" not in e:
            continue
        local, _, dom = e.partition("@")
        if not local or "." not in dom:
            continue
        if any(b in e for b in EMAIL_BLOQUEIO):
            continue
        if e in vistos:
            continue
        vistos.add(e)
        out.append(e)
    return out


def melhor_email_empresa(emails: list[str], dominio: Optional[str] = None) -> Optional[str]:
    """Escolhe o e-mail institucional mais provável da empresa."""
    if not emails:
        return None
    dom = (dominio or "").lower().lstrip("www.")

    def chave(e: str):
        local, _, d = e.partition("@")
        s = 0
        if any(p in local for p in EMAIL_LOCAL_PREF):
            s += 3
        if dom and dom in d:
            s += 2
        if local in ("info", "mail", "email", "site"):
            s -= 1
        return -s

    return sorted(emails, key=chave)[0]


def casar_email_dono(nome: str, emails: list[str]) -> Optional[str]:
    """Tenta associar um e-mail ao nome de um sócio/dono pelo padrão do local.
    Conservador: exige nome+sobrenome (ou inicial+sobrenome) para evitar erro."""
    toks = _normalize_company_tokens(nome)
    if len(toks) < 2:
        return None
    first, last = toks[0], toks[-1]
    for e in emails:
        local = re.sub(r"[^a-z0-9]", "", e.split("@")[0].lower())
        if not local:
            continue
        if first + last == local or last + first == local:
            return e
        if f"{first}.{last}" in e.lower() or f"{last}.{first}" in e.lower():
            return e
        if local == first[0] + last or local == first + last[0]:
            return e
    return None


async def _emails_por_busca(client, company_name: str, loop, fim) -> list[str]:
    """Fallback: pesquisa a empresa e coleta e-mails só das páginas do domínio
    oficial (evita e-mail de terceiros)."""
    engines = ("https://www.bing.com/search?q=", "https://duckduckgo.com/html/?q=")
    queries = (f"{company_name} email contato", f"{company_name} fale conosco")
    visitados: set[str] = set()
    coletados: list[str] = []
    for engine in engines:
        for query in queries:
            if loop.time() >= fim:
                return coletados
            try:
                resp = await client.get(engine + urllib.parse.quote(query))
                serp = resp.text
            except Exception:
                continue
            for href in _links_resultado_busca(serp)[:5]:
                if loop.time() >= fim:
                    return coletados
                if href in visitados:
                    continue
                visitados.add(href)
                if not _dominio_da_empresa(href, company_name):
                    continue
                try:
                    phtml = await _fetch_html_async(client, href)
                except Exception:
                    continue
                coletados += emails_validos(phtml)
            if coletados:
                return coletados
    return coletados


async def descobrir_emails(
    company_name: str, website: Optional[str] = None, deadline_s: float = 20.0
) -> dict:
    """Varre o site da empresa (home + contato + links internos) coletando os
    e-mails. Cai para busca (domínio oficial) se o site não entregar."""
    urls = _candidatos_url(company_name, website)
    if not urls:
        return {"emails": []}

    loop = asyncio.get_event_loop()
    fim = loop.time() + deadline_s
    visitados: set[str] = set()
    coletados: list[str] = []
    timeout = httpx.Timeout(8.0, connect=5.0)
    async with httpx.AsyncClient(
        timeout=timeout, headers=SEARCH_HEADERS, follow_redirects=True, verify=False
    ) as client:
        for url in urls:
            if loop.time() >= fim:
                break
            if url in visitados:
                continue
            visitados.add(url)
            try:
                html = await _fetch_html_async(client, url)
            except Exception:
                continue
            if not html:
                continue
            coletados += emails_validos(html)
            for link in _candidate_internal_links(html, url)[:5]:
                if loop.time() >= fim:
                    break
                if link in visitados:
                    continue
                visitados.add(link)
                try:
                    ihtml = await _fetch_html_async(client, link)
                except Exception:
                    continue
                coletados += emails_validos(ihtml)

        if not coletados and loop.time() < fim:
            coletados += await _emails_por_busca(client, company_name, loop, fim)

    # dedup preservando ordem
    out, vistos = [], set()
    for e in coletados:
        if e not in vistos:
            vistos.add(e); out.append(e)
    return {"emails": out}


def map_cnpja(data: dict, cnpj_limpo: str) -> dict:
    """Converte a resposta de open.cnpja.com/office/{cnpj} para o formato padrão."""
    company = data.get("company") or {}
    address = data.get("address") or {}
    phones = data.get("phones") or []
    emails = data.get("emails") or []

    def _fone(p: dict) -> Optional[str]:
        if not p:
            return None
        area = (p.get("area") or "").strip()
        num = (p.get("number") or "").strip()
        return f"({area}) {num}".strip() if (area or num) else None

    tel1 = _fone(phones[0]) if len(phones) > 0 else None
    tel2 = _fone(phones[1]) if len(phones) > 1 else None

    # members (sócios) -> mesmo formato do QSA usado em decisores/empresas
    qsa = []
    for m in (company.get("members") or []):
        pessoa = m.get("person") or {}
        role = m.get("role") or {}
        qsa.append({
            "nome_socio": pessoa.get("name"),
            "qualificacao_socio": role.get("text"),
            "faixa_etaria": pessoa.get("age"),
            "data_entrada_sociedade": m.get("since"),
        })

    return {
        "cnpj": cnpj_limpo,
        "razao_social": company.get("name"),
        "nome_fantasia": data.get("alias"),
        "situacao_cadastral": (data.get("status") or {}).get("text"),
        "data_situacao_cadastral": data.get("statusDate"),
        "data_abertura": data.get("founded"),
        "natureza_juridica": (company.get("nature") or {}).get("text"),
        "porte": (company.get("size") or {}).get("text"),
        "capital_social": company.get("equity"),
        "cnae_principal": (data.get("mainActivity") or {}).get("id"),
        "cnae_descricao": (data.get("mainActivity") or {}).get("text"),
        "logradouro": address.get("street"),
        "numero": address.get("number"),
        "complemento": address.get("details"),
        "bairro": address.get("district"),
        "municipio": address.get("city"),
        "uf": address.get("state"),
        "cep": address.get("zip"),
        "email": emails[0].get("address") if emails else None,
        "telefone": tel1,
        "telefone2": tel2,
        "whatsapp": whatsapp_de_telefones(tel1, tel2),
        "qsa": qsa,
        "fonte": "CNPJá",
        "raw": data,
    }


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

        # Fallback final: CNPJá (open.cnpja.com)
        try:
            response = await client.get(f"https://open.cnpja.com/office/{cnpj_limpo}")
            if response.status_code == 200:
                return map_cnpja(response.json(), cnpj_limpo)
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
        "whatsapp",
        "atendimento",
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
