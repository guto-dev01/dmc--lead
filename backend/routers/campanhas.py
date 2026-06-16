from fastapi import APIRouter, Depends, HTTPException
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

from database import settings, get_db, new_id, now, serialize
from routers.whatsapp import normalizar_numero
from services.auth import require_auth, conta_atual
from services.atividades import registrar
from services import mailer


def _autor(user) -> Optional[str]:
    return (user or {}).get("sub") if isinstance(user, dict) else None

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
    # Intervalo (em segundos) de espera entre um e-mail e o próximo. None = padrão.
    intervalo_segundos: Optional[float] = None
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
    """True se há algum caminho de envio de e-mail (API HTTP ou SMTP)."""
    return mailer.email_configurado()


def _smtp_enviar(
    destinatario: str,
    assunto: str,
    corpo: str,
    html: bool,
    anexo: Optional[dict] = None,
    remetente_email: Optional[str] = None,
    remetente_nome: Optional[str] = None,
):
    """Envia um e-mail (API HTTP ou SMTP). Bloqueante — chamar via asyncio.to_thread.

    Delega ao núcleo em ``services.mailer``: quando há provedor HTTP (Resend/Brevo)
    configurado, envia pela API HTTPS; senão, via SMTP. ``remetente_email`` (do
    usuário logado) vira o Reply-To quando difere do remetente verificado.
    """
    mailer.enviar(
        destinatario, assunto, corpo, html=html, anexo=anexo,
        remetente_email=remetente_email, remetente_nome=remetente_nome,
    )


async def _remetente_do_usuario(db, user) -> tuple[Optional[str], Optional[str]]:
    """E-mail e nome do usuário logado, para usar como remetente das campanhas.

    Retorna (None, None) quando não dá para identificar um e-mail (ex.: admin de
    ambiente, cujo login não é um e-mail) — aí o disparo cai no SMTP_FROM padrão.
    """
    sub = (user or {}).get("sub") if isinstance(user, dict) else None
    if not sub or "@" not in str(sub):
        return None, None
    email = str(sub).strip()
    # EMAIL_FROM_NOME (quando definido) fixa o nome exibido no "De:", sobrepondo
    # o nome do perfil. Senão, usa o nome do usuário logado.
    override = (settings.email_from_nome or "").strip()
    if override:
        return email, override
    usuario = await db.usuarios.find_one({"email": email.lower()}, {"nome": 1})
    nome = (usuario.get("nome") if usuario else None) or None
    return email, nome


async def _registrar_envio_email(db, empresa_id, destinatario: str, assunto: str, autor=None, conta_id=None):
    await db.atividades.insert_one({
        "_id": new_id(), "conta_id": conta_id, "empresa_id": empresa_id, "tipo": "email_sent", "autor": autor,
        "descricao": f"E-mail \"{assunto}\" enviado para {destinatario}", "created_at": now(),
    })


async def _obter_ou_criar_conversa(db, empresa_id: str, numero: str, conta_id=None) -> dict:
    conversa = await db.conversas.find_one(
        {"empresa_id": empresa_id, "numero_whatsapp": numero}, {"empresa_id": 1}
    )
    if conversa:
        await db.conversas.update_one(
            {"_id": conversa["_id"]}, {"$set": {"ultimo_contato": now(), "status": "ativo"}}
        )
        return {"id": conversa["_id"], "empresa_id": conversa.get("empresa_id")}

    doc = {
        "_id": new_id(), "conta_id": conta_id, "empresa_id": empresa_id, "numero_whatsapp": numero,
        "status": "ativo", "ultimo_contato": now(), "created_at": now(),
    }
    await db.conversas.insert_one(doc)
    return {"id": doc["_id"], "empresa_id": empresa_id}


def _empresa_id_de(row: dict):
    return row.get("empresa_id") if row.get("empresa_id") is not None else row.get("id")


async def _registrar_envio_texto(db, empresa_row, numero: str, mensagem: str, result: dict, autor=None, conta_id=None):
    empresa_id = _empresa_id_de(empresa_row)
    conversa = await _obter_ou_criar_conversa(db, empresa_id, numero, conta_id=conta_id)
    await db.mensagens.insert_one({
        "_id": new_id(), "conta_id": conta_id, "conversa_id": conversa["id"], "direction": "outbound",
        "tipo": "text", "conteudo": mensagem, "status": "sent",
        "whatsapp_id": result.get("key", {}).get("id"), "created_at": now(),
    })
    await db.atividades.insert_one({
        "_id": new_id(), "conta_id": conta_id, "empresa_id": empresa_id, "tipo": "whatsapp_sent", "autor": autor,
        "descricao": f"Campanha enviada para {numero}", "created_at": now(),
    })


async def _registrar_envio_midia(db, empresa_row, numero: str, mensagem: str, media_type: str, result: dict, autor=None, conta_id=None):
    empresa_id = _empresa_id_de(empresa_row)
    conversa = await _obter_ou_criar_conversa(db, empresa_id, numero, conta_id=conta_id)
    await db.mensagens.insert_one({
        "_id": new_id(), "conta_id": conta_id, "conversa_id": conversa["id"], "direction": "outbound",
        "tipo": media_type, "conteudo": mensagem or "", "status": "sent",
        "whatsapp_id": result.get("key", {}).get("id"), "created_at": now(),
    })
    await db.atividades.insert_one({
        "_id": new_id(), "conta_id": conta_id, "empresa_id": empresa_id, "tipo": "whatsapp_sent", "autor": autor,
        "descricao": f"Campanha com mídia enviada para {numero}", "created_at": now(),
    })


async def _enviar_texto(empresa_row, mensagem: str):
    numero = normalizar_numero(empresa_row.get("whatsapp") or empresa_row.get("telefone") or "")
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
    numero = normalizar_numero(empresa_row.get("whatsapp") or empresa_row.get("telefone") or "")
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


def _aplicar_variaveis(texto: Optional[str], row: dict) -> str:
    """Substitui as variáveis pelo dado real do destinatário.
    {{empresa}} = nome da empresa (da empresa de origem, quando a fonte é Cliente);
    {{nome}}    = nome do contato/empresa.
    """
    nome = row.get("nome") or ""
    empresa = row.get("empresa_nome") or nome
    return (texto or "").replace("{{empresa}}", empresa).replace("{{nome}}", nome)


def _dedup_ids(ids) -> list:
    out, vistos = [], set()
    for raw in ids or []:
        rid = (str(raw) if raw is not None else "").strip()
        if not rid or rid in vistos:
            continue
        vistos.add(rid)
        out.append(rid)
    return out


async def _contato_destinatarios(db, contato_ids, conta_id=None) -> list[dict]:
    """Carrega clientes (contatos) como destinatários normalizados para disparo.
    Cada dict expõe whatsapp/telefone/email/nome/empresa_id, compatível com os
    helpers de envio (que usam acesso por chave)."""
    ids = _dedup_ids(contato_ids)
    if not ids:
        return []
    filtro = {"_id": {"$in": ids}}
    if conta_id is not None:
        filtro["conta_id"] = conta_id
    contatos = await db.contatos.find(filtro).sort("nome", 1).to_list(length=None)
    emp_ids = list({c["empresa_id"] for c in contatos if c.get("empresa_id")})
    emp_map = {}
    if emp_ids:
        empresas = await db.empresas.find(
            {"_id": {"$in": emp_ids}}, {"nome": 1, "nome_fantasia": 1, "razao_social": 1}
        ).to_list(length=None)
        emp_map = {e["_id"]: e for e in empresas}
    out = []
    for c in contatos:
        e = emp_map.get(c.get("empresa_id"))
        emp_nome = (e.get("nome_fantasia") or e.get("nome") or e.get("razao_social")) if e else None
        out.append({
            "id": c["_id"], "nome": c.get("nome"), "whatsapp": c.get("whatsapp"),
            "telefone": c.get("telefone"), "email": c.get("email"),
            "empresa_id": c.get("empresa_id"), "empresa_nome": emp_nome,
        })
    return out


@router.get("")
async def listar_campanhas(conta_id: str = Depends(conta_atual)):
    db = get_db()
    rows = await db.campanhas.find({"conta_id": conta_id}).sort("created_at", -1).to_list(length=None)
    return [serialize(r) for r in rows]


@router.post("")
async def criar_campanha(body: CampanhaCreate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    doc = {
        "_id": new_id(), "conta_id": conta_id, "nome": body.nome, "descricao": body.descricao,
        "template_id": body.template_id or None, "status": "rascunho", "canal": "whatsapp",
        "total_envios": len(body.empresa_ids or []), "enviados": 0, "respondidos": 0,
        "criado_por": _autor(user), "created_at": now(),
    }
    await db.campanhas.insert_one(doc)

    for emp_id in (body.empresa_ids or []):
        await db.campanha_itens.insert_one({
            "_id": new_id(), "conta_id": conta_id, "campanha_id": doc["_id"], "empresa_id": emp_id,
            "status": "pendente",
        })

    await registrar(db, "campanha_criada", autor=_autor(user),
                    descricao=f"Campanha \"{body.nome}\" criada", conta_id=conta_id)
    return serialize(doc)


@router.post("/{campanha_id}/iniciar")
async def iniciar_campanha(campanha_id: str, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Inicia disparo da campanha usando template."""
    db = get_db()
    campanha = await db.campanhas.find_one({"_id": campanha_id, "conta_id": conta_id})
    if not campanha:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")

    template = await db.templates.find_one({"_id": campanha.get("template_id"), "conta_id": conta_id}, {"conteudo": 1})
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")

    itens_raw = await db.campanha_itens.find(
        {"campanha_id": campanha_id, "status": "pendente"}
    ).to_list(length=None)
    emp_ids = [i["empresa_id"] for i in itens_raw if i.get("empresa_id")]
    emp_map = {}
    if emp_ids:
        empresas = await db.empresas.find(
            {"_id": {"$in": emp_ids}, "conta_id": conta_id}, {"nome": 1, "whatsapp": 1, "telefone": 1}
        ).to_list(length=None)
        emp_map = {e["_id"]: e for e in empresas}
    itens = []
    for ci in itens_raw:
        e = emp_map.get(ci.get("empresa_id"))
        if not e:
            continue
        itens.append({
            "id": ci["_id"], "whatsapp": e.get("whatsapp"), "telefone": e.get("telefone"),
            "empresa_nome": e.get("nome"), "empresa_id": ci["empresa_id"],
        })

    await db.campanhas.update_one(
        {"_id": campanha_id, "conta_id": conta_id}, {"$set": {"status": "em_andamento", "data_inicio": now()}}
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
            await _registrar_envio_texto(db, item, numero_enviado, texto, result, autor=_autor(user), conta_id=conta_id)
            await db.campanha_itens.update_one(
                {"_id": item["id"]}, {"$set": {"status": "enviado", "enviado_em": now()}}
            )
            enviados += 1
            await asyncio.sleep(2)
        except Exception:
            await db.campanha_itens.update_one({"_id": item["id"]}, {"$set": {"status": "erro"}})

    await db.campanhas.update_one(
        {"_id": campanha_id, "conta_id": conta_id},
        {"$set": {"enviados": enviados, "status": "concluida", "data_fim": now()}},
    )

    return {"ok": True, "enviados": enviados, "total": len(itens)}


@router.post("/disparo-rapido")
async def disparo_rapido(body: CampanhaDisparoRapido, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
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

    db = get_db()
    if usar_clientes:
        destinatarios = await _contato_destinatarios(db, body.contato_ids, conta_id=conta_id)
    else:
        empresa_ids = _dedup_ids(body.empresa_ids)
        if not empresa_ids:
            raise HTTPException(status_code=400, detail="Nenhum destinatário válido foi selecionado.")
        rows = await db.empresas.find(
            {"_id": {"$in": empresa_ids}, "conta_id": conta_id}, {"nome": 1, "whatsapp": 1, "telefone": 1, "tipo": 1}
        ).sort("nome", 1).to_list(length=None)
        destinatarios = [
            {"id": r["_id"], "nome": r.get("nome"), "whatsapp": r.get("whatsapp"),
             "telefone": r.get("telefone"), "empresa_id": r["_id"]}
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

    campanha = {
        "_id": new_id(), "conta_id": conta_id, "nome": campanha_nome, "descricao": campanha_desc,
        "status": "em_andamento", "canal": "whatsapp", "total_envios": len(destinatarios),
        "enviados": 0, "respondidos": 0, "criado_por": _autor(user), "created_at": now(),
    }
    await db.campanhas.insert_one(campanha)
    campanha_id = campanha["_id"]
    await registrar(db, "campanha_criada", autor=_autor(user),
                    descricao=f"Campanha \"{campanha_nome}\" criada", conta_id=conta_id)

    # registra os itens por empresa (distintas), p/ a tela de detalhes da campanha
    empresas_itens = {d["empresa_id"] for d in destinatarios if d.get("empresa_id")}
    for emp_id in empresas_itens:
        await db.campanha_itens.insert_one({
            "_id": new_id(), "conta_id": conta_id, "campanha_id": campanha_id, "empresa_id": emp_id, "status": "pendente",
        })

    enviados = 0
    erros = 0
    erros_detalhes = []
    for row in destinatarios:
        texto = _aplicar_variaveis(body.mensagem, row).strip()
        emp_id = row.get("empresa_id")
        try:
            if media:
                ok, payload = await _enviar_midia(
                    row, texto, media,
                    body.media_mimetype or "application/octet-stream",
                    media_filename or _deduzir_nome_arquivo(body.media_mimetype, media_type or "document"),
                    media_type or "document",
                )
                if not ok:
                    raise HTTPException(status_code=400, detail=str(payload))
                numero_enviado, result = payload
                if emp_id:
                    await _registrar_envio_midia(db, row, numero_enviado, texto, media_type or "document", result, autor=_autor(user), conta_id=conta_id)
            else:
                ok, payload = await _enviar_texto(row, texto)
                if not ok:
                    raise HTTPException(status_code=400, detail=str(payload))
                numero_enviado, result = payload
                if emp_id:
                    await _registrar_envio_texto(db, row, numero_enviado, texto, result, autor=_autor(user), conta_id=conta_id)

            enviados += 1
            if emp_id:
                await db.campanha_itens.update_one(
                    {"campanha_id": campanha_id, "empresa_id": emp_id},
                    {"$set": {"status": "enviado", "enviado_em": now()}},
                )
        except Exception as exc:
            erros += 1
            numero_base = normalizar_numero(row.get("whatsapp") or row.get("telefone") or "")
            erros_detalhes.append({
                "empresa": row["nome"],
                "numero": numero_base or None,
                "erro": _traduzir_erro_whatsapp(exc, numero_base or "sem número"),
            })
            if emp_id:
                await db.campanha_itens.update_one(
                    {"campanha_id": campanha_id, "empresa_id": emp_id},
                    {"$set": {"status": "erro"}},
                )
        await asyncio.sleep(1.5)

    await db.campanhas.update_one(
        {"_id": campanha_id, "conta_id": conta_id},
        {"$set": {"enviados": enviados, "status": "concluida", "data_fim": now()}},
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


async def _executar_disparo_email(
    campanha_id, conta_id, destinatarios, assunto_tmpl, mensagem_tmpl, html,
    anexo, remetente_email, remetente_nome, autor, intervalo,
):
    """Envia os e-mails da campanha um a um, respeitando o intervalo entre eles.
    Roda em segundo plano (asyncio.create_task) e vai atualizando o progresso
    (campanha.enviados) e o status de cada item — para que intervalos longos não
    estourem o tempo da requisição HTTP."""
    db = get_db()
    enviados = 0
    try:
        for row in destinatarios:
            emp_id = row.get("empresa_id")
            email = (row.get("email") or "").strip()
            if not email or "@" not in email:
                continue
            assunto = _aplicar_variaveis(assunto_tmpl, row).strip()
            corpo = _aplicar_variaveis(mensagem_tmpl, row)
            try:
                await asyncio.to_thread(
                    _smtp_enviar, email, assunto, corpo, bool(html), anexo,
                    remetente_email, remetente_nome,
                )
                if emp_id:
                    await _registrar_envio_email(db, emp_id, email, assunto, autor=autor, conta_id=conta_id)
                enviados += 1
                if emp_id:
                    await db.campanha_itens.update_one(
                        {"campanha_id": campanha_id, "empresa_id": emp_id},
                        {"$set": {"status": "enviado", "enviado_em": now()}},
                    )
            except Exception:
                if emp_id:
                    await db.campanha_itens.update_one(
                        {"campanha_id": campanha_id, "empresa_id": emp_id},
                        {"$set": {"status": "erro"}},
                    )
            # progresso parcial (a tela de campanhas mostra "enviados")
            await db.campanhas.update_one(
                {"_id": campanha_id, "conta_id": conta_id}, {"$set": {"enviados": enviados}}
            )
            if intervalo > 0:
                await asyncio.sleep(intervalo)
    finally:
        await db.campanhas.update_one(
            {"_id": campanha_id, "conta_id": conta_id},
            {"$set": {"enviados": enviados, "status": "concluida", "data_fim": now()}},
        )


@router.post("/disparo-email")
async def disparo_email(body: CampanhaDisparoEmail, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Cria uma campanha e dispara imediatamente por e-mail (SMTP), com anexo opcional."""
    if not _smtp_configurado():
        raise HTTPException(
            status_code=400,
            detail="Configure o e-mail (RESEND_API_KEY/BREVO_API_KEY + EMAIL_FROM, ou SMTP_HOST + SMTP_FROM) para disparar e-mails.",
        )
    usar_clientes = bool(body.contato_ids)
    if not body.empresa_ids and not body.contato_ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos um destinatário para disparar.")
    if not (body.assunto or "").strip():
        raise HTTPException(status_code=400, detail="Informe o assunto do e-mail.")
    if not (body.mensagem or "").strip():
        raise HTTPException(status_code=400, detail="Escreva a mensagem do e-mail.")

    if not usar_clientes:
        empresa_ids = _dedup_ids(body.empresa_ids)
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

    db = get_db()
    remetente_email, remetente_nome = await _remetente_do_usuario(db, user)
    if usar_clientes:
        destinatarios = await _contato_destinatarios(db, body.contato_ids, conta_id=conta_id)
    else:
        rows = await db.empresas.find(
            {"_id": {"$in": empresa_ids}, "conta_id": conta_id}, {"nome": 1, "email": 1}
        ).sort("nome", 1).to_list(length=None)
        destinatarios = [
            {"id": r["_id"], "nome": r.get("nome"), "email": r.get("email"), "empresa_id": r["_id"]}
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

    campanha = {
        "_id": new_id(), "conta_id": conta_id, "nome": campanha_nome, "descricao": campanha_desc,
        "status": "em_andamento", "canal": "email", "total_envios": len(destinatarios),
        "enviados": 0, "respondidos": 0, "criado_por": _autor(user), "created_at": now(),
    }
    await db.campanhas.insert_one(campanha)
    campanha_id = campanha["_id"]
    await registrar(db, "campanha_criada", autor=_autor(user),
                    descricao=f"Campanha \"{campanha_nome}\" criada", conta_id=conta_id)

    empresas_itens = {d["empresa_id"] for d in destinatarios if d.get("empresa_id")}
    for emp_id in empresas_itens:
        await db.campanha_itens.insert_one({
            "_id": new_id(), "conta_id": conta_id, "campanha_id": campanha_id, "empresa_id": emp_id, "status": "pendente",
        })

    # Intervalo entre um e-mail e o próximo (segundos). Padrão 3s; teto 1h.
    intervalo = body.intervalo_segundos
    intervalo = 3.0 if intervalo is None else max(0.0, min(float(intervalo), 3600.0))

    validos = sum(1 for d in destinatarios if (d.get("email") or "").strip() and "@" in (d.get("email") or ""))
    sem_email = len(destinatarios) - validos

    # Dispara em segundo plano para suportar intervalos longos sem travar a requisição.
    asyncio.create_task(_executar_disparo_email(
        campanha_id, conta_id, destinatarios, body.assunto, body.mensagem, bool(body.html),
        anexo, remetente_email, remetente_nome, _autor(user), intervalo,
    ))

    return {
        "ok": True,
        "campanha_id": str(campanha_id),
        "canal": "email",
        "status": "em_andamento",
        "agendado": True,
        "total": len(destinatarios),
        "validos": validos,
        "enviados": 0,
        "sem_email": sem_email,
        "intervalo_segundos": intervalo,
        "tempo_estimado_segundos": int(max(0, validos - 1) * intervalo),
        "media": bool(anexo),
    }


class TesteEmail(BaseModel):
    para: str
    assunto: Optional[str] = None
    mensagem: Optional[str] = None
    html: Optional[bool] = False


@router.post("/teste-email")
async def teste_email(body: TesteEmail, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Envia UM e-mail de teste para o endereço informado, usando o assunto/mensagem
    atuais (com as variáveis preenchidas com dados de exemplo). Serve para conferir
    o SMTP e como o e-mail chega, sem criar campanha."""
    if not _smtp_configurado():
        raise HTTPException(status_code=400, detail="Configure o e-mail (RESEND_API_KEY/BREVO_API_KEY + EMAIL_FROM, ou SMTP_HOST + SMTP_FROM) para enviar e-mails.")
    para = (body.para or "").strip()
    if "@" not in para or "." not in para.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Informe um e-mail de destino válido.")

    db = get_db()
    remetente_email, remetente_nome = await _remetente_do_usuario(db, user)
    exemplo = {"nome": "Contato de Teste", "empresa_nome": "Empresa de Teste"}
    assunto = _aplicar_variaveis(body.assunto, exemplo).strip() or "Teste de e-mail — ImobPro"
    corpo = _aplicar_variaveis(body.mensagem, exemplo) or "Este é um e-mail de teste enviado pelo ImobPro."

    try:
        await asyncio.to_thread(
            _smtp_enviar, para, f"[TESTE] {assunto}", corpo, bool(body.html), None,
            remetente_email, remetente_nome,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Falha ao enviar: {exc}")

    return {"ok": True, "para": para, "remetente": remetente_email or settings.smtp_from}


@router.delete("/{campanha_id}")
async def excluir_campanha(campanha_id: str, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    db = get_db()
    campanha = await db.campanhas.find_one({"_id": campanha_id, "conta_id": conta_id}, {"nome": 1})
    if not campanha:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    await db.campanha_itens.delete_many({"campanha_id": campanha_id})
    await db.campanhas.delete_one({"_id": campanha_id, "conta_id": conta_id})
    await registrar(db, "campanha_excluida", autor=_autor(user),
                    descricao=f"Campanha \"{campanha.get('nome')}\" excluída", conta_id=conta_id)
    return {"ok": True}


@router.get("/{campanha_id}")
async def obter_campanha(campanha_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    row = await db.campanhas.find_one({"_id": campanha_id, "conta_id": conta_id})
    if not row:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    itens_raw = await db.campanha_itens.find({"campanha_id": campanha_id}).to_list(length=None)
    emp_ids = [i["empresa_id"] for i in itens_raw if i.get("empresa_id")]
    emp_map = {}
    if emp_ids:
        empresas = await db.empresas.find(
            {"_id": {"$in": emp_ids}, "conta_id": conta_id}, {"nome": 1, "whatsapp": 1}
        ).to_list(length=None)
        emp_map = {e["_id"]: e for e in empresas}
    itens = []
    for ci in itens_raw:
        d = serialize(ci)
        e = emp_map.get(ci.get("empresa_id"))
        d["empresa_nome"] = e.get("nome") if e else None
        d["whatsapp"] = e.get("whatsapp") if e else None
        itens.append(d)
    return {**serialize(row), "itens": itens}
