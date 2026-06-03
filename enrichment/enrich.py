#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
enrich.py — Enriquecimento de base de dados via Apollo.io.

Lê uma base (CSV / XLSX / JSON), enriquece cada registro com a API da Apollo.io
(People Match / Bulk Match) e grava um novo arquivo com sufixo "_enriched",
adicionando colunas apollo_*. Suporta retomada, rate limiting, modo bulk e dry-run.

Uso:
    python enrich.py --file minha_base.csv
    python enrich.py --file minha_base.xlsx --batch     # modo bulk (10 por vez)
    python enrich.py --file minha_base.csv --dry-run     # não consome créditos

Segurança: a API key é lida de APOLLO_API_KEY (variável de ambiente). Caso não
exista, usa o valor padrão embutido abaixo. Recomenda-se:
    export APOLLO_API_KEY="sua-chave"
"""

import os
import sys
import json
import time
import argparse
import logging
import subprocess
from pathlib import Path

# ---------------------------------------------------------------------------
# 0) Instalação automática de dependências
#    Se faltar algum pacote, instala via pip e reimporta. Mantém o script
#    "rodável" mesmo num ambiente limpo (Python 3.8+).
# ---------------------------------------------------------------------------

REQUIRED_PACKAGES = {
    # nome_para_import: nome_para_pip
    "pandas": "pandas",
    "requests": "requests",
    "tqdm": "tqdm",
    "openpyxl": "openpyxl",  # necessário para ler/gravar .xlsx
}


def _ensure_dependencies():
    """Garante que todas as libs necessárias estão instaladas."""
    missing = []
    for import_name, pip_name in REQUIRED_PACKAGES.items():
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pip_name)

    if missing:
        print(f"[setup] Instalando dependências faltantes: {', '.join(missing)}")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--quiet", *missing]
        )
        print("[setup] Dependências instaladas.")


_ensure_dependencies()

# Imports que dependem da instalação acima
import pandas as pd          # noqa: E402
import requests              # noqa: E402
from tqdm import tqdm        # noqa: E402

# ---------------------------------------------------------------------------
# 1) Configuração da API
# ---------------------------------------------------------------------------

# --- Apollo.io ---
# Lê a chave do ambiente; cai no valor embutido se não houver.
APOLLO_API_KEY = os.environ.get("APOLLO_API_KEY", "gJcssYSRNqwx2Dle-o8DUA")
BASE_URL = "https://api.apollo.io/api/v1"

# Apollo.io autentica via header X-Api-Key (NÃO Bearer). Mantemos os dois
# possíveis cabeçalhos comentados para referência; usamos o que funciona.
HEADERS = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": APOLLO_API_KEY,
}

MATCH_URL = f"{BASE_URL}/people/match"
BULK_MATCH_URL = f"{BASE_URL}/people/bulk_match"

# --- GeckoAPI (casadosdados.com.br) — enriquecimento por CNPJ ---
# Autentica via Bearer token. Lê o token de GECKO_API_KEY no ambiente.
GECKO_API_KEY = os.environ.get("GECKO_API_KEY", "YOUR_TOKEN")
GECKO_URL = "https://api.geckoapi.com.br/v1/extract"
GECKO_TARGET = "casadosdados.com.br"
GECKO_TYPE = "pdp"

GECKO_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {GECKO_API_KEY}",
}

# Parâmetros de rate limiting / retentativas
SLEEP_BETWEEN_CALLS = 1.0     # segundos entre chamadas individuais
RATE_LIMIT_SLEEP = 60.0       # segundos a aguardar em caso de 429
MAX_RETRIES = 3               # tentativas por registro
BULK_SIZE = 10                # tamanho do lote no modo --batch

# ---------------------------------------------------------------------------
# 2) Logging — erros vão para arquivo; progresso vai para o console (tqdm).
# ---------------------------------------------------------------------------

logging.basicConfig(
    filename="enrichment_errors.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    encoding="utf-8",
)
log = logging.getLogger("apollo-enrich")

# Colunas que o script adiciona à base (fonte Apollo).
APOLLO_COLUMNS = [
    "apollo_email",
    "apollo_phone",
    "apollo_title",
    "apollo_company",
    "apollo_linkedin",
    "apollo_city",
    "apollo_country",
    "apollo_enriched",
]

# Colunas adicionadas pela fonte GeckoAPI (dados de CNPJ).
GECKO_COLUMNS = [
    "gecko_razao_social",
    "gecko_nome_fantasia",
    "gecko_email",
    "gecko_phone",
    "gecko_city",
    "gecko_uf",
    "gecko_situacao",
    "gecko_enriched",
]

# ---------------------------------------------------------------------------
# 3) Mapeamento inteligente de colunas
#    Não assumimos nomes fixos: detectamos por sinônimos, ignorando
#    maiúsculas/minúsculas, espaços, hífens e underscores.
# ---------------------------------------------------------------------------

# Para cada campo lógico, lista de possíveis nomes na base de origem.
COLUMN_SYNONYMS = {
    "first_name": ["first_name", "firstname", "first", "nome", "primeiro_nome", "given_name"],
    "last_name": ["last_name", "lastname", "last", "sobrenome", "surname", "family_name"],
    "full_name": ["full_name", "fullname", "name", "nome_completo", "contato", "pessoa"],
    "email": ["email", "e-mail", "emailaddress", "email_address", "mail", "correio"],
    "domain": ["domain", "dominio", "website", "site", "url", "web"],
    "organization_name": [
        "organization_name", "organization", "company", "company_name",
        "empresa", "razao_social", "razaosocial", "organizacao", "compania",
    ],
    "linkedin_url": [
        "linkedin_url", "linkedin", "linkedinurl", "linkedin_profile",
        "perfil_linkedin", "url_linkedin",
    ],
    "title": ["title", "cargo", "job_title", "jobtitle", "posicao", "funcao"],
    "cnpj": ["cnpj", "cnpj_empresa", "cnpjempresa", "documento", "doc", "ein"],
}


def _normalize(name: str) -> str:
    """Normaliza um nome de coluna para comparação (lower, sem separadores)."""
    return (
        str(name)
        .strip()
        .lower()
        .replace(" ", "")
        .replace("-", "")
        .replace("_", "")
        .replace(".", "")
    )


def build_column_map(df_columns) -> dict:
    """
    Constrói {campo_logico: nome_real_na_base} detectando colunas existentes.
    Ex.: se a base tem 'E-mail', mapeia email -> 'E-mail'.
    """
    # Índice: nome_normalizado -> nome_original
    normalized_to_real = {_normalize(c): c for c in df_columns}

    mapping = {}
    for logical, synonyms in COLUMN_SYNONYMS.items():
        for syn in synonyms:
            key = _normalize(syn)
            if key in normalized_to_real:
                mapping[logical] = normalized_to_real[key]
                break  # usa o primeiro sinônimo encontrado
    return mapping


# ---------------------------------------------------------------------------
# 4) Leitura / escrita de arquivos (CSV, XLSX, JSON detectados pela extensão)
# ---------------------------------------------------------------------------

def load_dataframe(path: Path) -> pd.DataFrame:
    """Carrega a base detectando o formato pela extensão do arquivo."""
    ext = path.suffix.lower()
    if ext == ".csv":
        return pd.read_csv(path)
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(path)  # usa openpyxl para .xlsx
    if ext == ".json":
        # Aceita tanto lista de objetos quanto JSON "records".
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            # Se for um dict com uma chave de lista, tenta achar a lista.
            for v in data.values():
                if isinstance(v, list):
                    data = v
                    break
        return pd.DataFrame(data)
    raise ValueError(f"Formato não suportado: {ext} (use .csv, .xlsx ou .json)")


def save_dataframe(df: pd.DataFrame, path: Path) -> None:
    """Grava a base no mesmo formato do arquivo de saída."""
    ext = path.suffix.lower()
    if ext == ".csv":
        df.to_csv(path, index=False)
    elif ext in (".xlsx", ".xls"):
        df.to_excel(path, index=False)
    elif ext == ".json":
        df.to_json(path, orient="records", force_ascii=False, indent=2)
    else:
        raise ValueError(f"Formato não suportado para saída: {ext}")


def output_path_for(path: Path) -> Path:
    """base.csv -> base_enriched.csv"""
    return path.with_name(f"{path.stem}_enriched{path.suffix}")


# ---------------------------------------------------------------------------
# 5) Montagem do payload de um registro para a Apollo
# ---------------------------------------------------------------------------

def _val(row, col_map, logical):
    """Retorna o valor (string limpa) de um campo lógico, ou None."""
    real = col_map.get(logical)
    if not real:
        return None
    v = row.get(real)
    if v is None:
        return None
    # pandas usa NaN para vazio; trata isso.
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    return s or None


def build_person_payload(row, col_map) -> dict:
    """
    Monta o dict de match para um registro, usando só os campos disponíveis.
    Se houver full_name mas não first/last, tenta dividir.
    """
    payload = {}

    first = _val(row, col_map, "first_name")
    last = _val(row, col_map, "last_name")

    # Se não há first/last separados mas há nome completo, divide.
    if not (first or last):
        full = _val(row, col_map, "full_name")
        if full:
            parts = full.split()
            if len(parts) >= 2:
                first, last = parts[0], " ".join(parts[1:])
            elif len(parts) == 1:
                first = parts[0]

    if first:
        payload["first_name"] = first
    if last:
        payload["last_name"] = last

    domain = _val(row, col_map, "domain")
    org = _val(row, col_map, "organization_name")
    if domain:
        # Limpa http(s):// e barras se vier uma URL completa.
        domain = domain.replace("https://", "").replace("http://", "").strip("/")
        payload["domain"] = domain
    if org:
        payload["organization_name"] = org

    email = _val(row, col_map, "email")
    if email:
        payload["email"] = email

    linkedin = _val(row, col_map, "linkedin_url")
    if linkedin:
        payload["linkedin_url"] = linkedin

    return payload


# ---------------------------------------------------------------------------
# 6) Extração das colunas apollo_* a partir da resposta da API
# ---------------------------------------------------------------------------

def parse_person(person: dict) -> dict:
    """
    Converte o objeto 'person' da Apollo nas colunas apollo_*.
    Cobre variações de onde a Apollo coloca telefone / cidade.
    """
    if not person:
        return _empty_result(enriched=False)

    # E-mail: pode vir em 'email' ou na lista de personal_emails.
    email = person.get("email")
    if not email:
        pes = person.get("personal_emails") or []
        if pes:
            email = pes[0]

    # Telefone: a Apollo pode devolver em vários campos.
    phone = person.get("phone_number") or person.get("sanitized_phone")
    if not phone:
        phones = person.get("phone_numbers") or []
        if phones and isinstance(phones[0], dict):
            phone = phones[0].get("sanitized_number") or phones[0].get("raw_number")

    # Empresa: organização atual.
    org = person.get("organization") or {}
    company = org.get("name") or person.get("organization_name")

    # Localização.
    city = person.get("city")
    country = person.get("country")

    return {
        "apollo_email": email,
        "apollo_phone": phone,
        "apollo_title": person.get("title"),
        "apollo_company": company,
        "apollo_linkedin": person.get("linkedin_url"),
        "apollo_city": city,
        "apollo_country": country,
        "apollo_enriched": True,
    }


def _empty_result(enriched=False) -> dict:
    """Resultado vazio (no_match / erro)."""
    res = {c: None for c in APOLLO_COLUMNS}
    res["apollo_enriched"] = enriched
    return res


# ---------------------------------------------------------------------------
# 7) Chamadas à API com retentativas e rate limiting
# ---------------------------------------------------------------------------

def _request_with_retries(url: str, payload: dict, headers: dict = None):
    """
    Faz POST com até MAX_RETRIES tentativas.
    - 429: aguarda RATE_LIMIT_SLEEP e tenta de novo.
    - erro de rede: tenta de novo.
    Retorna o JSON da resposta ou None se falhar todas as tentativas.
    """
    headers = headers or HEADERS
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=30)

            if resp.status_code == 429:
                log.warning(
                    "429 rate limit (tentativa %d/%d). Aguardando %ds...",
                    attempt, MAX_RETRIES, RATE_LIMIT_SLEEP,
                )
                time.sleep(RATE_LIMIT_SLEEP)
                continue

            if resp.status_code in (401, 403):
                # Erro de autenticação: não adianta repetir.
                log.error("Auth falhou (%d): %s", resp.status_code, resp.text[:300])
                return None

            resp.raise_for_status()
            return resp.json()

        except requests.exceptions.RequestException as e:
            log.warning("Erro de rede (tentativa %d/%d): %s", attempt, MAX_RETRIES, e)
            time.sleep(2 * attempt)  # backoff simples
        except ValueError as e:
            # JSON inválido
            log.error("Resposta não-JSON: %s", e)
            return None

    log.error("Falhou após %d tentativas: payload=%s", MAX_RETRIES, payload)
    return None


def enrich_single(payload: dict) -> dict:
    """Enriquece um único registro via /people/match."""
    body = dict(payload)
    body["reveal_personal_emails"] = True
    body["reveal_phone_number"] = True

    data = _request_with_retries(MATCH_URL, body)
    if not data:
        return _empty_result(enriched=False)

    person = data.get("person")
    if not person:
        # no_match
        return _empty_result(enriched=False)
    return parse_person(person)


def enrich_bulk(payloads: list) -> list:
    """
    Enriquece um lote (até BULK_SIZE) via /people/bulk_match.
    Retorna lista de resultados na mesma ordem dos payloads.
    """
    body = {
        "details": payloads,
        "reveal_personal_emails": True,
        "reveal_phone_number": True,
    }

    data = _request_with_retries(BULK_MATCH_URL, body)
    if not data:
        return [_empty_result(enriched=False) for _ in payloads]

    # A Apollo devolve 'matches' (lista) na mesma ordem dos 'details'.
    matches = data.get("matches")
    if matches is None:
        matches = data.get("people", [])

    results = []
    for i in range(len(payloads)):
        person = matches[i] if i < len(matches) else None
        if person:
            results.append(parse_person(person))
        else:
            results.append(_empty_result(enriched=False))
    return results


# ---------------------------------------------------------------------------
# 7b) GeckoAPI — enriquecimento por CNPJ (casadosdados.com.br)
# ---------------------------------------------------------------------------

def _clean_cnpj(value) -> str:
    """Remove tudo que não é dígito de um CNPJ."""
    if value is None:
        return ""
    return "".join(ch for ch in str(value) if ch.isdigit())


def _deep_find(obj, candidate_keys):
    """
    Procura recursivamente (em dicts/listas) o primeiro valor escalar não-vazio
    cuja chave bata com algum nome em candidate_keys (comparação normalizada).
    A estrutura exata da resposta da Gecko/casadosdados pode variar, então
    fazemos uma busca tolerante em vez de assumir um caminho fixo.
    """
    targets = {_normalize(k) for k in candidate_keys}

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if _normalize(k) in targets and isinstance(v, (str, int, float)):
                    s = str(v).strip()
                    if s and s.lower() not in ("none", "null", "nan"):
                        return s
            for v in node.values():
                found = walk(v)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = walk(item)
                if found:
                    return found
        return None

    return walk(obj)


def _empty_gecko(enriched=False) -> dict:
    """Resultado vazio da Gecko (no_match / erro)."""
    res = {c: None for c in GECKO_COLUMNS}
    res["gecko_enriched"] = enriched
    return res


def parse_gecko(data: dict) -> dict:
    """Extrai as colunas gecko_* da resposta, de forma tolerante a variações."""
    if not data:
        return _empty_gecko(False)

    razao = _deep_find(data, ["razao_social", "razaosocial", "nome_empresarial", "nome", "name"])
    fantasia = _deep_find(data, ["nome_fantasia", "fantasia", "trade_name"])
    email = _deep_find(data, ["email", "e_mail", "correio"])
    phone = _deep_find(data, ["telefone", "phone", "telefone1", "ddd_telefone_1", "fone"])
    city = _deep_find(data, ["municipio", "cidade", "city"])
    uf = _deep_find(data, ["uf", "estado", "state"])
    situacao = _deep_find(data, ["situacao_cadastral", "descricao_situacao_cadastral", "situacao", "status"])

    # Considera enriquecido se achamos ao menos um campo útil.
    enriched = any([razao, fantasia, email, phone, city, uf, situacao])

    return {
        "gecko_razao_social": razao,
        "gecko_nome_fantasia": fantasia,
        "gecko_email": email,
        "gecko_phone": phone,
        "gecko_city": city,
        "gecko_uf": uf,
        "gecko_situacao": situacao,
        "gecko_enriched": enriched,
    }


def enrich_gecko(cnpj: str) -> dict:
    """Enriquece um registro por CNPJ via GeckoAPI (/v1/extract)."""
    cnpj = _clean_cnpj(cnpj)
    if not cnpj:
        return _empty_gecko(False)

    body = {
        "target": GECKO_TARGET,
        "type": GECKO_TYPE,
        "cnpj": cnpj,
    }
    data = _request_with_retries(GECKO_URL, body, headers=GECKO_HEADERS)
    if not data:
        return _empty_gecko(False)
    return parse_gecko(data)


# ---------------------------------------------------------------------------
# 8) Retomada — garante colunas apollo_* e identifica o que já foi processado.
# ---------------------------------------------------------------------------

def prepare_resume(df: pd.DataFrame) -> pd.DataFrame:
    """
    Garante que as colunas de saída (Apollo + Gecko) existam no DataFrame de
    trabalho. O arquivo _enriched é a fonte de verdade para retomar.
    """
    for col in APOLLO_COLUMNS + GECKO_COLUMNS:
        if col not in df.columns:
            df[col] = None
    return df


def _flag_done(row, flag_col) -> bool:
    """True quando a coluna-flag já tem valor (True/False), não nulo."""
    v = row.get(flag_col)
    if v is None:
        return False
    if isinstance(v, float) and pd.isna(v):
        return False
    # Aceita bool real ou strings "True"/"False" vindas de CSV.
    return str(v).strip().lower() in ("true", "false")


def already_done(row, flag_col="apollo_enriched") -> bool:
    """Considera processado quando a flag da fonte já está preenchida."""
    return _flag_done(row, flag_col)


# ---------------------------------------------------------------------------
# 9) Loop principal
# ---------------------------------------------------------------------------

def run(file_path: str, batch: bool, dry_run: bool, source: str):
    src = Path(file_path)
    if not src.exists():
        print(f"[erro] Arquivo não encontrado: {src}")
        sys.exit(1)

    out = output_path_for(src)

    # Retomada: se já houver um _enriched parcial, continuamos a partir dele.
    if out.exists():
        print(f"[resume] Encontrado arquivo parcial: {out.name} — retomando.")
        df = load_dataframe(out)
    else:
        df = load_dataframe(src)

    df = prepare_resume(df)

    # Mapeia colunas reais da base para campos lógicos.
    col_map = build_column_map(df.columns)
    print(f"[mapa] Colunas detectadas: {col_map or 'NENHUMA — verifique a base!'}")
    if not col_map:
        print("[erro] Nenhuma coluna reconhecível (nome, email, empresa, cnpj...). Abortando.")
        sys.exit(1)

    # Quais fontes rodar.
    use_apollo = source in ("apollo", "both")
    use_gecko = source in ("gecko", "both")
    if use_gecko and "cnpj" not in col_map:
        print("[aviso] Fonte Gecko pedida, mas nenhuma coluna de CNPJ foi encontrada — pulando Gecko.")
        use_gecko = False
    if use_gecko and GECKO_API_KEY == "YOUR_TOKEN":
        print("[aviso] GECKO_API_KEY não configurada (export GECKO_API_KEY=...). Gecko pode falhar com 401.")

    total = len(df)
    # Acumuladores globais para o resumo.
    summary = {
        "apollo": {"processed": 0, "enriched": 0, "errors": 0, "calls": 0},
        "gecko": {"processed": 0, "enriched": 0, "errors": 0, "calls": 0},
    }

    def _write_row(idx, result):
        for col, value in result.items():
            df.at[idx, col] = value

    def _checkpoint():
        """Salva o progresso em disco (para permitir retomada)."""
        save_dataframe(df, out)

    # ----- DRY RUN -----------------------------------------------------
    if dry_run:
        print("\n[dry-run] Mostrando os payloads que SERIAM enviados (sem chamar a API):\n")
        if use_apollo:
            print("  -- Apollo (/people/match) --")
            for i in list(df.index)[:5]:
                print(f"    registro {i}: {build_person_payload(df.loc[i], col_map)}")
        if use_gecko:
            print("  -- Gecko (/v1/extract) --")
            for i in list(df.index)[:5]:
                cnpj = _clean_cnpj(df.loc[i].get(col_map["cnpj"]))
                print(f"    registro {i}: {{'target': '{GECKO_TARGET}', 'type': '{GECKO_TYPE}', 'cnpj': '{cnpj}'}}")
        print(f"\n[dry-run] {total} registros na base. Nenhum crédito consumido. Saída não foi gravada.")
        return

    # ===== FONTE APOLLO ================================================
    if use_apollo:
        st = summary["apollo"]
        pending = [i for i in df.index if not already_done(df.loc[i], "apollo_enriched")]
        skipped = total - len(pending)
        if skipped:
            print(f"[apollo][resume] {skipped} registros já processados — pulando.")

        if batch:
            print(f"\n[apollo][bulk] Enriquecendo em lotes de {BULK_SIZE}...\n")
            batches = [pending[i:i + BULK_SIZE] for i in range(0, len(pending), BULK_SIZE)]
            for group in tqdm(batches, desc="Apollo (lotes)", unit="lote"):
                payloads = [build_person_payload(df.loc[i], col_map) for i in group]
                results = enrich_bulk(payloads)
                st["calls"] += 1
                for idx, result in zip(group, results):
                    _write_row(idx, result)
                    st["processed"] += 1
                    if result.get("apollo_enriched"):
                        st["enriched"] += 1
                    else:
                        st["errors"] += 1
                        log.info("Apollo: sem match/erro no registro %s", idx)
                _checkpoint()
                time.sleep(SLEEP_BETWEEN_CALLS)
        else:
            print("\n[apollo][single] Enriquecendo registro a registro...\n")
            for i in tqdm(pending, desc="Apollo", unit="reg"):
                result = enrich_single(build_person_payload(df.loc[i], col_map))
                st["calls"] += 1
                _write_row(i, result)
                st["processed"] += 1
                if result.get("apollo_enriched"):
                    st["enriched"] += 1
                else:
                    st["errors"] += 1
                    log.info("Apollo: sem match/erro no registro %s", i)
                _checkpoint()
                time.sleep(SLEEP_BETWEEN_CALLS)

    # ===== FONTE GECKO (por CNPJ) =====================================
    if use_gecko:
        st = summary["gecko"]
        cnpj_col = col_map["cnpj"]
        pending = [i for i in df.index if not already_done(df.loc[i], "gecko_enriched")]
        skipped = total - len(pending)
        if skipped:
            print(f"[gecko][resume] {skipped} registros já processados — pulando.")

        print("\n[gecko] Enriquecendo por CNPJ (casadosdados.com.br)...\n")
        for i in tqdm(pending, desc="Gecko", unit="reg"):
            result = enrich_gecko(df.loc[i].get(cnpj_col))
            st["calls"] += 1
            _write_row(i, result)
            st["processed"] += 1
            if result.get("gecko_enriched"):
                st["enriched"] += 1
            else:
                st["errors"] += 1
                log.info("Gecko: sem dados/erro no registro %s", i)
            _checkpoint()
            time.sleep(SLEEP_BETWEEN_CALLS)

    # ----- RESUMO FINAL ------------------------------------------------
    _checkpoint()
    print("\n" + "=" * 52)
    print("RESUMO DO ENRIQUECIMENTO")
    print("=" * 52)
    print(f"  Total na base...............: {total}")
    if use_apollo:
        a = summary["apollo"]
        print(f"  [Apollo] processados........: {a['processed']}")
        print(f"  [Apollo] enriquecidos.......: {a['enriched']}")
        print(f"  [Apollo] sem match / erros..: {a['errors']}")
        print(f"  [Apollo] chamadas / créditos: {a['calls']} / ~{a['enriched']}")
    if use_gecko:
        g = summary["gecko"]
        print(f"  [Gecko]  processados........: {g['processed']}")
        print(f"  [Gecko]  enriquecidos.......: {g['enriched']}")
        print(f"  [Gecko]  sem dados / erros..: {g['errors']}")
        print(f"  [Gecko]  chamadas / créditos: {g['calls']} / ~{g['enriched']}")
    print(f"  Arquivo de saída............: {out}")
    print(f"  Log de erros................: enrichment_errors.log")
    print("=" * 52)


# ---------------------------------------------------------------------------
# 10) CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Enriquece uma base de dados via Apollo.io e/ou GeckoAPI (CNPJ)."
    )
    parser.add_argument("--file", required=True, help="Caminho da base (.csv/.xlsx/.json)")
    parser.add_argument("--batch", action="store_true", help="Modo bulk Apollo (10 por chamada)")
    parser.add_argument("--dry-run", action="store_true", help="Testar sem consumir créditos")
    parser.add_argument(
        "--source",
        choices=["apollo", "gecko", "both"],
        default="apollo",
        help="Fonte de enriquecimento. Padrão: apollo (NÃO chama a Gecko, "
             "não consome créditos de lá). Use 'gecko' ou 'both' para incluir a GeckoAPI.",
    )
    args = parser.parse_args()

    run(args.file, batch=args.batch, dry_run=args.dry_run, source=args.source)


if __name__ == "__main__":
    main()
