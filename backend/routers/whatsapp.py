from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx, re
from database import settings, get_db, new_id, now, serialize
from services.auth import require_auth, conta_atual


def _autor(user) -> Optional[str]:
    return (user or {}).get("sub") if isinstance(user, dict) else None


router = APIRouter()
webhook_router = APIRouter()


def inst(instance: Optional[str]) -> str:
    """Resolve o nome da instância: usa o informado ou cai no padrão das configs."""
    nome = (instance or "").strip()
    return nome or settings.evolution_instance


def sanitizar_nome_instancia(nome: str) -> str:
    """Normaliza o nome de uma conta de WhatsApp (slug seguro p/ a Evolution)."""
    base = (nome or "").strip().lower()
    base = re.sub(r"[^a-z0-9_-]+", "-", base).strip("-_")
    return base[:40]


def evo_headers():
    return {
        "apikey": settings.evolution_api_key,
        "Content-Type": "application/json",
    }

async def evo_post(path: str, payload: dict):
    url = f"{settings.evolution_api_url}/{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=payload, headers=evo_headers())
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=r.status_code, detail=f"Evolution API: {r.text}")
        return r.json()

async def evo_get(path: str):
    url = f"{settings.evolution_api_url}/{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=evo_headers())
        return r.json()


def normalizar_numero(numero: str) -> str:
    """Extrai so os digitos do numero/JID e garante DDI 55 (Brasil)."""
    base = (numero or "").split("@")[0]           # remove sufixo do JID (@s.whatsapp.net, @g.us, etc.)
    n = "".join(ch for ch in base if ch.isdigit())  # mantem somente digitos
    if n and not n.startswith("55") and len(n) <= 11:
        n = "55" + n
    return n[:20]


def jid_de_usuario(remote_jid: str) -> bool:
    """True somente para conversas individuais (ignora grupo/status/broadcast/newsletter).

    Aceita tambem o formato novo do WhatsApp '@lid' (Linked Identity), usado por
    contatos que migraram p/ o endereco oculto. Rejeita grupos (@g.us), status,
    broadcast e newsletters (@newsletter).
    """
    jid = (remote_jid or "").lower()
    if not jid:
        return False
    if jid.endswith("@g.us") or jid.endswith("@broadcast") or jid.endswith("@newsletter"):
        return False
    if jid.startswith("status@"):
        return False
    return jid.endswith("@s.whatsapp.net") or jid.endswith("@lid") or "@" not in jid


def so_digitos(valor: str) -> str:
    """Mantem apenas digitos da parte anterior ao @ (LID ou numero)."""
    base = (valor or "").split("@")[0]
    return "".join(ch for ch in base if ch.isdigit())


def identidade_remetente(key: dict, msg: dict) -> tuple:
    """Extrai (numero_telefone, lid) de uma mensagem recebida.

    No WhatsApp com LID o remoteJid vem como '{lid}@lid' e o telefone real
    chega num campo alternativo ('remoteJidAlt'/'senderPn') a partir da
    Evolution v2.3+. Em versoes antigas (v2.1.x) o telefone nao vem e so
    temos o LID — nesse caso a conversa e identificada pelo proprio LID.
    """
    key = key or {}
    msg = msg or {}
    remote_jid = (key.get("remoteJid") or "").lower()

    # telefone real, quando a Evolution fornece (v2.3+)
    phone_jid = (
        key.get("remoteJidAlt")
        or key.get("senderPn")
        or msg.get("senderPn")
        or ""
    )
    if remote_jid.endswith("@s.whatsapp.net") or ("@" not in remote_jid and remote_jid):
        phone_jid = phone_jid or remote_jid

    numero_phone = normalizar_numero(phone_jid) if phone_jid else ""
    # so considera telefone valido se tiver tamanho de telefone (evita confundir com LID)
    if len(so_digitos(numero_phone)) < 12:
        numero_phone = ""

    lid = so_digitos(remote_jid) if remote_jid.endswith("@lid") else ""
    return numero_phone, lid


def variantes_numero(n: str) -> list:
    """Gera variantes do numero p/ casar o 9o digito brasileiro (com e sem o 9)."""
    n = "".join(ch for ch in (n or "") if ch.isdigit())
    variantes = {n}
    if n.startswith("55"):
        resto = n[2:]                      # DDD + numero
        if len(resto) == 11 and resto[2] == "9":   # 11 digitos: tira o 9
            variantes.add("55" + resto[:2] + resto[3:])
        elif len(resto) == 10:                       # 10 digitos: poe o 9
            variantes.add("55" + resto[:2] + "9" + resto[2:])
    return [v[:20] for v in variantes if v]


class EnviarMensagem(BaseModel):
    numero: str
    mensagem: str
    empresa_id: Optional[str] = None
    conversa_id: Optional[str] = None
    contato_id: Optional[str] = None
    instance: Optional[str] = None

class EnviarTemplate(BaseModel):
    empresa_id: str
    numero: str
    template_id: str
    variaveis: Optional[dict] = {}
    contato_id: Optional[str] = None


async def _garantir_instancia(instance_name: str) -> dict:
    """Cria (ou garante) uma instância na Evolution já com o webhook p/ o backend."""
    payload = {
        "instanceName": instance_name,
        "integration": "WHATSAPP-BAILEYS",
        "qrcode": True,
        "webhook": {
            "url": settings.webhook_url,
            "byEvents": False,
            "base64": True,
            "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
    }
    url = f"{settings.evolution_api_url}/instance/create"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=payload, headers=evo_headers())
    # 403 = instância já existe; nesse caso só (re)configura o webhook
    if r.status_code in (200, 201):
        return {"ok": True, "criada": True, "instancia": instance_name, "result": r.json()}
    if r.status_code == 403:
        await configurar_webhook(instance_name)
        return {"ok": True, "criada": False, "instancia": instance_name,
                "detail": "Instância já existia; webhook reconfigurado."}
    raise HTTPException(status_code=r.status_code, detail=f"Evolution API: {r.text}")


@router.post("/instancia")
async def criar_instancia(instance: Optional[str] = None):
    """Cria (ou garante) a instância na Evolution já com o webhook apontado p/ o backend."""
    return await _garantir_instancia(inst(instance))


@router.post("/webhook-config")
async def configurar_webhook(instance: Optional[str] = None):
    """(Re)configura o webhook da instância para o backend."""
    payload = {
        "webhook": {
            "enabled": True,
            "url": settings.webhook_url,
            "byEvents": False,
            "base64": True,
            "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        }
    }
    return await evo_post(f"webhook/set/{inst(instance)}", payload)


@router.get("/status")
async def status_whatsapp(instance: Optional[str] = None):
    """Verifica status da conexão WhatsApp"""
    try:
        data = await evo_get(f"instance/connectionState/{inst(instance)}")
        return data
    except Exception as e:
        return {"state": "disconnected", "error": str(e)}


@router.get("/qrcode")
async def gerar_qrcode(instance: Optional[str] = None):
    """Gera QR Code para conectar WhatsApp"""
    try:
        data = await evo_get(f"instance/connect/{inst(instance)}")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────── Contas de WhatsApp (multi-instância) ─────────────────────────

class NovaConta(BaseModel):
    nome: str


def _normalizar_conta(item: dict) -> dict:
    """Normaliza um item de instância vindo da Evolution (v1/v2) p/ um formato estável."""
    item = item or {}
    interno = item.get("instance") if isinstance(item.get("instance"), dict) else item
    nome = (
        interno.get("name")
        or interno.get("instanceName")
        or interno.get("instance")
        or ""
    )
    estado = (
        interno.get("connectionStatus")
        or interno.get("state")
        or interno.get("status")
        or "close"
    )
    return {
        "nome": nome,
        "estado": estado,
        "conectado": estado in ("open", "connected"),
        "padrao": nome == settings.evolution_instance,
    }


@router.get("/instancias")
async def listar_instancias():
    """Lista todas as contas (instâncias) de WhatsApp cadastradas na Evolution."""
    try:
        data = await evo_get("instance/fetchInstances")
    except Exception as e:
        return {"items": [], "error": str(e)}

    bruto = data if isinstance(data, list) else data.get("instances") or data.get("data") or []
    contas = [_normalizar_conta(it) for it in bruto if isinstance(it, dict)]
    contas = [c for c in contas if c["nome"]]

    # garante que a instância padrão sempre apareça, mesmo que ainda não exista
    if not any(c["padrao"] for c in contas):
        contas.insert(0, {
            "nome": settings.evolution_instance,
            "estado": "close",
            "conectado": False,
            "padrao": True,
        })
    contas.sort(key=lambda c: (not c["padrao"], c["nome"].lower()))
    return {"items": contas}


@router.post("/instancias")
async def adicionar_instancia(body: NovaConta):
    """Cria uma nova conta de WhatsApp (instância) na Evolution."""
    nome = sanitizar_nome_instancia(body.nome)
    if not nome:
        raise HTTPException(status_code=400, detail="Informe um nome válido para a conta.")
    resultado = await _garantir_instancia(nome)
    return {"ok": True, "instancia": nome, **resultado}


@router.delete("/instancias/{nome}")
async def remover_instancia(nome: str):
    """Desconecta e remove uma conta de WhatsApp (instância) da Evolution."""
    alvo = sanitizar_nome_instancia(nome)
    if not alvo:
        raise HTTPException(status_code=400, detail="Conta inválida.")
    if alvo == settings.evolution_instance:
        raise HTTPException(status_code=400, detail="A conta padrão não pode ser removida.")
    async with httpx.AsyncClient(timeout=30) as client:
        # logout (ignora erro se já estiver desconectada) e depois delete
        await client.delete(f"{settings.evolution_api_url}/instance/logout/{alvo}", headers=evo_headers())
        r = await client.delete(f"{settings.evolution_api_url}/instance/delete/{alvo}", headers=evo_headers())
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=r.status_code, detail=f"Evolution API: {r.text}")
    return {"ok": True, "removida": alvo}


@router.post("/enviar")
async def enviar_mensagem(body: EnviarMensagem, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Envia mensagem de texto via WhatsApp"""
    numero = normalizar_numero(body.numero)

    # Valida o numero antes de chamar a Evolution (evita erro tecnico cru)
    digitos = "".join(ch for ch in numero if ch.isdigit())
    if len(digitos) < 12 or len(digitos) > 13:
        raise HTTPException(
            status_code=400,
            detail="Número de WhatsApp inválido ou não informado. Use o formato com DDD, ex: (11) 99999-9999.",
        )

    if not (body.mensagem or "").strip():
        raise HTTPException(status_code=400, detail="A mensagem está vazia.")

    # Formato Evolution API v2: payload "flat" (sem options/textMessage)
    payload = {
        "number": numero,
        "text": body.mensagem,
        "delay": 1200,
    }

    try:
        result = await evo_post(f"message/sendText/{inst(body.instance)}", payload)
    except HTTPException as e:
        # Traduz o erro "numero nao existe no WhatsApp" da Evolution
        detalhe = str(e.detail)
        if '"exists":false' in detalhe or "exists\\\":false" in detalhe:
            raise HTTPException(
                status_code=400,
                detail=f"O número {numero} não possui uma conta de WhatsApp ativa.",
            )
        raise

    # Gravação de conversa/mensagem desativada por opção do usuário: o WhatsApp
    # é enviado normalmente, mas o conteúdo NÃO fica salvo no banco do ImobPro.
    # Mantemos apenas o log de atividade (produtividade), que registra o número
    # de destino — sem guardar o texto da mensagem.
    db = get_db()
    await db.atividades.insert_one({
        "_id": new_id(), "conta_id": conta_id, "empresa_id": body.empresa_id or None, "tipo": "whatsapp_sent",
        "autor": _autor(user), "descricao": f"Mensagem enviada para {numero}", "created_at": now(),
    })
    return {"ok": True, "conversa_id": None, "result": result}


@router.post("/enviar-template")
async def enviar_template(body: EnviarTemplate, user=Depends(require_auth), conta_id: str = Depends(conta_atual)):
    """Envia mensagem usando template com variáveis"""
    db = get_db()
    tmpl = await db.templates.find_one({"_id": body.template_id, "conta_id": conta_id})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")

    texto = tmpl["conteudo"]
    for k, v in (body.variaveis or {}).items():
        texto = texto.replace(f"{{{{{k}}}}}", str(v))

    # Reutiliza endpoint de envio
    return await enviar_mensagem(EnviarMensagem(
        empresa_id=body.empresa_id,
        numero=body.numero,
        mensagem=texto,
        contato_id=body.contato_id,
    ), user=user, conta_id=conta_id)


async def _resumo_conversa(db, cv: dict) -> dict:
    """Monta o resumo de uma conversa (última mensagem, contagens, nomes)."""
    cid = cv["_id"]
    total = await db.mensagens.count_documents({"conversa_id": cid})
    ultima = await db.mensagens.find({"conversa_id": cid}).sort("created_at", -1).limit(1).to_list(length=1)
    ultima = ultima[0] if ultima else None
    nao_lidas = await db.mensagens.count_documents(
        {"conversa_id": cid, "direction": "inbound", "status": "received"}
    )
    empresa = await db.empresas.find_one({"_id": cv.get("empresa_id")}, {"nome": 1}) if cv.get("empresa_id") else None
    contato = await db.contatos.find_one({"_id": cv.get("contato_id")}, {"nome": 1}) if cv.get("contato_id") else None
    empresa_nome = empresa.get("nome") if empresa else None
    contato_nome = contato.get("nome") if contato else None
    return {
        "id": cid,
        "numero_whatsapp": cv.get("numero_whatsapp"),
        "empresa_id": cv.get("empresa_id"),
        "contato_id": cv.get("contato_id"),
        "status": cv.get("status"),
        "ultimo_contato": cv.get("ultimo_contato"),
        "empresa_nome": empresa_nome,
        "contato_nome": contato_nome,
        "nome_exibicao": contato_nome or empresa_nome or cv.get("numero_whatsapp"),
        "total_mensagens": total,
        "ultima_mensagem": ultima.get("conteudo") if ultima else None,
        "ultima_direcao": ultima.get("direction") if ultima else None,
        "nao_lidas": nao_lidas,
    }


@router.get("/inbox")
async def inbox(conta_id: str = Depends(conta_atual)):
    """Lista TODAS as conversas (espelho do WhatsApp) com ultima mensagem e nao lidas."""
    db = get_db()
    conversas = await db.conversas.find({"conta_id": conta_id}).sort("ultimo_contato", -1).to_list(length=None)
    return [await _resumo_conversa(db, cv) for cv in conversas]


@router.post("/conversas/{conversa_id}/ler")
async def marcar_lida(conversa_id: str, conta_id: str = Depends(conta_atual)):
    """Marca as mensagens recebidas de uma conversa como lidas."""
    db = get_db()
    await db.mensagens.update_many(
        {"conversa_id": conversa_id, "conta_id": conta_id, "direction": "inbound", "status": "received"},
        {"$set": {"status": "read"}},
    )
    return {"ok": True}


@router.get("/conversas/{empresa_id}")
async def listar_conversas(empresa_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    conversas = await db.conversas.find({"empresa_id": empresa_id, "conta_id": conta_id}).sort("ultimo_contato", -1).to_list(length=None)
    out = []
    for cv in conversas:
        d = serialize(cv)
        d["total_mensagens"] = await db.mensagens.count_documents({"conversa_id": d["id"]})
        ultima = await db.mensagens.find({"conversa_id": d["id"]}).sort("created_at", -1).limit(1).to_list(length=1)
        d["ultima_mensagem"] = ultima[0]["conteudo"] if ultima else None
        out.append(d)
    return out


@router.get("/mensagens/{conversa_id}")
async def listar_mensagens(conversa_id: str, conta_id: str = Depends(conta_atual)):
    db = get_db()
    rows = await db.mensagens.find({"conversa_id": conversa_id, "conta_id": conta_id}).sort("created_at", 1).to_list(length=None)
    return [serialize(r) for r in rows]


@webhook_router.post("/webhook")
async def webhook_evolution(payload: dict):
    """Recebe webhooks da Evolution API.

    Gravação desativada por opção do usuário: as conversas e mensagens do
    WhatsApp NÃO são mais armazenadas no banco do ImobPro. Apenas confirmamos
    o recebimento para a Evolution não reenfileirar o evento.
    """
    return {"ok": True}
