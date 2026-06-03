"""Migração para multi-tenant (isolamento de dados por conta) — roda UMA vez.

Uso:
    cd backend && python scripts/migrate_multitenant.py

O que faz (idempotente — pode rodar mais de uma vez sem estragar):
  1. Garante o usuário `CONTA_PRINCIPAL_EMAIL` (default nathalial@complexodmc.com.br)
     como dono APROVADO, com conta_id = seu próprio _id. Esse vira a "conta principal".
  2. Backfill de `usuarios`: cada dono sem conta_id -> conta_id = _id; colaborador ->
     conta do criador (via `criado_por`), senão a conta principal.
  3. Backfill de `equipes`: conta do criador (via `criado_por`), senão conta principal.
  4. Para cada coleção de negócio: todo documento sem conta_id passa a pertencer à
     conta principal (dono dos dados legados).

Lê MONGO_URL / MONGO_DB do .env do backend. Rode com o backend novo já deployado
(ou ao menos com `ensure_schema` executado, para os índices únicos por conta).
"""
import os
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "imobpro")
CONTA_PRINCIPAL_EMAIL = os.environ.get(
    "CONTA_PRINCIPAL_EMAIL", "nathalial@complexodmc.com.br"
).strip().lower()

# Coleções de dados de negócio que recebem conta_id dos dados legados.
COLECOES_NEGOCIO = [
    "empresas", "contatos", "conversas", "mensagens", "atividades",
    "campanhas", "campanha_itens", "mercado_itens", "tarefas", "templates",
    "dmc_parceiros", "dmc_empreendimentos",
]


def _now():
    return datetime.now(timezone.utc)


def garantir_conta_principal(db) -> str:
    """Devolve o conta_id da conta principal, criando/ajustando o usuário se preciso."""
    u = db.usuarios.find_one({"email": CONTA_PRINCIPAL_EMAIL})
    if u:
        conta_id = u.get("conta_id") or u["_id"]
        db.usuarios.update_one(
            {"_id": u["_id"]},
            {"$set": {"conta_id": conta_id, "status": "aprovado",
                      "papel": u.get("papel") or "dono", "updated_at": _now()}},
        )
        print(f"Conta principal: usuário existente {CONTA_PRINCIPAL_EMAIL} (conta_id={conta_id})")
        return conta_id

    uid = str(uuid.uuid4())
    ts = _now()
    db.usuarios.insert_one({
        "_id": uid, "nome": "Nathalia", "email": CONTA_PRINCIPAL_EMAIL,
        "senha_hash": "", "papel": "dono", "conta_id": uid,
        "funcao": "dono", "equipe_id": None, "status": "aprovado",
        "reset_jti": None, "reset_exp": None,
        "created_at": ts, "updated_at": ts, "aprovado_em": ts,
    })
    print(f"Conta principal: usuário criado {CONTA_PRINCIPAL_EMAIL} (conta_id={uid}). "
          f"Defina a senha pelo fluxo 'esqueci minha senha'.")
    return uid


def backfill_usuarios(db, conta_principal: str) -> None:
    # 1) Donos (ou sem criador) sem conta_id -> conta própria (_id)
    n_donos = 0
    for u in db.usuarios.find({"conta_id": {"$exists": False}}):
        if (u.get("papel") == "dono") or not u.get("criado_por"):
            db.usuarios.update_one({"_id": u["_id"]}, {"$set": {"conta_id": u["_id"]}})
            n_donos += 1
    # 2) Colaboradores restantes -> conta do criador (por e-mail), senão a principal
    n_colab = 0
    for u in db.usuarios.find({"conta_id": {"$exists": False}}):
        criador = (u.get("criado_por") or "").strip().lower()
        conta = None
        if criador:
            dono = db.usuarios.find_one({"email": criador}, {"conta_id": 1})
            conta = (dono or {}).get("conta_id") if dono else None
        db.usuarios.update_one({"_id": u["_id"]}, {"$set": {"conta_id": conta or conta_principal}})
        n_colab += 1
    print(f"usuarios: {n_donos} donos + {n_colab} colaboradores receberam conta_id")


def backfill_equipes(db, conta_principal: str) -> None:
    n = 0
    for e in db.equipes.find({"conta_id": {"$exists": False}}):
        criador = (e.get("criado_por") or "").strip().lower()
        conta = None
        if criador:
            dono = db.usuarios.find_one({"email": criador}, {"conta_id": 1})
            conta = (dono or {}).get("conta_id") if dono else None
        db.equipes.update_one({"_id": e["_id"]}, {"$set": {"conta_id": conta or conta_principal}})
        n += 1
    print(f"equipes: {n} receberam conta_id")


def backfill_negocio(db, conta_principal: str) -> None:
    for nome in COLECOES_NEGOCIO:
        coll = db[nome]
        antes = coll.count_documents({"conta_id": {"$exists": False}})
        if antes:
            coll.update_many(
                {"conta_id": {"$exists": False}}, {"$set": {"conta_id": conta_principal}}
            )
        total = coll.count_documents({})
        print(f"  {nome}: {antes} migrados (de {total} no total)")


def main() -> None:
    client = MongoClient(MONGO_URL, tz_aware=True)
    db = client[MONGO_DB]

    print(f"Banco: {MONGO_DB} @ {MONGO_URL}")
    conta_principal = garantir_conta_principal(db)
    backfill_usuarios(db, conta_principal)
    backfill_equipes(db, conta_principal)
    print("Dados de negócio (sem conta_id -> conta principal):")
    backfill_negocio(db, conta_principal)
    print("Migração concluída.")


if __name__ == "__main__":
    main()
