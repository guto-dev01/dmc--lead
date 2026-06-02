from fastapi import APIRouter, HTTPException
from fastapi import File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid
import asyncio
import base64
import os
from pathlib import Path
import smtplib
from email.message import EmailMessage
import httpx

from database import settings, get_conn
from routers.whatsapp import normalizar_numero

router = APIRouter()
public_router = APIRouter()
MEDIA_DIR = Path("/tmp/imobpro_campaign_media")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


class CampanhaCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    template_id: Optional[str] = None
    empresa_ids: Optional[List[str]] = []


class CampanhaDisparoRapido(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    empresa_ids: Optional[List[str]] = []
    contato_ids: Optional[List[str]] = []
    mensagem: str
    media_url: Optional[str] = None
    media_base64: Optional[str] = None
    media_mimetype: Optional[str] = None
    media_filename: Optional[str] = None
    media_type: Optional[str] = None


class CampanhaDisparoEmail(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    empresa_ids: Optional[List[str]] = []
    contato_ids: Optional[List[str]] = []
    assunto: str
    mensagem: str
    html: Optional[bool] = False
    media_url: Optional[str] = None
    media_base64: Optional[str] = None
    media_mimetype: Optional[str] = None
    media_filename: Optional[str] = None


def _limpar_media_base64(valor: Optional[str]) -> Optional[str]:
    if not valor:
        return None
    valor = valor.strip()
    if valor.startswith("data:") and "," in valor:
        return valor.split(",", 1)[1]
    return valor


def _deduzir_tipo_media(mimetype: Optional[str], media_type: Optional[str]) -> str:
    if media_type in {"image", "video", "document"}:
        return media_type
    if mimetype:
        if mimetype.startswith("image/"):
            return "image"
        if mimetype.startswith("video/"):
            return "video"
    return "document"


def _deduzir_nome_arquivo(mimetype: Optional[str], media_type: str) -> str:
    if media_type == "video":
        return "campanha.mp4"
    if media_type == "image":
        if mimetype == "image/png":
            return "campanha.png"
        if mimetype in {"image/jpeg", "image/jpg"}:
            return "campanha.jpg"
        if mimetype == "image/gif":
            return "campanha.gif"
        return "campanha.jpg"
    return "campanha.pdf"


def _extensao_por_mime(mimetype: Optional[str]) -> str:
    if mimetype == "image/png":
        return ".png"
    if mimetype in {"image/jpeg", "image/jpg"}:
        return ".jpg"
    if mimetype == "image/gif":
        return ".gif"
    if mimetype == "video/mp4":
        return ".mp4"
    if mimetype == "video/webm":
        return ".webm"
    return ""


def _url_media_interna(filename: str) -> str:
    return f"{settings.backend_public_url.rstrip('/')}/api/campanhas/media/{filename}"


async def _evo_post(path: str, payload: dict):
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{settings.evolution_api_url}/{path}",
            json=payload,
            headers={
                "apikey": settings.evolution_api_key,
                "Content-Type": "application/json",
            },
        )
    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Evolution API: {response.text}",
        )
    return response.json()


@router.post("/upload-media")
async def upload_media(file: UploadFile = File(...)):
    """Recebe imagem ou vídeo e disponibiliza via URL interna para a Evolution."""
    mimetype = (file.content_type or "").lower()
    if not mimetype.startswith("image/") and not mimetype.startswith("video/"):
        raise HTTPException(status_code=400, detail="Envie apenas imagem ou vídeo.")

    base_name = Path(file.filename or "campanha").stem[:80] or "campanha"
    ext = _extensao_por_mime(mimetype) or Path(file.filename or "").suffix or ""
    safe_name = f"{uuid.uuid4().hex}_{base_name}{ext}"
    target = MEDIA_DIR / safe_name

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    with target.open("wb") as f:
        f.write(contents)

    media_type = "video" if mimetype.startswith("video/") else "image"
    return {
        "ok": True,
        "filename": safe_name,
        "original_filename": file.filename,
        "mimetype": mimetype,
        "media_type": media_type,
        "url": _url_media_interna(safe_name),
    }


@public_router.get("/media/{filename}")
async def get_media(filename: str):
    target = MEDIA_DIR / Path(filename).name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    return FileResponse(path=target)


def _smtp_configurado() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def _smtp_enviar(destinatario: str, assunto: str, corpo: str, html: bool, anexo: Optional[dict] = None):
    """Envia um e-mail via SMTP. Bloqueante — chamar via asyncio.to_thread."""
    if not _smtp_configurado():
        raise RuntimeError("SMTP não configurado (defina SMTP_HOST e SMTP_FROM).")

    msg = EmailMessage()
    remetente = settings.smtp_from
    if settings.smtp_from_nome:
        remetente = f"{settings.smtp_from_nome} <{settings.smtp_from}>"
    msg["From"] = remetente
    msg["To"] = destinatario
    msg["Subject"] = assunto or "(sem assunto)"

    if html:
        msg.set_content("Abra este e-mail em um leitor compatível com HTML.")
        msg.add_alternative(corpo, subtype="html")
    else:
        msg.set_content(corpo)

    if anexo and anexo.get("bytes"):
        maintype, _, subtype = (anexo.get("mimetype") or "application/octet-stream").partition("/")
        msg.add_attachment(
            anexo["bytes"],
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=anexo.get("filename") or "anexo",
        )

    if settings.smtp_port == 465:
        server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
    try:
        if settings.smtp_port != 465 and settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    finally:
        server.quit()


async def _registrar_envio_email(conn, empresa_id, destinatario: str, assunto: str):
    await conn.execute(
        """INSERT INTO atividades (empresa_id, tipo, descricao)
           VALUES ($1, 'email_sent', $2)""",
        empresa_id,
        f"E-mail \"{assunto}\" enviado para {destinatario}",
    )


async def _obter_ou_criar_conversa(conn, empresa_id: uuid.UUID, numero: str):
    conversa = await conn.fetchrow(
        "SELECT id, empresa_id FROM conversas WHERE empresa_id = $1 AND numero_whatsapp = $2",
        empresa_id,
        numero,
    )
    if conversa:
        await conn.execute(
            "UPDATE conversas SET ultimo_contato = NOW(), status = 'ativo' WHERE id = $1",
            conversa["id"],
        )
        return conversa

    return await conn.fetchrow(
        """INSERT INTO conversas (empresa_id, numero_whatsapp, status, ultimo_contato)
           VALUES ($1, $2, 'ativo', NOW()) RETURNING id, empresa_id""",
        empresa_id,
        numero,
    )


async def _registrar_envio_texto(conn, empresa_row, numero: str, mensagem: str, result: dict):
    empresa_id = empresa_row["empresa_id"] if "empresa_id" in empresa_row else empresa_row["id"]
    conversa = await _obter_ou_criar_conversa(conn, empresa_id, numero)
    await conn.execute(
        """INSERT INTO mensagens (conversa_id, direction, tipo, conteudo, status, whatsapp_id)
           VALUES ($1, 'outbound', 'text', $2, 'sent', $3)""",
        conversa["id"],
        mensagem,
        result.get("key", {}).get("id"),
    )
    await conn.execute(
        """INSERT INTO atividades (empresa_id, tipo, descricao)
           VALUES ($1, 'whatsapp_sent', $2)""",
        empresa_id,
        f"Campanha enviada para {numero}",
    )


async def _registrar_envio_midia(conn, empresa_row, numero: str, mensagem: str, media_type: str, result: dict):
    empresa_id = empresa_row["empresa_id"] if "empresa_id" in empresa_row else empresa_row["id"]
    conversa = await _obter_ou_criar_conversa(conn, empresa_id, numero)
    await conn.execute(
        """INSERT INTO mensagens (conversa_id, direction, tipo, conteudo, status, whatsapp_id)
           VALUES ($1, 'outbound', $2, $3, 'sent', $4)""",
        conversa["id"],
        media_type,
        mensagem or "",
        result.get("key", {}).get("id"),
    )
    await conn.execute(
        """INSERT INTO atividades (empresa_id, tipo, descricao)
           VALUES ($1, 'whatsapp_sent', $2)""",
        empresa_id,
        f"Campanha com mídia enviada para {numero}",
    )


async def _enviar_texto(empresa_row, mensagem: str):
    numero = normalizar_numero(empresa_row["whatsapp"] or empresa_row["telefone"] or "")
    if not numero:
        return False, "Sem número"
    payload = {
        "number": numero,
        "text": mensagem,
        "delay": 1200,
    }
    result = await _evo_post(f"message/sendText/{settings.evolution_instance}", payload)
    return True, (numero, result)


async def _enviar_midia(empresa_row, mensagem: str, media: str, media_mimetype: str, media_filename: str, media_type: str):
    numero = normalizar_numero(empresa_row["whatsapp"] or empresa_row["telefone"] or "")
    if not numero:
        return False, "Sem número"
    payload = {
        "number": numero,
        "mediatype": media_type,
        "mimetype": media_mimetype,
        "fileName": media_filename,
        "media": media,
        "caption": mensagem or "",
        "delay": 1200,
    }
    result = await _evo_post(f"message/sendMedia/{settings.evolution_instance}", payload)
    return True, (numero, result)


def _traduzir_erro_whatsapp(erro: Exception, numero: str) -> str:
    """Converte falhas técnicas da Evolution em mensagens legíveis para a campanha."""
    detalhe = str(getattr(erro, "detail", erro))
    if '"exists":false' in detalhe or "exists\\\":false" in detalhe:
        return f"O número {numero} não possui uma conta de WhatsApp ativa."
    if "Sem número" in detalhe:
        return "Empresa sem número de WhatsApp/telefone válido."
    return detalhe or "Falha ao enviar mensagem."


def _dedup_uuids(ids) -> list:
    out, vistos = [], set()
    for raw in ids or []:
        try:
            uid = uuid.UUID(raw)
        except Exception:
            continue
        if uid in vistos:
            continue
        vistos.add(uid)
        out.append(uid)
    return out


async def _contato_destinatarios(conn, contato_ids) -> list[dict]:
    """Carrega clientes (contatos) como destinatários normalizados para disparo.
    Cada dict expõe whatsapp/telefone/email/nome/empresa_id, compatível com os
    helpers de envio (que usam acesso por chave)."""
    ids = _dedup_uuids(contato_ids)
    if not ids:
        return []
    rows = await conn.fetch(
        """SELECT c.id, c.nome, c.whatsapp, c.telefone, c.email, c.empresa_id,
                  COALESCE(e.nome_fantasia, e.nome, e.razao_social) AS empresa_nome
           FROM contatos c
           LEFT JOIN empresas e ON c.empresa_id = e.id
           WHERE c.id = ANY($1::uuid[])
           ORDER BY c.nome""",
        ids,
    )
    return [
        {
            "id": r["id"],
            "nome": r["nome"],
            "whatsapp": r["whatsapp"],
            "telefone": r["telefone"],
            "email": r["email"],
            "empresa_id": r["empresa_id"],
            "empresa_nome": r["empresa_nome"],
        }
        for r in rows
    ]


@router.get("")
async def listar_campanhas():
    conn = await get_conn()
    try:
        rows = await conn.fetch("SELECT * FROM campanhas ORDER BY created_at DESC")
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.post("")
async def criar_campanha(body: CampanhaCreate):
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            """INSERT INTO campanhas (nome, descricao, template_id, total_envios)
               VALUES ($1, $2, $3, $4) RETURNING *""",
            body.nome,
            body.descricao,
            uuid.UUID(body.template_id) if body.template_id else None,
            len(body.empresa_ids),
        )
        campanha_id = row["id"]

        for emp_id in body.empresa_ids:
            await conn.execute(
                "INSERT INTO campanha_itens (campanha_id, empresa_id) VALUES ($1, $2)",
                campanha_id,
                uuid.UUID(emp_id),
            )

        return dict(row)
    finally:
        await conn.close()


@router.post("/{campanha_id}/iniciar")
async def iniciar_campanha(campanha_id: str):
    """Inicia disparo da campanha usando template."""
    conn = await get_conn()
    try:
        campanha = await conn.fetchrow("SELECT * FROM campanhas WHERE id = $1", uuid.UUID(campanha_id))
        if not campanha:
            raise HTTPException(status_code=404, detail="Campanha não encontrada")

        template = await conn.fetchrow(
            "SELECT conteudo FROM templates WHERE id = $1", campanha["template_id"]
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template não encontrado")

        itens = await conn.fetch(
            """SELECT ci.id, e.whatsapp, e.telefone, e.nome as empresa_nome, e.id as empresa_id
               FROM campanha_itens ci JOIN empresas e ON ci.empresa_id = e.id
               WHERE ci.campanha_id = $1 AND ci.status = 'pendente'""",
            uuid.UUID(campanha_id),
        )

        await conn.execute(
            "UPDATE campanhas SET status = 'em_andamento', data_inicio = NOW() WHERE id = $1",
            uuid.UUID(campanha_id),
        )

        enviados = 0
        for item in itens:
            numero = normalizar_numero(item["whatsapp"] or item["telefone"] or "")
            if not numero:
                continue

            texto = template["conteudo"].replace("{{empresa}}", item["empresa_nome"])

            try:
                ok, payload = await _enviar_texto(item, texto)
                if not ok:
                    raise HTTPException(status_code=400, detail=str(payload))
                numero_enviado, result = payload
                await _registrar_envio_texto(conn, item, numero_enviado, texto, result)
                await conn.execute(
                    "UPDATE campanha_itens SET status = 'enviado', enviado_em = NOW() WHERE id = $1",
                    item["id"],
                )
                enviados += 1
                await asyncio.sleep(2)
            except Exception:
                await conn.execute(
                    "UPDATE campanha_itens SET status = 'erro' WHERE id = $1",
                    item["id"],
                )

        await conn.execute(
            "UPDATE campanhas SET enviados = $2, status = 'concluida', data_fim = NOW() WHERE id = $1",
            uuid.UUID(campanha_id),
            enviados,
        )

        return {"ok": True, "enviados": enviados, "total": len(itens)}
    finally:
        await conn.close()


@router.post("/disparo-rapido")
async def disparo_rapido(body: CampanhaDisparoRapido):
    """Cria uma campanha e dispara imediatamente com texto e mídia opcional."""
    usar_clientes = bool(body.contato_ids)
    if not body.empresa_ids and not body.contato_ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos um número para disparar.")
    if not (body.mensagem or "").strip() and not (body.media_url or body.media_base64):
        raise HTTPException(status_code=400, detail="Informe uma mensagem ou uma mídia para enviar.")

    media_url = (body.media_url or "").strip() or None
    media_base64 = _limpar_media_base64(body.media_base64)
    media = media_url or media_base64
    media_type = _deduzir_tipo_media(body.media_mimetype, body.media_type) if media else None
    media_filename = body.media_filename or (
        _deduzir_nome_arquivo(body.media_mimetype, media_type) if media and media_type else None
    )

    conn = await get_conn()
    try:
        if usar_clientes:
            destinatarios = await _contato_destinatarios(conn, body.contato_ids)
        else:
            empresa_ids = _dedup_uuids(body.empresa_ids)
            if not empresa_ids:
                raise HTTPException(status_code=400, detail="Nenhum destinatário válido foi selecionado.")
            rows = await conn.fetch(
                "SELECT id, nome, whatsapp, telefone, tipo FROM empresas WHERE id = ANY($1::uuid[]) ORDER BY nome",
                empresa_ids,
            )
            destinatarios = [
                {"id": r["id"], "nome": r["nome"], "whatsapp": r["whatsapp"],
                 "telefone": r["telefone"], "empresa_id": r["id"]}
                for r in rows
            ]

        if not destinatarios:
            raise HTTPException(status_code=404, detail="Nenhum destinatário encontrado.")

        campanha_nome = (body.nome or "").strip() or ("Disparo p/ clientes" if usar_clientes else "Disparo rápido")
        campanha_desc = (body.descricao or "").strip()
        if not campanha_desc:
            alvo = "cliente(s)" if usar_clientes else "número(s)"
            campanha_desc = f"Disparo para {len(destinatarios)} {alvo}"
            if media:
                campanha_desc += f" com mídia ({media_type})"

        campanha = await conn.fetchrow(
            """INSERT INTO campanhas (nome, descricao, status, total_envios, enviados)
               VALUES ($1, $2, 'em_andamento', $3, 0) RETURNING *""",
            campanha_nome,
            campanha_desc,
            len(destinatarios),
        )
        campanha_id = campanha["id"]

        # registra os itens por empresa (distintas), p/ a tela de detalhes da campanha
        empresas_itens = {d["empresa_id"] for d in destinatarios if d.get("empresa_id")}
        for emp_id in empresas_itens:
            await conn.execute(
                "INSERT INTO campanha_itens (campanha_id, empresa_id, status) VALUES ($1, $2, 'pendente')",
                campanha_id,
                emp_id,
            )

        enviados = 0
        erros = 0
        erros_detalhes = []
        for row in destinatarios:
            texto = (body.mensagem or "").replace("{{empresa}}", row["nome"]).replace("{{nome}}", row["nome"]).strip()
            emp_id = row.get("empresa_id")
            try:
                if media:
                    ok, payload = await _enviar_midia(
                        row,
                        texto,
                        media,
                        body.media_mimetype or "application/octet-stream",
                        media_filename or _deduzir_nome_arquivo(body.media_mimetype, media_type or "document"),
                        media_type or "document",
                    )
                    if not ok:
                        raise HTTPException(status_code=400, detail=str(payload))
                    numero_enviado, result = payload
                    if emp_id:
                        await _registrar_envio_midia(conn, row, numero_enviado, texto, media_type or "document", result)
                else:
                    ok, payload = await _enviar_texto(row, texto)
                    if not ok:
                        raise HTTPException(status_code=400, detail=str(payload))
                    numero_enviado, result = payload
                    if emp_id:
                        await _registrar_envio_texto(conn, row, numero_enviado, texto, result)

                enviados += 1
                if emp_id:
                    await conn.execute(
                        "UPDATE campanha_itens SET status = 'enviado', enviado_em = NOW() WHERE campanha_id = $1 AND empresa_id = $2",
                        campanha_id,
                        emp_id,
                    )
            except Exception as exc:
                erros += 1
                numero_base = normalizar_numero(row["whatsapp"] or row["telefone"] or "")
                erros_detalhes.append({
                    "empresa": row["nome"],
                    "numero": numero_base or None,
                    "erro": _traduzir_erro_whatsapp(exc, numero_base or "sem número"),
                })
                if emp_id:
                    await conn.execute(
                        "UPDATE campanha_itens SET status = 'erro' WHERE campanha_id = $1 AND empresa_id = $2",
                        campanha_id,
                        emp_id,
                    )
            await asyncio.sleep(1.5)

        await conn.execute(
            "UPDATE campanhas SET enviados = $2, status = 'concluida', data_fim = NOW() WHERE id = $1",
            campanha_id,
            enviados,
        )

        return {
            "ok": True,
            "campanha_id": str(campanha_id),
            "total": len(destinatarios),
            "enviados": enviados,
            "erros": erros,
            "erros_detalhes": erros_detalhes,
            "media": bool(media),
        }
    finally:
        await conn.close()


@router.post("/disparo-email")
async def disparo_email(body: CampanhaDisparoEmail):
    """Cria uma campanha e dispara imediatamente por e-mail (SMTP), com anexo opcional."""
    if not _smtp_configurado():
        raise HTTPException(
            status_code=400,
            detail="Configure o SMTP (SMTP_HOST e SMTP_FROM) para disparar e-mails.",
        )
    usar_clientes = bool(body.contato_ids)
    if not body.empresa_ids and not body.contato_ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos um destinatário para disparar.")
    if not (body.assunto or "").strip():
        raise HTTPException(status_code=400, detail="Informe o assunto do e-mail.")
    if not (body.mensagem or "").strip():
        raise HTTPException(status_code=400, detail="Escreva a mensagem do e-mail.")

    if not usar_clientes:
        empresa_ids = _dedup_uuids(body.empresa_ids)
        if not empresa_ids:
            raise HTTPException(status_code=400, detail="Nenhum destinatário válido foi selecionado.")

    anexo = None
    media_base64 = _limpar_media_base64(body.media_base64)
    if media_base64:
        try:
            anexo = {
                "bytes": base64.b64decode(media_base64),
                "mimetype": body.media_mimetype or "application/octet-stream",
                "filename": body.media_filename or "anexo",
            }
        except Exception:
            raise HTTPException(status_code=400, detail="Anexo inválido.")
    elif body.media_url:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(body.media_url)
            resp.raise_for_status()
            anexo = {
                "bytes": resp.content,
                "mimetype": body.media_mimetype or resp.headers.get("content-type", "application/octet-stream"),
                "filename": body.media_filename or body.media_url.rstrip("/").split("/")[-1] or "anexo",
            }
        except Exception:
            raise HTTPException(status_code=400, detail="Não foi possível baixar o anexo informado.")

    conn = await get_conn()
    try:
        if usar_clientes:
            destinatarios = await _contato_destinatarios(conn, body.contato_ids)
        else:
            rows = await conn.fetch(
                "SELECT id, nome, email FROM empresas WHERE id = ANY($1::uuid[]) ORDER BY nome",
                empresa_ids,
            )
            destinatarios = [
                {"id": r["id"], "nome": r["nome"], "email": r["email"], "empresa_id": r["id"]}
                for r in rows
            ]

        if not destinatarios:
            raise HTTPException(status_code=404, detail="Nenhum destinatário encontrado.")

        campanha_nome = (body.nome or "").strip() or "Disparo de e-mail"
        campanha_desc = (body.descricao or "").strip()
        if not campanha_desc:
            alvo = "cliente(s)" if usar_clientes else "empresa(s)"
            campanha_desc = f"E-mail para {len(destinatarios)} {alvo}"
            if anexo:
                campanha_desc += " com anexo"

        campanha = await conn.fetchrow(
            """INSERT INTO campanhas (nome, descricao, status, total_envios, enviados)
               VALUES ($1, $2, 'em_andamento', $3, 0) RETURNING *""",
            campanha_nome,
            campanha_desc,
            len(destinatarios),
        )
        campanha_id = campanha["id"]

        empresas_itens = {d["empresa_id"] for d in destinatarios if d.get("empresa_id")}
        for emp_id in empresas_itens:
            await conn.execute(
                "INSERT INTO campanha_itens (campanha_id, empresa_id, status) VALUES ($1, $2, 'pendente')",
                campanha_id,
                emp_id,
            )

        enviados = 0
        erros = 0
        sem_email = 0
        for row in destinatarios:
            emp_id = row.get("empresa_id")
            email = (row.get("email") or "").strip()
            if not email or "@" not in email:
                sem_email += 1
                continue

            assunto = (body.assunto or "").replace("{{empresa}}", row["nome"]).replace("{{nome}}", row["nome"]).strip()
            corpo = (body.mensagem or "").replace("{{empresa}}", row["nome"]).replace("{{nome}}", row["nome"])
            try:
                await asyncio.to_thread(_smtp_enviar, email, assunto, corpo, bool(body.html), anexo)
                if emp_id:
                    await _registrar_envio_email(conn, emp_id, email, assunto)
                enviados += 1
                if emp_id:
                    await conn.execute(
                        "UPDATE campanha_itens SET status = 'enviado', enviado_em = NOW() WHERE campanha_id = $1 AND empresa_id = $2",
                        campanha_id,
                        emp_id,
                    )
            except Exception:
                erros += 1
                if emp_id:
                    await conn.execute(
                        "UPDATE campanha_itens SET status = 'erro' WHERE campanha_id = $1 AND empresa_id = $2",
                        campanha_id,
                        emp_id,
                    )
            await asyncio.sleep(0.5)

        await conn.execute(
            "UPDATE campanhas SET enviados = $2, status = 'concluida', data_fim = NOW() WHERE id = $1",
            campanha_id,
            enviados,
        )

        return {
            "ok": True,
            "campanha_id": str(campanha_id),
            "canal": "email",
            "total": len(destinatarios),
            "enviados": enviados,
            "erros": erros,
            "sem_email": sem_email,
            "media": bool(anexo),
        }
    finally:
        await conn.close()


@router.get("/{campanha_id}")
async def obter_campanha(campanha_id: str):
    conn = await get_conn()
    try:
        row = await conn.fetchrow("SELECT * FROM campanhas WHERE id = $1", uuid.UUID(campanha_id))
        itens = await conn.fetch(
            """SELECT ci.*, e.nome as empresa_nome, e.whatsapp
               FROM campanha_itens ci JOIN empresas e ON ci.empresa_id = e.id
               WHERE ci.campanha_id = $1""",
            uuid.UUID(campanha_id),
        )
        return {**dict(row), "itens": [dict(i) for i in itens]}
    finally:
        await conn.close()
