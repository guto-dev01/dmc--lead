"""Integração com o Hunter.io para achar e-mails de decisores.

Duas chamadas úteis para prospecção:
- Email Finder: dado o domínio da empresa + nome/sobrenome da pessoa, devolve o
  e-mail mais provável (com score de confiança).
- Domain Search: lista os e-mails públicos de um domínio (com nome e cargo),
  útil para descobrir gente nova na empresa.

A chave fica em HUNTER_API_KEY (variável de ambiente). Sem a chave, tudo aqui
retorna vazio — o restante do app continua funcionando.
"""
import os
import re
from urllib.parse import urlparse

import httpx

EMAIL_FINDER = "https://api.hunter.io/v2/email-finder"
DOMAIN_SEARCH = "https://api.hunter.io/v2/domain-search"

# Domínios genéricos não servem para o Hunter (precisa do domínio corporativo)
_DOMINIOS_GENERICOS = {
    "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
    "live.com", "icloud.com", "bol.com.br", "uol.com.br", "terra.com.br",
}


def hunter_ativo() -> bool:
    return bool(os.environ.get("HUNTER_API_KEY", "").strip())


def _key() -> str:
    return os.environ.get("HUNTER_API_KEY", "").strip()


def dominio_de(valor: str) -> str:
    """Extrai o domínio corporativo de uma URL, e-mail ou texto solto."""
    if not valor:
        return ""
    v = valor.strip().lower()
    if "@" in v and " " not in v:  # parece e-mail
        v = v.split("@", 1)[1]
    if "://" not in v:
        v = "http://" + v
    host = urlparse(v).netloc or ""
    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    if not re.match(r"^[a-z0-9.\-]+\.[a-z]{2,}$", host):
        return ""
    if host in _DOMINIOS_GENERICOS:
        return ""
    return host


def _split_nome(nome: str) -> tuple[str, str]:
    partes = [p for p in re.split(r"\s+", (nome or "").strip()) if p]
    if not partes:
        return "", ""
    if len(partes) == 1:
        return partes[0], ""
    return partes[0], partes[-1]


def hunter_email_finder(domain: str, nome: str) -> list[dict]:
    """Acha o e-mail mais provável de UMA pessoa na empresa."""
    key = _key()
    if not key or not domain:
        return []
    first, last = _split_nome(nome)
    if not first:
        return []
    try:
        resp = httpx.get(
            EMAIL_FINDER,
            params={"domain": domain, "first_name": first, "last_name": last,
                    "api_key": key},
            timeout=20,
        )
        if resp.status_code != 200:
            return []
        data = (resp.json() or {}).get("data") or {}
    except Exception:
        return []
    email = (data.get("email") or "").strip()
    if not email:
        return []
    return [{
        "email": email,
        "score": data.get("score"),
        "nome": " ".join(x for x in (data.get("first_name"), data.get("last_name")) if x) or nome,
        "cargo": data.get("position"),
        "fonte": "Hunter.io (email-finder)",
    }]


def hunter_domain_search(domain: str, limit: int = 10) -> list[dict]:
    """Lista e-mails públicos de um domínio (nome + cargo quando há)."""
    key = _key()
    if not key or not domain:
        return []
    try:
        resp = httpx.get(
            DOMAIN_SEARCH,
            params={"domain": domain, "limit": min(max(int(limit), 1), 25),
                    "api_key": key},
            timeout=20,
        )
        if resp.status_code != 200:
            return []
        data = (resp.json() or {}).get("data") or {}
    except Exception:
        return []
    out = []
    for e in (data.get("emails") or []):
        val = (e.get("value") or "").strip()
        if not val:
            continue
        nome = " ".join(x for x in (e.get("first_name"), e.get("last_name")) if x)
        out.append({
            "email": val,
            "score": e.get("confidence"),
            "nome": nome or None,
            "cargo": e.get("position"),
            "tipo": e.get("type"),  # personal | generic
            "fonte": "Hunter.io (domain-search)",
        })
    return out
