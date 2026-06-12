import asyncio
import os
import re
import secrets
from datetime import datetime, timezone
from typing import Optional

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo("America/Sao_Paulo")
except Exception:  # zoneinfo sempre existe no py3.9+, mas falha segura
    _TZ = timezone.utc

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from database import settings, get_db, new_id, now
from services import auth_emails, mailer
from services.auth import (
    APROVACAO_TTL_SECONDS,
    CONTA_ADMIN,
    RESET_TTL_SECONDS,
    create_access_token,
    create_action_token,
    hash_password,
    require_auth,
    validate_credentials,
    verify_action_token,
    verify_password,
)

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SENHA_MIN = 8

# Mensagens reutilizadas (mantêm consistência com o que a UI espera)
MSG_PENDENTE = "Sua conta está aguardando aprovação do administrador."
MSG_RECUSADO = "Seu acesso foi recusado. Entre em contato com o administrador."
MSG_INATIVO = "Sua conta está inativa. Entre em contato com o administrador."
MSG_RESET_GENERICA = "Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalizar_email(email: str) -> str:
    return (email or "").strip().lower()


def _validar_senha(senha: str, confirmacao: str) -> None:
    if senha != confirmacao:
        raise HTTPException(status_code=400, detail="As senhas não conferem.")
    if len(senha or "") < _SENHA_MIN:
        raise HTTPException(status_code=400, detail=f"A senha deve ter ao menos {_SENHA_MIN} caracteres.")


def _frontend_base() -> str:
    """URL pública do frontend p/ montar links de redefinição/login."""
    if settings.app_public_url:
        base = settings.app_public_url
    else:
        origins = (os.environ.get("FRONTEND_ORIGIN", "") or "").split(",")
        origins = [o.strip() for o in origins if o.strip()]
        base = origins[0] if origins else settings.backend_public_url
    return base.rstrip("/")


def _backend_base() -> str:
    return (settings.backend_public_url or "").rstrip("/")


def _fmt_data(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(_TZ)
    return local.strftime("%d/%m/%Y às %H:%M")


def _dono_principal_email() -> str:
    return (settings.dono_principal_email or settings.smtp_from or "").strip()


def _admin_email() -> str:
    """E-mail para onde vai o link de redefinição do login `admin`."""
    return _normalizar_email(
        settings.admin_email or settings.dono_principal_email or settings.smtp_from or ""
    )


# ---------------------------------------------------------------------------
# Login / sessão (admin legado continua funcionando inalterado)
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(payload: LoginRequest):
    ident = (payload.username or "").strip()
    db = get_db()

    # 1) Caminho do admin (login `admin`) — conta sentinela, sem dados próprios.
    #    A senha pode ter sido redefinida por e-mail (guardada em admin_auth); se
    #    ainda não houver redefinição, vale a senha de ambiente (ADMIN_PASSWORD).
    if ident == settings.admin_username:
        override = await db.admin_auth.find_one({"_id": "admin"})
        if override and override.get("senha_hash"):
            senha_ok = verify_password(payload.password, override["senha_hash"])
        else:
            senha_ok = validate_credentials(ident, payload.password)
        if senha_ok:
            token = create_access_token(ident, CONTA_ADMIN)
            return {
                "ok": True,
                "access_token": token,
                "token_type": "bearer",
                "user": {"username": ident, "display_name": ident.title(), "conta_id": CONTA_ADMIN},
                "expires_in": 60 * 60 * 12,
            }
        # Senha incorreta para o admin (o username `admin` não é e-mail de Dono).
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")

    # 2) Caminho do dono (cadastrado na base) — login por e-mail.
    usuario = await db.usuarios.find_one({"email": _normalizar_email(ident)})
    if usuario and verify_password(payload.password, usuario.get("senha_hash", "")):
        status = usuario.get("status")
        if status == "pendente":
            raise HTTPException(status_code=403, detail=MSG_PENDENTE)
        if status == "recusado":
            raise HTTPException(status_code=403, detail=MSG_RECUSADO)
        if status in ("inativo", "bloqueado"):
            raise HTTPException(status_code=403, detail=MSG_INATIVO)
        if status == "aprovado":
            await db.usuarios.update_one({"_id": usuario["_id"]}, {"$set": {"ultimo_acesso": now()}})
            conta_id = usuario.get("conta_id") or usuario["_id"]
            token = create_access_token(usuario["email"], conta_id)
            return {
                "ok": True,
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "username": usuario["email"],
                    "display_name": usuario.get("nome") or usuario["email"],
                    "funcao": usuario.get("funcao") or "dono",
                    "equipe_id": usuario.get("equipe_id"),
                    "conta_id": conta_id,
                },
                "expires_in": 60 * 60 * 12,
            }

    # Mensagem genérica — não revela se o e-mail existe.
    raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")


@router.get("/me")
async def me(user=Depends(require_auth)):
    sub = user["sub"]
    # Admin (env) — equivale ao dono principal do sistema, com visão de gestão.
    if sub == settings.admin_username:
        return {"ok": True, "user": {
            "username": sub, "display_name": sub.title(), "funcao": "dono",
            "equipe_id": None, "conta_id": CONTA_ADMIN,
        }}
    # Dono / colaborador cadastrado
    db = get_db()
    usuario = await db.usuarios.find_one({"email": _normalizar_email(sub)})
    if not usuario or usuario.get("status") != "aprovado":
        raise HTTPException(status_code=401, detail="Sessão inválida")
    return {
        "ok": True,
        "user": {
            "username": usuario["email"],
            "display_name": usuario.get("nome") or usuario["email"],
            "funcao": usuario.get("funcao") or "dono",
            "equipe_id": usuario.get("equipe_id"),
            "conta_id": usuario.get("conta_id") or usuario["_id"],
        },
    }


# ---------------------------------------------------------------------------
# Cadastro de novo dono (fica pendente de aprovação)
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    nome: str
    email: str
    senha: str
    # Confirmação é opcional: o cadastro simples pede só nome + e-mail + senha.
    # Se vier preenchida (ex.: outra tela), validamos a igualdade.
    confirmar_senha: Optional[str] = None


@router.post("/register")
async def register(payload: RegisterRequest):
    nome = (payload.nome or "").strip()
    email = _normalizar_email(payload.email)

    if not nome:
        raise HTTPException(status_code=400, detail="Informe seu nome.")
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Informe um e-mail válido.")
    if payload.confirmar_senha is not None and payload.senha != payload.confirmar_senha:
        raise HTTPException(status_code=400, detail="As senhas não conferem.")
    if len(payload.senha or "") < _SENHA_MIN:
        raise HTTPException(status_code=400, detail=f"A senha deve ter ao menos {_SENHA_MIN} caracteres.")

    db = get_db()
    if await db.usuarios.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Já existe um cadastro com este e-mail.")

    if not mailer.smtp_configurado():
        # Sem SMTP não há como solicitar aprovação ao dono principal.
        raise HTTPException(
            status_code=503,
            detail="No momento não é possível concluir o cadastro. Tente novamente mais tarde.",
        )

    ts = now()
    acao_jti = secrets.token_urlsafe(16)
    uid = new_id()
    doc = {
        "_id": uid,
        "nome": nome,
        "email": email,
        "senha_hash": hash_password(payload.senha),
        "papel": "dono",
        # Dono é a raiz da própria conta (tenant): conta_id == seu próprio _id.
        "conta_id": uid,
        "status": "pendente",
        "acao_jti": acao_jti,
        "reset_jti": None,
        "reset_exp": None,
        "created_at": ts,
        "updated_at": ts,
        "aprovado_em": None,
        "recusado_em": None,
    }
    await db.usuarios.insert_one(doc)

    # Envia a solicitação de aprovação para o dono principal.
    destinatario = _dono_principal_email()
    try:
        if not destinatario:
            raise RuntimeError("E-mail do dono principal não configurado.")
        token_ap = create_action_token("aprovar", uid, acao_jti, APROVACAO_TTL_SECONDS)
        token_re = create_action_token("recusar", uid, acao_jti, APROVACAO_TTL_SECONDS)
        base = _backend_base()
        link_aprovar = f"{base}/api/auth/aprovar?token={token_ap}"
        link_recusar = f"{base}/api/auth/recusar?token={token_re}"
        corpo = auth_emails.email_nova_solicitacao(
            nome, email, _fmt_data(ts), link_aprovar, link_recusar
        )
        await asyncio.to_thread(
            mailer.enviar_email, destinatario, "Nova solicitação de cadastro no sistema", corpo
        )
    except Exception:
        # Não deixa um cadastro "órfão" se a solicitação não pôde ser enviada.
        await db.usuarios.delete_one({"_id": uid})
        raise HTTPException(
            status_code=503,
            detail="No momento não é possível concluir o cadastro. Tente novamente mais tarde.",
        )

    return {
        "ok": True,
        "message": "Cadastro enviado com sucesso. Aguarde a aprovação do administrador para acessar o sistema.",
    }


# ---------------------------------------------------------------------------
# Aprovação / recusa (links clicados pelo dono principal no e-mail)
# ---------------------------------------------------------------------------

def _pagina(titulo: str, mensagem: str, sucesso: bool, status_code: int = 200) -> HTMLResponse:
    return HTMLResponse(content=auth_emails.pagina_resultado(titulo, mensagem, sucesso), status_code=status_code)


async def _carregar_para_acao(token: str, typ: str):
    """Valida o token e devolve (db, usuario). Levanta HTTPException via verify."""
    payload = verify_action_token(token, typ)
    db = get_db()
    usuario = await db.usuarios.find_one({"_id": payload.get("uid")})
    return db, usuario, payload


@router.get("/aprovar", response_class=HTMLResponse)
async def aprovar(token: str):
    try:
        db, usuario, payload = await _carregar_para_acao(token, "aprovar")
    except HTTPException as exc:
        return _pagina("Link inválido", exc.detail, sucesso=False, status_code=exc.status_code)

    if not usuario:
        return _pagina("Solicitação não encontrada", "Esta solicitação não existe mais.", sucesso=False, status_code=404)

    # Uso único: o jti precisa bater com o salvo; se já foi processado, não bate.
    if usuario.get("acao_jti") != payload.get("jti") or usuario.get("status") != "pendente":
        if usuario.get("status") == "aprovado":
            return _pagina("Acesso já aprovado", "Este usuário já está com o acesso liberado.", sucesso=True)
        return _pagina("Link já utilizado", "Esta solicitação já foi processada anteriormente.", sucesso=False, status_code=409)

    ts = now()
    await db.usuarios.update_one(
        {"_id": usuario["_id"]},
        {"$set": {"status": "aprovado", "aprovado_em": ts, "updated_at": ts}, "$unset": {"acao_jti": ""}},
    )

    # E-mail de confirmação ao usuário (falha aqui não invalida a aprovação).
    try:
        if mailer.smtp_configurado():
            corpo = auth_emails.email_acesso_aprovado(usuario.get("nome") or "", _frontend_base())
            await asyncio.to_thread(
                mailer.enviar_email, usuario["email"], "Seu acesso foi aprovado", corpo
            )
    except Exception:
        pass

    return _pagina(
        "Acesso aprovado",
        f"{usuario.get('nome') or usuario['email']} já pode acessar o sistema.",
        sucesso=True,
    )


@router.get("/recusar", response_class=HTMLResponse)
async def recusar(token: str):
    try:
        db, usuario, payload = await _carregar_para_acao(token, "recusar")
    except HTTPException as exc:
        return _pagina("Link inválido", exc.detail, sucesso=False, status_code=exc.status_code)

    if not usuario:
        return _pagina("Solicitação não encontrada", "Esta solicitação não existe mais.", sucesso=False, status_code=404)

    if usuario.get("acao_jti") != payload.get("jti") or usuario.get("status") != "pendente":
        if usuario.get("status") == "recusado":
            return _pagina("Acesso já recusado", "Esta solicitação já havia sido recusada.", sucesso=True)
        return _pagina("Link já utilizado", "Esta solicitação já foi processada anteriormente.", sucesso=False, status_code=409)

    ts = now()
    await db.usuarios.update_one(
        {"_id": usuario["_id"]},
        {"$set": {"status": "recusado", "recusado_em": ts, "updated_at": ts}, "$unset": {"acao_jti": ""}},
    )
    return _pagina(
        "Acesso recusado",
        "A solicitação foi recusada e o usuário não terá acesso ao sistema.",
        sucesso=True,
    )


# ---------------------------------------------------------------------------
# Redefinição de senha por e-mail
# ---------------------------------------------------------------------------

class EsqueciSenhaRequest(BaseModel):
    email: str


@router.post("/esqueci-senha")
async def esqueci_senha(payload: EsqueciSenhaRequest):
    email = _normalizar_email(payload.email)
    db = get_db()

    # Caminho do admin: o login `admin` não é um Dono cadastrado, então a
    # redefinição é guardada na coleção admin_auth e enviada ao e-mail do admin.
    if email and email == _admin_email() and mailer.smtp_configurado():
        ts = now()
        jti = secrets.token_urlsafe(16)
        exp = int(ts.timestamp()) + RESET_TTL_SECONDS
        await db.admin_auth.update_one(
            {"_id": "admin"},
            {"$set": {"reset_jti": jti, "reset_exp": exp, "updated_at": ts}},
            upsert=True,
        )
        try:
            token = create_action_token("reset", CONTA_ADMIN, jti, RESET_TTL_SECONDS)
            link = f"{_frontend_base()}/redefinir-senha?token={token}"
            corpo = auth_emails.email_redefinir_senha("Administrador", link)
            await asyncio.to_thread(
                mailer.enviar_email, email, "Redefinição de senha", corpo
            )
        except Exception:
            pass
        return {"ok": True, "message": MSG_RESET_GENERICA}

    usuario = await db.usuarios.find_one({"email": email})

    # Só donos aprovados conseguem redefinir; demais casos seguem em silêncio
    # para não revelar a existência (ou o status) do e-mail.
    if usuario and usuario.get("status") == "aprovado" and mailer.smtp_configurado():
        ts = now()
        jti = secrets.token_urlsafe(16)
        exp = int(ts.timestamp()) + RESET_TTL_SECONDS
        await db.usuarios.update_one(
            {"_id": usuario["_id"]},
            {"$set": {"reset_jti": jti, "reset_exp": exp, "updated_at": ts}},
        )
        try:
            token = create_action_token("reset", usuario["_id"], jti, RESET_TTL_SECONDS)
            link = f"{_frontend_base()}/redefinir-senha?token={token}"
            corpo = auth_emails.email_redefinir_senha(usuario.get("nome") or "", link)
            await asyncio.to_thread(
                mailer.enviar_email, usuario["email"], "Redefinição de senha", corpo
            )
        except Exception:
            pass

    return {"ok": True, "message": MSG_RESET_GENERICA}


class ValidarResetRequest(BaseModel):
    token: str


@router.post("/redefinir-senha/validar")
async def validar_reset(payload: ValidarResetRequest):
    """Usado pela tela de nova senha para validar o link antes de mostrar o formulário."""
    info = verify_action_token(payload.token, "reset")
    db = get_db()
    if info.get("uid") == CONTA_ADMIN:
        rec = await db.admin_auth.find_one({"_id": "admin"})
        if not rec or rec.get("reset_jti") != info.get("jti"):
            raise HTTPException(status_code=400, detail="Este link é inválido ou já foi utilizado.")
        if int(rec.get("reset_exp") or 0) < int(now().timestamp()):
            raise HTTPException(status_code=400, detail="Este link expirou.")
        return {"ok": True}
    usuario = await db.usuarios.find_one({"_id": info.get("uid")})
    if not usuario or usuario.get("reset_jti") != info.get("jti"):
        raise HTTPException(status_code=400, detail="Este link é inválido ou já foi utilizado.")
    if int(usuario.get("reset_exp") or 0) < int(now().timestamp()):
        raise HTTPException(status_code=400, detail="Este link expirou.")
    return {"ok": True}


class RedefinirSenhaRequest(BaseModel):
    token: str
    senha: str
    confirmar_senha: str


@router.post("/redefinir-senha")
async def redefinir_senha(payload: RedefinirSenhaRequest):
    info = verify_action_token(payload.token, "reset")
    _validar_senha(payload.senha, payload.confirmar_senha)

    db = get_db()
    ts = now()

    # Redefinição do login `admin` — grava a nova senha em admin_auth. A partir
    # daí o admin entra com a senha nova (a ADMIN_PASSWORD de ambiente deixa de
    # valer; para reabilitá-la, apague o documento admin_auth/admin).
    if info.get("uid") == CONTA_ADMIN:
        rec = await db.admin_auth.find_one({"_id": "admin"})
        if not rec or rec.get("reset_jti") != info.get("jti"):
            raise HTTPException(status_code=400, detail="Este link é inválido ou já foi utilizado.")
        if int(rec.get("reset_exp") or 0) < int(now().timestamp()):
            raise HTTPException(status_code=400, detail="Este link expirou.")
        await db.admin_auth.update_one(
            {"_id": "admin"},
            {"$set": {"senha_hash": hash_password(payload.senha), "updated_at": ts},
             "$unset": {"reset_jti": "", "reset_exp": ""}},
        )
        return {
            "ok": True,
            "message": "Sua senha foi redefinida com sucesso. Você já pode acessar o sistema.",
        }

    usuario = await db.usuarios.find_one({"_id": info.get("uid")})
    if not usuario or usuario.get("reset_jti") != info.get("jti"):
        raise HTTPException(status_code=400, detail="Este link é inválido ou já foi utilizado.")
    if int(usuario.get("reset_exp") or 0) < int(now().timestamp()):
        raise HTTPException(status_code=400, detail="Este link expirou.")

    # Uso único: limpa o jti para o mesmo link não servir de novo.
    await db.usuarios.update_one(
        {"_id": usuario["_id"]},
        {"$set": {"senha_hash": hash_password(payload.senha), "updated_at": ts},
         "$unset": {"reset_jti": "", "reset_exp": ""}},
    )
    return {
        "ok": True,
        "message": "Sua senha foi redefinida com sucesso. Você já pode acessar o sistema.",
    }
