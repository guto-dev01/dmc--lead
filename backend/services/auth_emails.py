"""Modelos de e-mail e páginas de confirmação dos fluxos de conta.

Os e-mails usam HTML com estilos inline (compatível com a maioria dos leitores)
e seguem a identidade do ImobPro: cabeçalho escuro com a marca e acento ciano.
As páginas de resultado (abertas no navegador ao clicar nos links) seguem o
mesmo visual escuro da tela de login.
"""
from html import escape

_MARCA = "IMOBPRO"
_RODAPE = "Complexo DMC · Prospecção imobiliária"


def _email_layout(titulo: str, corpo_html: str) -> str:
    """Casca comum dos e-mails: cabeçalho com a marca + cartão de conteúdo."""
    return f"""\
<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#eef2f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f4;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.10);">
        <tr>
          <td style="background:linear-gradient(120deg,#0a1418,#06262b);padding:22px 28px;">
            <span style="color:#00ff6a;font-weight:800;letter-spacing:0.32em;font-size:15px;">{_MARCA}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px 12px 28px;">
            <h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.3;color:#0f172a;">{escape(titulo)}</h1>
            {corpo_html}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 26px 28px;border-top:1px solid #eef2f4;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">{_RODAPE}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _botao(label: str, href: str, cor: str = "#0ea5b7") -> str:
    return (
        f'<a href="{escape(href, quote=True)}" '
        f'style="display:inline-block;background:{cor};color:#ffffff;text-decoration:none;'
        f'font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">{escape(label)}</a>'
    )


# ---------------------------------------------------------------------------
# E-mails
# ---------------------------------------------------------------------------

def email_nova_solicitacao(nome: str, email: str, data_str: str,
                           link_aprovar: str, link_recusar: str) -> str:
    corpo = f"""\
            <p style="margin:0 0 16px 0;font-size:15px;color:#334155;line-height:1.6;">
              Um novo usuário solicitou cadastro como dono no sistema. Revise os dados e decida o acesso:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:10px;margin:0 0 22px 0;">
              <tr><td style="padding:14px 16px;font-size:14px;color:#0f172a;">
                <strong>Nome:</strong> {escape(nome)}<br/>
                <strong>E-mail:</strong> {escape(email)}<br/>
                <strong>Data da solicitação:</strong> {escape(data_str)}
              </td></tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:12px;">{_botao("Aprovar acesso", link_aprovar, "#16a34a")}</td>
              <td>{_botao("Recusar acesso", link_recusar, "#dc2626")}</td>
            </tr></table>
            <p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Por segurança, estes links expiram em alguns dias e só podem ser usados uma vez.
              Se você não reconhece esta solicitação, basta recusar.
            </p>"""
    return _email_layout("Nova solicitação de cadastro no sistema", corpo)


def email_acesso_aprovado(nome: str, link_login: str) -> str:
    corpo = f"""\
            <p style="margin:0 0 16px 0;font-size:15px;color:#334155;line-height:1.6;">
              Olá, {escape(nome)}! Seu acesso ao sistema foi aprovado. Você já pode entrar com o
              e-mail e a senha que cadastrou.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td>{_botao("Acessar o sistema", link_login)}</td>
            </tr></table>"""
    return _email_layout("Seu acesso foi aprovado", corpo)


def email_definir_senha(nome: str, link: str, papel: str = "colaborador") -> str:
    saudacao = f"Olá, {escape(nome)}! " if nome else ""
    corpo = f"""\
            <p style="margin:0 0 16px 0;font-size:15px;color:#334155;line-height:1.6;">
              {saudacao}Você foi adicionado ao sistema como {escape(papel)}. Para ativar seu acesso,
              defina uma senha clicando no botão abaixo:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td>{_botao("Definir minha senha", link)}</td>
            </tr></table>
            <p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Este link é válido por 1 hora e só pode ser usado uma vez. Depois de definir a senha,
              você entra no sistema com o seu e-mail.
            </p>"""
    return _email_layout("Bem-vindo ao sistema — defina sua senha", corpo)


def email_nova_tarefa(nome: str, titulo: str, descricao: str, prioridade: str,
                      vencimento: str, atribuido_por: str, link_login: str) -> str:
    """Aviso enviado ao responsável quando uma tarefa é atribuída a ele."""
    saudacao = f"Olá, {escape(nome)}! " if nome else ""
    desc_html = ""
    if (descricao or "").strip():
        desc_html = (
            '<p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">Descrição</p>'
            f'<p style="margin:0 0 18px 0;font-size:14px;color:#334155;line-height:1.6;white-space:pre-line;">{escape(descricao)}</p>'
        )
    corpo = f"""\
            <p style="margin:0 0 16px 0;font-size:15px;color:#334155;line-height:1.6;">
              {saudacao}Uma nova tarefa foi atribuída a você por {escape(atribuido_por)}.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:10px;margin:0 0 18px 0;">
              <tr><td style="padding:14px 16px;font-size:14px;color:#0f172a;line-height:1.7;">
                <strong>Tarefa:</strong> {escape(titulo)}<br/>
                <strong>Prioridade:</strong> {escape(prioridade)}<br/>
                <strong>Prazo:</strong> {escape(vencimento)}
              </td></tr>
            </table>
            {desc_html}
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td>{_botao("Abrir o sistema", link_login)}</td>
            </tr></table>
            <p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Acesse o sistema com o seu e-mail e abra a página <strong>Tarefas</strong> para ver os detalhes.
            </p>"""
    return _email_layout("Você recebeu uma nova tarefa", corpo)


def email_redefinir_senha(nome: str, link_reset: str) -> str:
    saudacao = f"Olá, {escape(nome)}! " if nome else ""
    corpo = f"""\
            <p style="margin:0 0 16px 0;font-size:15px;color:#334155;line-height:1.6;">
              {saudacao}Recebemos uma solicitação para redefinir a senha da sua conta.
              Clique no botão abaixo para criar uma nova senha:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td>{_botao("Redefinir senha", link_reset)}</td>
            </tr></table>
            <p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Este link é válido por 1 hora e só pode ser usado uma vez. Se você não fez esta
              solicitação, ignore este e-mail — sua senha atual continua válida.
            </p>"""
    return _email_layout("Redefinição de senha", corpo)


# ---------------------------------------------------------------------------
# Página de resultado (aberta no navegador ao aprovar/recusar)
# ---------------------------------------------------------------------------

def pagina_resultado(titulo: str, mensagem: str, sucesso: bool = True) -> str:
    cor = "#00ff6a" if sucesso else "#f87171"
    icone = "✓" if sucesso else "!"
    return f"""\
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>{escape(titulo)} · {_MARCA}</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
             background:linear-gradient(180deg,#0a1418,#04090b);font-family:Arial,Helvetica,sans-serif;padding:24px;">
  <div style="width:100%;max-width:440px;background:rgba(13,24,28,0.85);border:1px solid rgba(255,255,255,0.08);
              border-radius:20px;padding:40px 32px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,0.6);">
    <div style="width:64px;height:64px;margin:0 auto 22px auto;border-radius:18px;display:flex;align-items:center;
                justify-content:center;font-size:30px;font-weight:800;color:#06262b;background:{cor};">{icone}</div>
    <span style="color:#00ff6a;font-weight:800;letter-spacing:0.32em;font-size:13px;">{_MARCA}</span>
    <h1 style="margin:14px 0 10px 0;font-size:21px;color:#ffffff;">{escape(titulo)}</h1>
    <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.6;">{escape(mensagem)}</p>
  </div>
</body>
</html>"""
