"""Envio de e-mail transacional (cadastro/aprovação/redefinição de senha).

Reutiliza exatamente as mesmas configurações de SMTP já usadas pelas campanhas
(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, ...). Mantido em um
módulo separado para não interferir no fluxo de campanhas existente.
"""
import smtplib
from email.message import EmailMessage

from database import settings


def smtp_configurado() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def enviar_email(destinatario: str, assunto: str, corpo_html: str) -> None:
    """Envia um e-mail em HTML. Bloqueante — chamar via asyncio.to_thread."""
    if not smtp_configurado():
        raise RuntimeError("SMTP não configurado (defina SMTP_HOST e SMTP_FROM).")

    msg = EmailMessage()
    remetente = settings.smtp_from
    if settings.smtp_from_nome:
        remetente = f"{settings.smtp_from_nome} <{settings.smtp_from}>"
    msg["From"] = remetente
    msg["To"] = destinatario
    msg["Subject"] = assunto or "(sem assunto)"
    msg.set_content("Abra este e-mail em um leitor compatível com HTML.")
    msg.add_alternative(corpo_html, subtype="html")

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
