"""Apaga TODO o histórico de conversas/mensagens do WhatsApp no ImobPro.

Uso:
    cd backend && python scripts/limpar_conversas.py

Lê MONGO_URL / MONGO_DB do .env do backend e zera as coleções `conversas` e
`mensagens`. NÃO mexe em `atividades` (produtividade) nem em outras coleções.
A gravação dessas mensagens já está desativada no código (whatsapp.py), então
depois de rodar isto o espelho do WhatsApp permanece vazio.
"""
import os

from pymongo import MongoClient

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "imobpro")

client = MongoClient(MONGO_URL, tz_aware=True)
db = client[MONGO_DB]

msgs = db.mensagens.count_documents({})
convs = db.conversas.count_documents({})
print(f"Antes: {convs} conversas, {msgs} mensagens")

r1 = db.mensagens.delete_many({})
r2 = db.conversas.delete_many({})
print(f"Apagadas: {r2.deleted_count} conversas, {r1.deleted_count} mensagens")
print("Pronto. O histórico do WhatsApp foi limpo.")
