"""Migra os dados do ImobPro de PostgreSQL para MongoDB (uma vez).

Uso:
    pip install asyncpg pymongo
    DATABASE_URL=postgresql://imobpro:senha@localhost:5432/imobpro \
    MONGO_URL=mongodb://localhost:27017 MONGO_DB=imobpro \
    python backend/scripts/migrate_pg_to_mongo.py

Cada tabela vira uma coleção homônima; a coluna `id` (UUID) vira `_id` (texto).
Os UUID de chave estrangeira (empresa_id, conversa_id…) também viram texto, e os
campos JSONB (dados_cnpj, dados) são gravados como objetos. Reexecutar é seguro:
usa upsert por _id, então não duplica.
"""
import asyncio
import json
import os
import uuid
from datetime import date, datetime
from decimal import Decimal

import asyncpg
from pymongo import AsyncMongoClient

TABELAS = [
    "empresas", "contatos", "conversas", "mensagens", "templates",
    "campanhas", "campanha_itens", "atividades", "mercado_itens",
    "dmc_parceiros", "dmc_empreendimentos",
]

# Colunas JSONB que o asyncpg devolve como texto e precisam virar objeto
JSON_COLS = {"dados_cnpj", "dados"}


def _converter(col: str, valor):
    if isinstance(valor, uuid.UUID):
        return str(valor)
    # Decimal (colunas NUMERIC/DECIMAL) -> float; BSON não encoda Decimal nativo
    if isinstance(valor, Decimal):
        return float(valor)
    # date puro (coluna DATE) -> texto ISO; BSON só aceita datetime, não date
    if isinstance(valor, date) and not isinstance(valor, datetime):
        return valor.isoformat()
    if col in JSON_COLS and isinstance(valor, str):
        try:
            return json.loads(valor)
        except Exception:
            return valor
    return valor


def _doc(row) -> dict:
    d = {}
    for col, valor in dict(row).items():
        d[col] = _converter(col, valor)
    if "id" in d:
        d["_id"] = d.pop("id")
    return d


async def migrar_tabela(pg, db, tabela: str) -> int:
    # tabela pode não existir (ex.: bancos antigos) — ignora nesse caso
    existe = await pg.fetchval(
        "SELECT to_regclass($1)", f"public.{tabela}"
    )
    if not existe:
        print(f"  · {tabela}: tabela inexistente, pulando")
        return 0
    rows = await pg.fetch(f"SELECT * FROM {tabela}")
    if not rows:
        print(f"  · {tabela}: 0 registros")
        return 0
    coll = db[tabela]
    for row in rows:
        doc = _doc(row)
        await coll.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    print(f"  ✓ {tabela}: {len(rows)} registros")
    return len(rows)


async def main():
    pg_dsn = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not pg_dsn:
        raise SystemExit("Defina DATABASE_URL (Postgres de origem).")
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    mongo_db = os.environ.get("MONGO_DB", "imobpro")

    pg = await asyncpg.connect(pg_dsn)
    client = AsyncMongoClient(mongo_url, tz_aware=True)
    db = client[mongo_db]
    try:
        print(f"Migrando Postgres -> Mongo ({mongo_db})…")
        total = 0
        for tabela in TABELAS:
            total += await migrar_tabela(pg, db, tabela)
        print(f"Concluído: {total} documentos migrados.")
    finally:
        await pg.close()
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
