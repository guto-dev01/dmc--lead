import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional

from fastapi import Depends, Header, HTTPException

from database import settings, get_db

TOKEN_TTL_SECONDS = 60 * 60 * 12

# Conta sentinela do login `admin` (emergência): nenhum dado de negócio aponta
# para ela, então o admin entra mas não enxerga dados de nenhuma conta real.
CONTA_ADMIN = "__admin__"

# Validade dos links enviados por e-mail
APROVACAO_TTL_SECONDS = 60 * 60 * 24 * 7   # 7 dias para o dono principal decidir
RESET_TTL_SECONDS = 60 * 60               # 1 hora para redefinir a senha

# ---------------------------------------------------------------------------
# Hash de senha — PBKDF2-HMAC-SHA256 (biblioteca padrão, com salt por usuário).
# Nunca guardamos a senha em texto puro. Formato armazenado (igual ao do Django):
#   pbkdf2_sha256$<iteracoes>$<salt_b64>$<hash_b64>
# ---------------------------------------------------------------------------
_PBKDF2_ALGO = "pbkdf2_sha256"
_PBKDF2_ITERATIONS = 240_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"{_PBKDF2_ALGO}${_PBKDF2_ITERATIONS}${_b64url_encode(salt)}${_b64url_encode(dk)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, iters, salt_b64, hash_b64 = password_hash.split("$", 3)
        if algo != _PBKDF2_ALGO:
            return False
        salt = _b64url_decode(salt_b64)
        expected = _b64url_decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iters))
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("utf-8"))


def _sign(payload_b64: str) -> str:
    return hmac.new(
        settings.secret_key.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_access_token(username: str, conta_id: Optional[str] = None) -> str:
    now = int(time.time())
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    if conta_id is not None:
        payload["conta_id"] = conta_id
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    return f"{payload_b64}.{_sign(payload_b64)}"


def verify_access_token(token: str) -> dict:
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    expected = _sign(payload_b64)
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Token inválido")

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Sessão expirada")

    return payload


def require_auth(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return verify_access_token(token)


def validate_credentials(username: str, password: str) -> bool:
    return username == settings.admin_username and password == settings.admin_password


async def conta_atual(user: dict = Depends(require_auth)) -> str:
    """Resolve a conta (tenant) da requisição a partir do token.

    Todo dado de negócio é isolado por `conta_id`. A conta é o `_id` do usuário
    Dono que é a raiz da conta; colaboradores compartilham a conta do dono.

    Preferimos o claim `conta_id` embutido no token (sem custo de I/O). Para
    tokens antigos (sem o claim) caímos num lookup: o admin recebe a conta
    sentinela; donos/colaboradores recebem o `conta_id` salvo no usuário."""
    conta = user.get("conta_id")
    if conta:
        return conta

    sub = user.get("sub")
    if sub == settings.admin_username:
        return CONTA_ADMIN

    db = get_db()
    usuario = await db.usuarios.find_one(
        {"email": (sub or "").strip().lower()}, {"conta_id": 1}
    )
    if usuario:
        return usuario.get("conta_id") or usuario["_id"]
    # Sem usuário correspondente: isola numa conta própria (nunca cai em dados alheios).
    raise HTTPException(status_code=401, detail="Sessão inválida")


# ---------------------------------------------------------------------------
# Tokens de ação assinados (aprovação de cadastro / redefinição de senha)
#
# Mesmo esquema HMAC do token de acesso, mas com um campo `typ` (finalidade) e
# um `jti` (identificador) que permite uso único: o `jti` é guardado no usuário
# e invalidado após a ação, então o mesmo link não funciona duas vezes.
# ---------------------------------------------------------------------------

def create_action_token(typ: str, uid: str, jti: str, ttl_seconds: int) -> str:
    now = int(time.time())
    payload = {"typ": typ, "uid": uid, "jti": jti, "iat": now, "exp": now + ttl_seconds}
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )
    return f"{payload_b64}.{_sign(payload_b64)}"


def verify_action_token(token: str, expected_typ: str) -> dict:
    """Valida assinatura, finalidade e expiração. Levanta HTTPException 400 com
    mensagem amigável quando o link é inválido ou expirou. A checagem de uso
    único (jti) é feita por quem chama, comparando com o valor salvo no usuário."""
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Link inválido.") from exc

    if not hmac.compare_digest(signature, _sign(payload_b64)):
        raise HTTPException(status_code=400, detail="Link inválido.")

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Link inválido.") from exc

    if payload.get("typ") != expected_typ:
        raise HTTPException(status_code=400, detail="Link inválido.")

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=400, detail="Este link expirou.")

    return payload
