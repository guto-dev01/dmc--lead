#!/usr/bin/env bash
# ImobPro - desenvolvimento local usando o BANCO NA NUVEM (MongoDB Atlas).
# Pre-requisito: seu IP precisa estar liberado no Atlas (Network Access).
#
# Uso:   ./dev.sh
# Parar: Ctrl+C  (encerra backend e frontend juntos)

set -euo pipefail
cd "$(dirname "$0")"

# 1) Carrega as variaveis do .env da raiz (MONGO_URL do Atlas, chaves, etc.)
if [ ! -f .env ]; then
  echo "ERRO: arquivo .env nao encontrado na raiz do projeto." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

echo ">> Banco: ${MONGO_URL%%@*}@...  (db: ${MONGO_DB:-imobpro})"

# 2) Testa a conexao com o Atlas antes de subir (falha cedo com msg clara)
backend/.venv/bin/python - <<PY || {
from pymongo import MongoClient
import certifi, os
uri = os.environ["MONGO_URL"]
MongoClient(uri, serverSelectionTimeoutMS=8000, tlsCAFile=certifi.where()).admin.command("ping")
print(">> Conexao com o Atlas: OK")
PY
  echo ""
  echo "ERRO: nao consegui conectar no Atlas."
  echo "  -> Libere seu IP em https://cloud.mongodb.com  (Network Access)"
  echo "  -> Seu IP atual: $(curl -s https://api.ipify.org || echo '???')"
  echo "  -> E confirme que o cluster nao esta 'Paused'."
  exit 1
}

# 3) Sobe o backend (porta 8001 - a que o frontend procura por padrao)
echo ">> Subindo backend em http://localhost:8001 ..."
( cd backend && exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001 ) &
BACK_PID=$!

# 4) Sobe o frontend (porta 3000) apontando pro backend local
echo ">> Subindo frontend em http://localhost:3000 ..."
export NEXT_PUBLIC_API_URL="http://localhost:8001"
( cd frontend && exec npm run dev ) &
FRONT_PID=$!

# 5) Ao apertar Ctrl+C, derruba os dois
trap 'echo; echo ">> Encerrando..."; kill $BACK_PID $FRONT_PID 2>/dev/null || true' INT TERM
echo ""
echo "============================================================"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8001/docs"
echo "  Login:     admin / admin123"
echo "  (Ctrl+C para parar tudo)"
echo "============================================================"
wait
