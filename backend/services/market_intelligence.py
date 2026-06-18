import base64
import asyncio
import json
import logging
import os
import re
import threading
import time
import unicodedata
from collections import Counter
from typing import Optional
from urllib.parse import parse_qs, unquote, urljoin, urlparse, quote

import httpx
from bs4 import BeautifulSoup

from services.ramos import RAMO_PADRAO, ramo_busca, ramo_stopwords

logger = logging.getLogger("imobpro.busca")

# Estado do provedor de busca (nível de processo, best-effort) — usado para
# diagnosticar por que a busca veio vazia. Ex.: chave do Google inválida → o
# código cai calado no DuckDuckGo, que bloqueia buscas em sequência. Sem isso,
# a tela só mostra "nada encontrado" sem explicar a causa real.
_PROVIDER_STATE: dict = {
    "ultimo_provedor": None,  # "google" | "serper" | "brave" | "duckduckgo"
    "erros": {},              # provedor -> última mensagem de erro
}


def _registrar_erro(provedor: str, msg: str) -> None:
    _PROVIDER_STATE["erros"][provedor] = msg
    logger.warning("Busca: provedor '%s' falhou — %s", provedor, msg)


def _registrar_sucesso(provedor: str) -> None:
    _PROVIDER_STATE["ultimo_provedor"] = provedor
    _PROVIDER_STATE["erros"].pop(provedor, None)

SEARCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

BLACKLIST_DOMAINS = {
    "bing.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "linkedin.com",
    "wikipedia.org",
    "maps.google.com",
}

def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", _strip_accents(value or "")).strip()


def _fetch_sync(url: str, params: Optional[dict] = None) -> str:
    response = httpx.get(
        url,
        params=params,
        headers=SEARCH_HEADERS,
        timeout=14,
        follow_redirects=True,
    )
    response.raise_for_status()
    return response.text


def _decode_bing_url(url: str) -> str:
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


def _bing_search(query: str, limit: int = 6) -> list[dict]:
    html = _fetch_sync("https://www.bing.com/search", {"q": query})
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for item in soup.select("li.b_algo")[:limit]:
        anchor = item.select_one("h2 a")
        if not anchor:
            continue
        href = _decode_bing_url(anchor.get("href", ""))
        title = anchor.get_text(" ", strip=True)
        snippet_tag = item.select_one("p")
        snippet = snippet_tag.get_text(" ", strip=True) if snippet_tag else ""
        if href:
            results.append({"url": href, "title": title, "snippet": snippet})
    return results


SERPER_ENDPOINT = "https://google.serper.dev/search"
BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"

NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search"
OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"
OSM_HEADERS = {
    "User-Agent": "ImobPro/1.0 (market-intelligence; contato via app)",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

# Tipos de via priorizados (vias principais primeiro)
HIGHWAY_PRIORITY = {
    "trunk": 0,
    "primary": 1,
    "secondary": 2,
    "tertiary": 3,
    "residential": 4,
    "living_street": 5,
    "unclassified": 6,
    "road": 7,
    "pedestrian": 8,
}


def _nominatim_bbox(term: str) -> Optional[tuple[float, float, float, float]]:
    """Retorna (south, west, north, east) do bairro/região via Nominatim (OSM)."""
    try:
        response = httpx.get(
            NOMINATIM_ENDPOINT,
            params={
                "q": f"{term}, São Paulo, SP, Brasil",
                "format": "json",
                "limit": 1,
                "countrycodes": "br",
            },
            headers=OSM_HEADERS,
            timeout=20,
        )
        if response.status_code != 200:
            return None
        data = response.json()
    except Exception:
        return None
    if not data:
        return None
    bbox = data[0].get("boundingbox")  # [south, north, west, east]
    if not bbox or len(bbox) != 4:
        return None
    try:
        south, north, west, east = (float(x) for x in bbox)
    except Exception:
        return None
    return (south, west, north, east)


def _overpass_streets(bbox: tuple[float, float, float, float], limit: int = 200) -> list[str]:
    """Lista os nomes das ruas dentro do bounding box, vias principais primeiro."""
    south, west, north, east = bbox
    types = "|".join(HIGHWAY_PRIORITY.keys())
    query = (
        "[out:json][timeout:40];"
        f'way["highway"~"^({types})$"]["name"]({south},{west},{north},{east});'
        "out tags;"
    )
    try:
        response = httpx.post(
            OVERPASS_ENDPOINT,
            data={"data": query},
            headers=OSM_HEADERS,
            timeout=60,
        )
        if response.status_code != 200:
            return []
        data = response.json()
    except Exception:
        return []

    # vias sem endereço residencial/comercial — não têm empreendimentos
    IGNORAR = ("tunel", "viaduto", "passagem subterranea", "acesso", "trevo",
               "ponte", "alca", "marginal", "rodoanel")

    ranked: dict[str, tuple[int, str]] = {}
    for element in data.get("elements", []):
        tags = element.get("tags") or {}
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        if _strip_accents(name).lower().startswith(IGNORAR):
            continue
        prio = HIGHWAY_PRIORITY.get(tags.get("highway"), 9)
        key = _strip_accents(name).lower()
        if key not in ranked or prio < ranked[key][0]:
            ranked[key] = (prio, name)

    ordered = sorted(ranked.values(), key=lambda pair: (pair[0], pair[1]))
    return [name for _, name in ordered][:limit]


def list_area_streets_sync(area: str, limit: int = 40) -> list[dict]:
    """Lista as ruas (rua + bairro) da região, distribuídas entre os bairros informados."""
    terms = _area_terms(area)
    if not terms:
        return []

    por_bairro: dict[str, list[str]] = {}
    for term in terms:
        bbox = _nominatim_bbox(term)
        por_bairro[term] = _overpass_streets(bbox, limit=limit * 3) if bbox else []

    out: list[dict] = []
    seen: set[str] = set()
    idx = 0
    maior = max((len(v) for v in por_bairro.values()), default=0)
    while len(out) < limit and idx < maior:
        for term in terms:
            lista = por_bairro.get(term) or []
            if idx >= len(lista):
                continue
            nome = lista[idx]
            key = _strip_accents(nome).lower()
            if key in seen:
                continue
            seen.add(key)
            out.append({"rua": nome, "bairro": term})
            if len(out) >= limit:
                break
        idx += 1
    return out


def scan_market_by_streets_sync(
    area: str,
    streets: Optional[list[str]] = None,
    streets_limit: int = 40,
    hits_per_street: int = 4,
    limit: int = 120,
    ramo: str = RAMO_PADRAO,
    cidade: str = "São Paulo",
) -> dict:
    """Varre o mercado RUA A RUA: para cada rua busca itens do ramo na web."""
    terms = _area_terms(area)
    bairro_padrao = terms[0] if terms else area
    termo_rua = ramo_busca(ramo).get("termo_rua", 'empreendimento OR lançamento "{rua}" {bairro} {cidade}')

    if streets:
        street_list = [
            {"rua": s.strip(), "bairro": bairro_padrao}
            for s in streets
            if s and s.strip()
        ][:streets_limit]
    else:
        street_list = list_area_streets_sync(area, limit=streets_limit)

    if not _has_search_provider():
        return {
            "items": [],
            "summary": {},
            "sources": {},
            "total": 0,
            "ruas": [s["rua"] for s in street_list],
            "aviso": "Nenhum provedor de busca configurado (BRAVE_API_KEY, SERPER_API_KEY ou GOOGLE_API_KEY).",
        }

    saved_items: list[dict] = []
    seen: set[str] = set()
    discovered_domains: Counter = Counter()
    ruas_processadas: list[str] = []

    for street in street_list:
        if len(saved_items) >= limit:
            break
        rua = street["rua"]
        bairro = street.get("bairro") or bairro_padrao
        ruas_processadas.append(rua)
        query = termo_rua.format(rua=rua, bairro=bairro, cidade=cidade)

        for hit in _web_search(query, limit=hits_per_street):
            if len(saved_items) >= limit:
                break
            url = hit.get("url", "")
            if not url or _looks_blocked(url):
                continue
            discovered_domains[_domain(url)] += 1

            candidates: list[dict] = []
            try:
                html = _fetch_sync(url)
                candidates = _page_candidates_from_html(html, url, query, None, bairro, ramo)
            except Exception:
                candidates = []
            if not candidates:
                light = _candidate_from_search_hit(hit, bairro, query, ramo, cidade)
                if light:
                    candidates = [light]

            for item in candidates:
                item["source_url"] = url
                item["source_query"] = query
                item.setdefault("dados", {})["rua"] = rua
                if not item.get("endereco"):
                    item["endereco"] = rua
                item["bairro"] = item.get("bairro") or bairro
                sig = _item_signature(item)
                if sig in seen:
                    continue
                seen.add(sig)
                item.setdefault("score", _item_score(item))
                saved_items.append(item)
                if len(saved_items) >= limit:
                    break

    summary = Counter([item.get("tipo", "outro") for item in saved_items])
    return {
        "items": saved_items,
        "summary": dict(summary),
        "sources": dict(discovered_domains),
        "total": len(saved_items),
        "ruas": ruas_processadas,
    }


def _google_cse_search(query: str, limit: int = 6) -> list[dict]:
    """Busca via API oficial do Google (Custom Search JSON API).
    Precisa de GOOGLE_API_KEY e GOOGLE_CSE_ID."""
    key = os.environ.get("GOOGLE_API_KEY", "").strip()
    cx = os.environ.get("GOOGLE_CSE_ID", "").strip()
    if not key or not cx:
        return []
    try:
        response = httpx.get(
            GOOGLE_CSE_ENDPOINT,
            params={
                "key": key,
                "cx": cx,
                "q": query,
                "num": min(max(int(limit), 1), 10),
                "gl": "br",
                "hl": "pt",
                "lr": "lang_pt",
            },
            timeout=20,
        )
        if response.status_code != 200:
            _registrar_erro("google", f"HTTP {response.status_code}: {response.text[:200]}")
            return []
        data = response.json()
    except Exception as e:
        _registrar_erro("google", f"{type(e).__name__}: {e}")
        return []

    results = []
    for item in (data.get("items") or [])[:limit]:
        href = item.get("link", "")
        if not href:
            continue
        results.append(
            {
                "url": href,
                "title": clean_text(item.get("title", "")),
                "snippet": clean_text(item.get("snippet", "")),
            }
        )
    return results


def _serper_search(query: str, limit: int = 6) -> list[dict]:
    """Busca via Serper.dev (resultados do Google). Precisa de SERPER_API_KEY."""
    key = os.environ.get("SERPER_API_KEY", "").strip()
    if not key:
        return []
    try:
        response = httpx.post(
            SERPER_ENDPOINT,
            json={"q": query, "gl": "br", "hl": "pt", "num": min(max(int(limit), 1), 10)},
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            timeout=20,
        )
        if response.status_code != 200:
            _registrar_erro("serper", f"HTTP {response.status_code}: {response.text[:200]}")
            return []
        data = response.json()
    except Exception as e:
        _registrar_erro("serper", f"{type(e).__name__}: {e}")
        return []

    results = []
    for item in (data.get("organic") or [])[:limit]:
        href = item.get("link", "")
        if not href:
            continue
        results.append(
            {
                "url": href,
                "title": clean_text(item.get("title", "")),
                "snippet": clean_text(item.get("snippet", "")),
            }
        )
    return results


def _brave_search(query: str, limit: int = 6) -> list[dict]:
    """Busca via Brave Search API (precisa de BRAVE_API_KEY no ambiente)."""
    key = os.environ.get("BRAVE_API_KEY", "").strip()
    if not key:
        return []
    try:
        response = httpx.get(
            BRAVE_ENDPOINT,
            params={
                "q": query,
                "count": min(max(int(limit), 1), 20),
                "country": "BR",
                "search_lang": "pt",
            },
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": key,
            },
            timeout=20,
        )
        if response.status_code != 200:
            _registrar_erro("brave", f"HTTP {response.status_code}: {response.text[:200]}")
            return []
        data = response.json()
    except Exception as e:
        _registrar_erro("brave", f"{type(e).__name__}: {e}")
        return []

    results = []
    for item in (data.get("web", {}) or {}).get("results", [])[:limit]:
        href = item.get("url", "")
        if not href:
            continue
        results.append(
            {
                "url": href,
                "title": clean_text(item.get("title", "")),
                "snippet": clean_text(item.get("description", "")),
            }
        )
    return results


DDG_HTML_ENDPOINT = "https://html.duckduckgo.com/html/"

# O DuckDuckGo bloqueia raspagem em rajada (algumas chamadas seguidas → 0
# resultados, e não recupera por um tempo). Como ele é o fallback gratuito,
# serializamos e espaçamos as chamadas para reduzir o auto-bloqueio.
_DDG_LOCK = threading.Lock()
_DDG_LAST = [0.0]
_DDG_MIN_INTERVALO = 2.0  # segundos entre chamadas ao DDG


def _ddg_unwrap(href: str) -> str:
    """Desembrulha o link real de um resultado do DuckDuckGo (//duckduckgo.com/l/?uddg=...)."""
    if not href:
        return ""
    if href.startswith("//"):
        href = "https:" + href
    try:
        parsed = urlparse(href)
    except Exception:
        return href
    if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
        target = parse_qs(parsed.query).get("uddg", [None])[0]
        if target:
            return unquote(target)
    return href


def _ddg_parse(html: str, limit: int) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []
    for anchor in soup.select("a.result__a")[:limit]:
        href = _ddg_unwrap(anchor.get("href", ""))
        if not href or not href.startswith("http"):
            continue
        title = anchor.get_text(" ", strip=True)
        container = anchor.find_parent(class_="result") or anchor.find_parent("div")
        snippet = ""
        if container:
            sn = container.select_one(".result__snippet")
            snippet = sn.get_text(" ", strip=True) if sn else ""
        results.append({
            "url": href,
            "title": clean_text(title),
            "snippet": clean_text(snippet),
        })
    return results


def _ddg_fetch_throttled(query: str) -> str:
    """Busca o HTML do DDG respeitando um intervalo mínimo entre chamadas."""
    with _DDG_LOCK:
        espera = _DDG_MIN_INTERVALO - (time.monotonic() - _DDG_LAST[0])
        if espera > 0:
            time.sleep(espera)
        try:
            html = _fetch_sync(DDG_HTML_ENDPOINT, {"q": query, "kl": "br-pt"})
        except Exception as e:
            _registrar_erro("duckduckgo", f"{type(e).__name__}: {e}")
            html = ""
        finally:
            _DDG_LAST[0] = time.monotonic()
    return html


def _ddg_search(query: str, limit: int = 6) -> list[dict]:
    """Busca via DuckDuckGo HTML — SEM chave de API. É o fallback gratuito usado
    quando nenhum provedor com chave (Google/Serper/Brave) está configurado ou
    quando eles falham. Garante que o "Mapear mercado" funcione de imediato.

    O DDG bloqueia raspagem em rajada, então espaçamos as chamadas e, se vier
    vazio (provável bloqueio), tentamos mais uma vez após uma pausa maior."""
    results: list[dict] = []
    for tentativa in range(2):
        html = _ddg_fetch_throttled(query)
        results = _ddg_parse(html, limit) if html else []
        if results:
            return results
        if tentativa == 0:
            time.sleep(3.0)  # provável limitação por raspagem — espera e tenta 1x
    _registrar_erro("duckduckgo", "sem resultados (provável bloqueio por raspagem)")
    return results


def _has_search_provider() -> bool:
    """Sempre há um provedor utilizável: além de Google CSE / Serper / Brave (com
    chave), existe o fallback gratuito do DuckDuckGo, que não exige configuração."""
    return True


def _provedores_keyed_validos() -> list[str]:
    """Provedores com chave configurados e que *parecem* válidos (validação
    estática barata, sem chamada de rede). Não inclui o DuckDuckGo."""
    out: list[str] = []
    gk = os.environ.get("GOOGLE_API_KEY", "").strip()
    gc = os.environ.get("GOOGLE_CSE_ID", "").strip()
    # Chave do Custom Search começa com "AIza"; o CSE ID é um token sem espaço.
    if gk and gc and gk.startswith("AIza") and " " not in gc:
        out.append("google")
    if os.environ.get("SERPER_API_KEY", "").strip():
        out.append("serper")
    if os.environ.get("BRAVE_API_KEY", "").strip():
        out.append("brave")
    return out


def _tem_provedor_keyed() -> bool:
    """True se há um provedor com chave configurado e aparentemente válido —
    ou seja, a busca NÃO depende só do fallback instável do DuckDuckGo."""
    return bool(_provedores_keyed_validos())


def diagnostico_busca() -> dict:
    """Diagnóstico do provedor de busca: o que está configurado, problemas de
    configuração detectáveis estaticamente e o último erro de cada provedor.
    Serve para a tela avisar 'busca degradada' em vez de mostrar resultado vazio
    sem explicação."""
    gk = os.environ.get("GOOGLE_API_KEY", "").strip()
    gc = os.environ.get("GOOGLE_CSE_ID", "").strip()

    problemas: list[str] = []
    if gk or gc:
        if gk and not gk.startswith("AIza"):
            problemas.append(
                "GOOGLE_API_KEY não parece uma chave do Custom Search "
                "(deve começar com 'AIza'). Talvez seja a chave do Gemini."
            )
        if gc and (" " in gc or len(gc) > 40):
            problemas.append("GOOGLE_CSE_ID parece inválido (contém espaço ou texto extra).")
        if gk and not gc:
            problemas.append("GOOGLE_CSE_ID está vazio.")
        if gc and not gk:
            problemas.append("GOOGLE_API_KEY está vazio.")

    keyed = _provedores_keyed_validos()
    if not keyed:
        problemas.append(
            "Nenhum provedor de busca com chave válido — usando o fallback "
            "gratuito do DuckDuckGo, que é instável e bloqueia buscas em sequência. "
            "Configure GOOGLE/SERPER/BRAVE para resultados confiáveis."
        )

    usando_ddg = (_PROVIDER_STATE.get("ultimo_provedor") == "duckduckgo") or (not keyed)
    return {
        "provedores_keyed": keyed,
        "tem_provedor_keyed": bool(keyed),
        "usando_fallback_ddg": usando_ddg,
        "ultimo_provedor": _PROVIDER_STATE.get("ultimo_provedor"),
        "erros": dict(_PROVIDER_STATE.get("erros") or {}),
        "problemas": problemas,
        "ok": bool(keyed) and not problemas,
    }


def aviso_busca() -> Optional[str]:
    """Mensagem para a tela quando a busca está realmente degradada — isto é,
    quando NÃO há provedor com chave válido e dependemos do DuckDuckGo. Se um
    provedor com chave funciona, não alarma (ainda que outro esteja mal
    configurado mas sem uso)."""
    diag = diagnostico_busca()
    if diag["tem_provedor_keyed"]:
        return None
    return " ".join(diag["problemas"]) if diag["problemas"] else None


def _web_search(query: str, limit: int = 6) -> list[dict]:
    """Busca na web: Google oficial (CSE) > Serper.dev > Brave (conforme as chaves)
    e, por fim, o fallback gratuito do DuckDuckGo. Se um provedor falhar ou vier
    vazio, tenta o próximo."""
    if os.environ.get("GOOGLE_API_KEY", "").strip() and os.environ.get("GOOGLE_CSE_ID", "").strip():
        results = _google_cse_search(query, limit)
        if results:
            _registrar_sucesso("google")
            return results
    if os.environ.get("SERPER_API_KEY", "").strip():
        results = _serper_search(query, limit)
        if results:
            _registrar_sucesso("serper")
            return results
    if os.environ.get("BRAVE_API_KEY", "").strip():
        results = _brave_search(query, limit)
        if results:
            _registrar_sucesso("brave")
            return results
    # Fallback gratuito, sem chave — funciona para qualquer ramo de imediato.
    results = _ddg_search(query, limit)
    if results:
        _registrar_sucesso("duckduckgo")
    return results


def _page_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(" ", strip=True)


def _extract_meta(soup: BeautifulSoup, name: str) -> Optional[str]:
    tag = soup.select_one(f'meta[property="{name}"], meta[name="{name}"]')
    return tag.get("content") if tag else None


def _extract_jsonld_candidates(soup: BeautifulSoup) -> list[dict]:
    candidates: list[dict] = []
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue

        stack = [data]
        while stack:
            current = stack.pop()
            if isinstance(current, dict):
                stack.extend(current.values())
                name = current.get("name")
                url = current.get("url")
                if not name and not url:
                    continue
                candidate = {
                    "name": name,
                    "url": url,
                    "description": current.get("description"),
                    "type": current.get("@type"),
                    "address": current.get("address"),
                    "offers": current.get("offers"),
                    "floorSize": current.get("floorSize"),
                    "numberOfBedrooms": current.get("numberOfBedrooms"),
                    "numberOfBathroomsTotal": current.get("numberOfBathroomsTotal"),
                    "numberOfRooms": current.get("numberOfRooms"),
                }
                candidates.append(candidate)
            elif isinstance(current, list):
                stack.extend(current)
    return candidates


def _infer_kind(text: str, ramo: str = RAMO_PADRAO) -> str:
    """Classifica o item conforme as palavras-chave do ramo (1ª regra que casa)."""
    hay = clean_text(text).lower()
    for tipo, keywords in ramo_busca(ramo).get("kinds", []):
        if any(clean_text(keyword).lower() in hay for keyword in keywords):
            return tipo
    return "outro"


def _extract_price(text: str) -> Optional[str]:
    match = re.search(r"R\$\s?[\d\.\s]+(?:,\d{2})?", text)
    return match.group(0).replace("  ", " ") if match else None


def _extract_number(text: str, patterns: tuple[str, ...]) -> Optional[int]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return int(re.sub(r"\D", "", match.group(1)))
            except Exception:
                continue
    return None


def _extract_area_m2(text: str) -> Optional[int]:
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*m²", text, re.IGNORECASE)
    if not match:
        return None
    return int(float(match.group(1).replace(",", ".")))


def _extract_address(text: str, area: str) -> Optional[str]:
    area_norm = clean_text(area).lower()
    match = re.search(
        r"(Rua|R\.|Avenida|Av\.|Alameda|Praça|Pca\.|Travessa)\s+[A-Za-zÀ-ÿ0-9\s\.\-]+(?:,\s*\d+[^\.]*)?",
        text,
        re.IGNORECASE,
    )
    if match:
        return match.group(0).strip(" ,.;")
    if area_norm and area_norm in clean_text(text).lower():
        return area
    return None


def _pick_best_name(title: str, h1: str, candidates: list[dict], ramo: str = RAMO_PADRAO) -> str:
    for value in (h1, title):
        if value and len(value.strip()) > 3:
            return value.strip()
    for candidate in candidates:
        name = candidate.get("name")
        if name and len(str(name).strip()) > 3:
            return str(name).strip()
    return ramo_busca(ramo).get("default_name", "Item")


def _canonical_url(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme:
        return url
    cleaned = parsed._replace(fragment="").geturl()
    return cleaned.rstrip("/")


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _looks_blocked(url: str) -> bool:
    domain = _domain(url)
    return any(blocked in domain for blocked in BLACKLIST_DOMAINS)


def _item_signature(item: dict) -> str:
    return "|".join(
        [
            clean_text(item.get("nome", "")).lower(),
            clean_text(item.get("tipo", "")).lower(),
            clean_text(item.get("endereco", "")).lower(),
            clean_text(item.get("bairro", "")).lower(),
            clean_text(item.get("url", "")).lower(),
        ]
    )


def _item_score(item: dict) -> int:
    fields = [
        "nome",
        "tipo",
        "endereco",
        "bairro",
        "municipio",
        "url",
        "fonte",
    ]
    filled = sum(1 for field in fields if item.get(field))
    bonus = 6 if item.get("empresa_id") else 0
    bonus += 4 if item.get("valor_venda") or item.get("valor_locacao") else 0
    bonus += 4 if item.get("dormitorios") or item.get("area_privativa") else 0
    return max(0, min(100, int((filled / len(fields)) * 80) + bonus))


def _page_candidates_from_html(html: str, url: str, query: str, empresa: Optional[dict], area: str, ramo: str = RAMO_PADRAO) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    title = _extract_meta(soup, "og:title") or (soup.title.get_text(" ", strip=True) if soup.title else "")
    description = _extract_meta(soup, "description") or _extract_meta(soup, "og:description")
    h1 = soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else ""
    jsonld_candidates = _extract_jsonld_candidates(soup)
    listing_hints = tuple(ramo_busca(ramo).get("listing_hints", ()))
    items: list[dict] = []

    def build_item(name: str, source_url: str, extra: Optional[dict] = None) -> dict:
        combined = " ".join([name or "", title or "", h1 or "", description or "", text[:3500]])
        item = {
            "empresa_id": empresa.get("id") if empresa else None,
            "empresa_nome": empresa.get("nome") if empresa else None,
            "area": area,
            "tipo": _infer_kind(combined, ramo),
            "nome": name or _pick_best_name(title, h1, jsonld_candidates, ramo),
            "subtitulo": description or "",
            "bairro": _extract_address(combined, area),
            "municipio": "São Paulo" if "são paulo" in clean_text(combined).lower() or "sp" in clean_text(area).lower() else None,
            "uf": "SP",
            "endereco": _extract_address(combined, area),
            "valor_venda": None,
            "valor_locacao": None,
            "dormitorios": _extract_number(combined, (r"(\d+)\s*dorm", r"(\d+)\s*quartos?")),
            "suites": _extract_number(combined, (r"(\d+)\s*sui", r"(\d+)\s*suí")),
            "vagas": _extract_number(combined, (r"(\d+)\s*vagas?",)),
            "area_privativa": _extract_area_m2(combined),
            "status": "capturado",
            "empreendimento": name if _infer_kind(combined, ramo) == "empreendimento" else None,
            "url": _canonical_url(source_url),
            "fonte": _domain(source_url) or source_url,
            "dados": {
                "query": query,
                "title": title,
                "h1": h1,
                "description": description,
                "snippet": combined[:1200],
            },
        }
        if extra:
            item["dados"].update(extra)

        price = _extract_price(combined)
        if price:
            item["dados"]["preco_texto"] = price
            if "loca" in clean_text(combined).lower():
                item["valor_locacao"] = price
            else:
                item["valor_venda"] = price

        if isinstance(extra, dict):
            offers = extra.get("offers") or {}
            if isinstance(offers, dict):
                price_value = offers.get("price")
                if price_value:
                    item["dados"]["offer_price"] = price_value

        item["score"] = _item_score(item)
        return item

    # JSON-LD candidates first
    seen = set()
    for candidate in jsonld_candidates:
        name = candidate.get("name")
        if not name:
            continue
        sig = clean_text(str(name)).lower()
        if sig in seen:
            continue
        seen.add(sig)
        items.append(build_item(str(name), candidate.get("url") or url, candidate))
        if len(items) >= 5:
            break

    if not items and any(keyword in clean_text(text).lower() for keyword in listing_hints):
        items.append(build_item(_pick_best_name(title, h1, jsonld_candidates, ramo), url))

    return items


def _normalize_company_tokens(company_name: str, ramo: str = RAMO_PADRAO) -> list[str]:
    normalized = _strip_accents(company_name).lower()
    parts = re.split(r"[^a-z0-9]+", normalized)
    stopwords = {_strip_accents(w).lower() for w in ramo_stopwords(ramo)}
    return [part for part in parts if part and part not in stopwords]


def _guess_company_domains(company_name: str, ramo: str = RAMO_PADRAO) -> list[str]:
    tokens = _normalize_company_tokens(company_name, ramo)
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


def _candidate_internal_links(html: str, base_url: str, ramo: str = RAMO_PADRAO) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    keywords = tuple(ramo_busca(ramo).get("crawl_keywords", ()))
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


def _candidate_sitemap_links(base_url: str, limit: int = 25, ramo: str = RAMO_PADRAO) -> list[str]:
    sitemap_urls = [
        urljoin(base_url, "/sitemap.xml"),
        urljoin(base_url, "/sitemap_index.xml"),
    ]
    keywords = tuple(ramo_busca(ramo).get("crawl_keywords", ()))
    results = []
    seen = set()

    for sitemap_url in sitemap_urls:
        try:
            xml = _fetch_sync(sitemap_url)
        except Exception:
            continue
        for loc in re.findall(r"<loc>(.*?)</loc>", xml, flags=re.IGNORECASE):
            loc = loc.strip()
            if not loc.startswith("http"):
                continue
            if urlparse(loc).netloc != urlparse(base_url).netloc:
                continue
            haystack = loc.lower()
            if not any(keyword in haystack for keyword in keywords):
                continue
            if loc in seen:
                continue
            seen.add(loc)
            results.append(loc)
            if len(results) >= limit:
                return results
    return results


def _discover_official_site(company_name: str, website: Optional[str] = None, ramo: str = RAMO_PADRAO) -> Optional[str]:
    candidates = []
    if website and website.startswith("http"):
        candidates.append(website.rstrip("/"))

    for slug in _guess_company_domains(company_name, ramo):
        for template in ("https://{slug}.com.br/", "https://www.{slug}.com.br/", "https://{slug}.com/"):
            candidates.append(template.format(slug=slug))

    busca = ramo_busca(ramo)
    crawl_keywords = tuple(busca.get("crawl_keywords", ()))
    blocklist = tuple(busca.get("blocklist", ()))
    company_tokens = _normalize_company_tokens(company_name, ramo)
    for url in candidates:
        try:
            html = _fetch_sync(url)
        except Exception:
            continue

        text = clean_text(BeautifulSoup(html, "html.parser").get_text(" ", strip=True)).lower()
        title = BeautifulSoup(html, "html.parser").title.get_text(" ", strip=True) if BeautifulSoup(html, "html.parser").title else ""
        if company_tokens and any(token in text for token in company_tokens[:2]):
            return url
        if company_tokens and any(token in clean_text(title).lower() for token in company_tokens[:2]):
            return url
        if any(keyword in text for keyword in crawl_keywords):
            return url

    # Fallback: descobre o site oficial via busca na web
    if not _has_search_provider():
        return None
    for hit in _web_search(f"{company_name} site oficial", limit=5):
        url = hit.get("url", "")
        if not url or _looks_blocked(url):
            continue
        host = _domain(url).lower()
        if blocklist and any(host.endswith(s) or s in host for s in blocklist):
            continue  # portais de classificados nao sao o site da empresa
        if company_tokens and any(token in host.replace("-", "") for token in company_tokens[:2]):
            return f"https://{host}"

    return None


def _crawl_site_for_items(base_url: str, company: dict, area: str, include_area_listings: bool, ramo: str = RAMO_PADRAO) -> list[dict]:
    pages = [base_url]
    try:
        home_html = _fetch_sync(base_url)
    except Exception:
        return []

    pages.extend(_candidate_internal_links(home_html, base_url, ramo)[:12])
    pages.extend(_candidate_sitemap_links(base_url, limit=20, ramo=ramo))

    guessed_paths = ramo_busca(ramo).get("paths", [])
    pages.extend(urljoin(base_url, path) for path in guessed_paths)

    if include_area_listings:
        pages.extend(urljoin(base_url, path) for path in ["/home", "/catalogo", "/projetos"])

    seen_pages = set()
    items: list[dict] = []
    for page_url in pages:
        page_url = _canonical_url(page_url)
        if page_url in seen_pages:
            continue
        seen_pages.add(page_url)
        try:
            html = _fetch_sync(page_url)
        except Exception:
            continue
        candidates = _page_candidates_from_html(html, page_url, page_url, company, area, ramo)
        for item in candidates:
            item["source_url"] = page_url
            item["source_query"] = page_url
            items.append(item)
    return items


def _area_terms(area: str) -> list[str]:
    terms = [t.strip() for t in re.split(r"[\/,]+", area or "") if t.strip()]
    return terms or ([area.strip()] if (area or "").strip() else [])


def _build_area_queries(companies: list[dict], area: str, ramo: str = RAMO_PADRAO, cidade: str = "São Paulo") -> list[str]:
    """Monta as buscas p/ descobrir as EMPRESAS do ramo na área (não os itens)."""
    terms = _area_terms(area)
    templates = ramo_busca(ramo).get("termos_area", [])
    queries: list[str] = []
    for term in terms:
        for template in templates:
            queries.append(template.format(term=term, cidade=cidade))
    # dedup preservando a ordem
    visto = set()
    out = []
    for q in queries:
        q = q.strip()
        if q and q not in visto:
            visto.add(q)
            out.append(q)
    return out


def _candidate_from_search_hit(hit: dict, area: str, query: str = "", ramo: str = RAMO_PADRAO, cidade: str = "São Paulo") -> Optional[dict]:
    """Cria um item leve direto do resultado de busca (quando a página não abre/parseia)."""
    url = hit.get("url", "")
    title = clean_text(hit.get("title", ""))
    snippet = clean_text(hit.get("snippet", ""))
    if not url or not title:
        return None
    text = f"{title} {snippet}"
    cidade_norm = clean_text(cidade).lower()
    item = {
        "empresa_id": None,
        "area": area,
        "tipo": _infer_kind(text, ramo),
        "nome": title[:255],
        "subtitulo": snippet[:255] or None,
        "bairro": None,
        "municipio": cidade if cidade_norm and cidade_norm in text.lower() else None,
        "uf": "SP",
        "endereco": _extract_address(text, area),
        "valor_venda": _extract_price(text),
        "valor_locacao": None,
        "dormitorios": _extract_number(text, (r"(\d+)\s*dorm", r"(\d+)\s*quartos?")),
        "suites": _extract_number(text, (r"(\d+)\s*sui", r"(\d+)\s*suí")),
        "vagas": _extract_number(text, (r"(\d+)\s*vagas?",)),
        "area_privativa": _extract_area_m2(text),
        "status": "capturado",
        "empreendimento": title[:255] if _infer_kind(text, ramo) == "empreendimento" else None,
        "url": _canonical_url(url),
        "fonte": _domain(url) or url,
        "dados": {"title": title, "snippet": snippet, "query": query},
    }
    item["score"] = _item_score(item)
    return item


def scan_market_sync(
    companies: list[dict],
    area: str,
    include_company_projects: bool = True,
    include_area_listings: bool = True,
    limit: int = 60,
    ramo: str = RAMO_PADRAO,
    cidade: str = "São Paulo",
) -> dict:
    saved_items: list[dict] = []
    seen = set()
    discovered_domains = Counter()

    def _consume(items: list[dict]) -> bool:
        """Adiciona itens (dedup) e devolve True quando atingiu o limite."""
        for item in items:
            sig = _item_signature(item)
            if sig in seen:
                continue
            seen.add(sig)
            item.setdefault("score", _item_score(item))
            saved_items.append(item)
            if len(saved_items) >= limit:
                return True
        return False

    # 1) Rastreia os sites das construtoras (oficial/descoberto)
    if include_company_projects:
        for company in companies:
            if len(saved_items) >= limit:
                break
            site = company.get("website") or _discover_official_site(company.get("nome", ""), ramo=ramo)
            if not site:
                continue
            if not site.startswith("http"):
                site = f"https://{site}"
            discovered_domains[_domain(site)] += 1
            if _consume(_crawl_site_for_items(site, company, area, include_area_listings, ramo)):
                break

    # 2) Busca na web por anúncios/itens da área do ramo
    if include_area_listings and len(saved_items) < limit and _has_search_provider():
        for query in _build_area_queries(companies, area, ramo, cidade):
            if len(saved_items) >= limit:
                break
            for hit in _web_search(query, limit=6):
                if len(saved_items) >= limit:
                    break
                url = hit.get("url", "")
                if not url or _looks_blocked(url):
                    continue
                discovered_domains[_domain(url)] += 1
                candidates: list[dict] = []
                try:
                    html = _fetch_sync(url)
                    candidates = _page_candidates_from_html(html, url, query, None, area, ramo)
                    for it in candidates:
                        it["source_url"] = url
                        it["source_query"] = query
                except Exception:
                    candidates = []
                if not candidates:
                    light = _candidate_from_search_hit(hit, area, query, ramo, cidade)
                    if light:
                        candidates = [light]
                if _consume(candidates):
                    break

    summary = Counter([item.get("tipo", "outro") for item in saved_items])
    return {
        "items": saved_items,
        "summary": dict(summary),
        "sources": dict(discovered_domains),
        "total": len(saved_items),
    }


async def scan_market(
    companies: list[dict],
    area: str,
    include_company_projects: bool = True,
    include_area_listings: bool = True,
    limit: int = 60,
    ramo: str = RAMO_PADRAO,
    cidade: str = "São Paulo",
) -> dict:
    return await asyncio.to_thread(
        scan_market_sync,
        companies,
        area,
        include_company_projects,
        include_area_listings,
        limit,
        ramo,
        cidade,
    )


async def list_area_streets(area: str, limit: int = 40) -> list[dict]:
    return await asyncio.to_thread(list_area_streets_sync, area, limit)


async def scan_market_by_streets(
    area: str,
    streets: Optional[list[str]] = None,
    streets_limit: int = 40,
    hits_per_street: int = 4,
    limit: int = 120,
    ramo: str = RAMO_PADRAO,
    cidade: str = "São Paulo",
) -> dict:
    return await asyncio.to_thread(
        scan_market_by_streets_sync,
        area,
        streets,
        streets_limit,
        hits_per_street,
        limit,
        ramo,
        cidade,
    )
