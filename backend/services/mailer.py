"""Envio de e-mail (transacional + núcleo compartilhado pelas campanhas).

Dois caminhos de envio, escolhidos automaticamente:

- **API HTTP (Resend ou Brevo)** — usa a porta 443 (HTTPS). Necessário em hosts
  que bloqueiam SMTP de saída, como o Railway nos planos Free/Trial/Hobby. É
  usado quando ``RESEND_API_KEY`` ou ``BREVO_API_KEY`` está definido.
- **SMTP (smtplib)** — usado quando nenhum provedor HTTP está configurado
  (ex.: desenvolvimento local com Gmail "Senha de app").

Reutiliza as configurações de SMTP já existentes (SMTP_HOST, SMTP_PORT, ...).
"""
import base64
import smtplib
from email.message import EmailMessage
from typing import Optional

import httpx

from database import settings


def _http_provider() -> Optional[str]:
    """Qual provedor de e-mail por API HTTP está configurado (ou None)."""
    if settings.resend_api_key:
        return "resend"
    if settings.brevo_api_key:
        return "brevo"
    return None


def _from_email() -> str:
    """Remetente verificado usado no caminho HTTP. Resend exige um domínio
    verificado; Brevo, um remetente verificado. Use EMAIL_FROM; cai no SMTP_FROM."""
    return (settings.email_from or settings.smtp_from or "").strip()


def smtp_configurado() -> bool:
    """True se o SMTP (puro) está configurado."""
    return bool(settings.smtp_host and settings.smtp_from)


def email_configurado() -> bool:
    """True se dá para enviar e-mail por qualquer caminho (API HTTP ou SMTP)."""
    if _http_provider():
        return bool(_from_email())
    return smtp_configurado()


def provider_ativo() -> Optional[str]:
    """Caminho de envio que será usado: 'resend' | 'brevo' | 'smtp' | None."""
    p = _http_provider()
    if p and _from_email():
        return p
    return "smtp" if smtp_configurado() else None


def _enviar_http(provider: str, destinatario: str, assunto: str, corpo: str,
                 html: bool, anexo: Optional[dict], de_email: str,
                 de_nome: Optional[str], reply_to: Optional[str]) -> None:
    assunto = assunto or "(sem assunto)"
    conteudo = corpo or ""
    anexo_b64 = None
    if anexo and anexo.get("bytes"):
        anexo_b64 = base64.b64encode(anexo["bytes"]).decode("ascii")
    anexo_nome = (anexo or {}).get("filename") or "anexo"

    if provider == "resend":
        payload = {
            "from": f"{de_nome} <{de_email}>" if de_nome else de_email,
            "to": [destinatario],
            "subject": assunto,
            ("html" if html else "text"): conteudo,
        }
        if reply_to:
            payload["reply_to"] = reply_to
        if anexo_b64:
            payload["attachments"] = [{"filename": anexo_nome, "content": anexo_b64}]
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload, timeout=30,
        )
    else:  # brevo
        payload = {
            "sender": ({"email": de_email, "name": de_nome} if de_nome else {"email": de_email}),
            "to": [{"email": destinatario}],
            "subject": assunto,
            ("htmlContent" if html else "textContent"): conteudo,
        }
        if reply_to:
            payload["replyTo"] = {"email": reply_to}
        if anexo_b64:
            payload["attachment"] = [{"name": anexo_nome, "content": anexo_b64}]
        resp = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.brevo_api_key, "accept": "application/json"},
            json=payload, timeout=30,
        )

    if resp.status_code >= 300:
        raise RuntimeError(f"{provider} retornou HTTP {resp.status_code}: {resp.text[:300]}")


def _enviar_smtp(destinatario: str, assunto: str, corpo: str, html: bool,
                 anexo: Optional[dict], de_email: str, de_nome: Optional[str],
                 reply_to: Optional[str]) -> None:
    msg = EmailMessage()
    msg["From"] = f"{de_nome} <{de_email}>" if de_nome else de_email
    if reply_to:
        msg["Reply-To"] = reply_to
    msg["To"] = destinatario
    msg["Subject"] = assunto or "(sem assunto)"

    if html:
        msg.set_content("Abra este e-mail em um leitor compatível com HTML.")
        msg.add_alternative(corpo or "", subtype="html")
    else:
        msg.set_content(corpo or "")

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
        # Envelope (MAIL FROM) = SMTP_FROM autenticado, mantendo SPF/DKIM válidos.
        server.send_message(msg, from_addr=(settings.smtp_from or de_email or None))
    finally:
        server.quit()


def enviar(destinatario: str, assunto: str, corpo: str, html: bool = True,
           anexo: Optional[dict] = None, remetente_email: Optional[str] = None,
           remetente_nome: Optional[str] = None) -> None:
    """Núcleo de envio. Bloqueante — chamar via ``asyncio.to_thread``.

    Roteia para a API HTTP (Resend/Brevo) quando configurada, senão para SMTP.
    Quando ``remetente_email`` (e-mail do usuário logado) difere do remetente
    verificado, ele vira o **Reply-To**: o "De:" continua sendo um endereço
    verificado (exigência das APIs e do SPF/DKIM), mas as respostas chegam a
    quem disparou.
    """
    if not email_configurado():
        raise RuntimeError(
            "E-mail não configurado: defina RESEND_API_KEY ou BREVO_API_KEY (com EMAIL_FROM), "
            "ou SMTP_HOST e SMTP_FROM."
        )

    de_nome = (remetente_nome or "").strip() or settings.smtp_from_nome
    remetente_email = (remetente_email or "").strip() or None
    provider = _http_provider()

    if provider and _from_email():
        de_email = _from_email()
        reply_to = remetente_email if (remetente_email and remetente_email.lower() != de_email.lower()) else None
        _enviar_http(provider, destinatario, assunto, corpo, html, anexo, de_email, de_nome, reply_to)
    else:
        # SMTP: o "De:" visível pode ser o e-mail do usuário logado (comportamento
        # legado), com Reply-To quando ele difere do SMTP_FROM.
        de_email = remetente_email or settings.smtp_from
        reply_to = remetente_email if (remetente_email and remetente_email.lower() != (settings.smtp_from or "").strip().lower()) else None
        _enviar_smtp(destinatario, assunto, corpo, html, anexo, de_email, de_nome, reply_to)


def enviar_email(destinatario: str, assunto: str, corpo_html: str) -> None:
    """Envia um e-mail em HTML (transacional). Bloqueante — usar via asyncio.to_thread."""
    enviar(destinatario, assunto, corpo_html, html=True)
