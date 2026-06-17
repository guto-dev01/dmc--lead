"""Auditoria completa de ações — registra TUDO que cada usuário faz no sistema.

Diferente de `db.atividades` (eventos de negócio usados para medir produtividade),
aqui guardamos, via middleware, CADA requisição que altera dados (POST/PUT/PATCH/
DELETE) feita por um usuário autenticado. É o "registro completo" que o gestor usa
para ver, em ordem cronológica, cada detalhe do que um colaborador fez — inclusive
edições, exclusões e ações que não entram em nenhum indicador de produtividade.

O corpo das requisições NÃO é lido (evita interferir no processamento e não guarda
dados sensíveis): registramos o método, o caminho, um rótulo amigável da ação e o
status da resposta. O autor e a conta vêm do próprio token (sem custo de I/O extra).
"""
import re
from typing import Optional

from database import get_db, new_id, now
from services.auth import verify_access_token

# Só requisições que ESCREVEM são auditadas (GET/HEAD/OPTIONS não alteram dados).
_METODOS_ESCRITA = {"POST", "PUT", "PATCH", "DELETE"}

# Verbo genérico (fallback) quando o caminho não tem um rótulo específico.
_VERBO = {"POST": "Registrou", "PUT": "Atualizou", "PATCH": "Editou", "DELETE": "Excluiu"}

# Nome amigável do módulo (2º segmento do caminho: /api/<modulo>/...).
_RECURSO_LABEL = {
    "empresas": "Empresas", "decisores": "Decisores", "campanhas": "Campanhas",
    "templates": "Templates", "tarefas": "Tarefas", "whatsapp": "WhatsApp",
    "mercado": "Mercado", "dmc": "Complexo DMC", "equipes": "Equipes",
    "cnpj": "Receita Federal", "config": "Configurações", "dashboard": "Dashboard",
}

# Rótulos específicos por (método, caminho). A primeira regra que casa vence —
# por isso as mais específicas vêm antes das genéricas do mesmo recurso.
_REGRAS = [
    ("POST",   r"^/api/empresas$", "Cadastrou uma empresa"),
    ("POST",   r"^/api/empresas/geocodificar$", "Geocodificou empresas"),
    ("POST",   r"^/api/empresas/discover-whatsapp-all$", "Descobriu WhatsApp em lote"),
    ("POST",   r"^/api/empresas/discover-email-all$", "Descobriu e-mails em lote"),
    ("POST",   r"^/api/empresas/enrich-all$", "Enriqueceu empresas em lote"),
    ("POST",   r"^/api/empresas/[^/]+/enrich-cnpj$", "Enriqueceu empresa pela Receita (CNPJ)"),
    ("POST",   r"^/api/empresas/[^/]+/enrich-auto$", "Enriquecimento automático da empresa"),
    ("POST",   r"^/api/empresas/[^/]+/discover-whatsapp$", "Descobriu o WhatsApp da empresa"),
    ("POST",   r"^/api/empresas/[^/]+/discover-email$", "Descobriu o e-mail da empresa"),
    ("PATCH",  r"^/api/empresas/[^/]+$", "Editou uma empresa"),
    ("DELETE", r"^/api/empresas/[^/]+$", "Excluiu uma empresa"),

    ("POST",   r"^/api/decisores/pesquisar$", "Pesquisou decisores (sócios/diretores)"),
    ("POST",   r"^/api/decisores/contato/buscar-massa$", "Buscou contatos em massa"),
    ("POST",   r"^/api/decisores/contato/buscar$", "Buscou contato (e-mail/telefone)"),
    ("POST",   r"^/api/decisores/contato$", "Cadastrou um contato"),
    ("DELETE", r"^/api/decisores/contato/[^/]+$", "Excluiu um contato"),

    ("POST",   r"^/api/campanhas/upload-media$", "Enviou uma mídia para campanha"),
    ("POST",   r"^/api/campanhas/disparo-rapido$", "Fez um disparo rápido de WhatsApp"),
    ("POST",   r"^/api/campanhas/disparo-email$", "Fez um disparo de e-mail"),
    ("POST",   r"^/api/campanhas/teste-email$", "Enviou um e-mail de teste"),
    ("POST",   r"^/api/campanhas/[^/]+/iniciar$", "Iniciou uma campanha"),
    ("POST",   r"^/api/campanhas$", "Criou uma campanha"),
    ("DELETE", r"^/api/campanhas/[^/]+$", "Excluiu uma campanha"),

    ("POST",   r"^/api/whatsapp/enviar-template$", "Enviou WhatsApp por template"),
    ("POST",   r"^/api/whatsapp/enviar$", "Enviou uma mensagem de WhatsApp"),
    ("POST",   r"^/api/whatsapp/conversas/[^/]+/ler$", "Marcou uma conversa como lida"),
    ("POST",   r"^/api/whatsapp/instancias?$", "Configurou uma instância de WhatsApp"),
    ("DELETE", r"^/api/whatsapp/instancias/[^/]+$", "Removeu uma instância de WhatsApp"),
    ("POST",   r"^/api/whatsapp/webhook-config$", "Configurou o webhook do WhatsApp"),

    ("POST",   r"^/api/tarefas$", "Criou uma tarefa"),
    ("PUT",    r"^/api/tarefas/[^/]+$", "Atualizou uma tarefa"),
    ("DELETE", r"^/api/tarefas/[^/]+$", "Excluiu uma tarefa"),

    ("POST",   r"^/api/templates$", "Criou um template"),
    ("PUT",    r"^/api/templates/[^/]+$", "Editou um template"),
    ("DELETE", r"^/api/templates/[^/]+$", "Excluiu um template"),

    ("POST",   r"^/api/mercado/scan$", "Mapeou o mercado (busca)"),
    ("POST",   r"^/api/mercado/importar$", "Importou itens do mercado"),

    ("POST",   r"^/api/dmc/parceiros$", "Cadastrou um parceiro (DMC)"),
    ("DELETE", r"^/api/dmc/parceiros/[^/]+$", "Excluiu um parceiro (DMC)"),
    ("POST",   r"^/api/dmc/empreendimentos/importar-empresas$", "Importou empresas (DMC)"),
    ("POST",   r"^/api/dmc/empreendimentos$", "Cadastrou um empreendimento (DMC)"),
    ("PUT",    r"^/api/dmc/empreendimentos/[^/]+$", "Atualizou um empreendimento (DMC)"),
    ("DELETE", r"^/api/dmc/empreendimentos/[^/]+$", "Excluiu um empreendimento (DMC)"),

    ("POST",   r"^/api/equipes/colaboradores$", "Cadastrou um colaborador"),
    ("PATCH",  r"^/api/equipes/colaboradores/[^/]+$", "Editou um colaborador"),
    ("POST",   r"^/api/equipes$", "Criou uma equipe"),
    ("PATCH",  r"^/api/equipes/[^/]+$", "Editou uma equipe"),
]

# Pré-compila as regras (método -> lista de (regex, rótulo)).
_REGRAS_COMPILADAS = [(m, re.compile(rx), label) for (m, rx, label) in _REGRAS]


def _recurso(caminho: str) -> str:
    partes = caminho.split("/")
    # /api/<modulo>/... -> índice 2
    return partes[2] if len(partes) > 2 else ""


def rotulo_acao(metodo: str, caminho: str) -> str:
    for m, rx, label in _REGRAS_COMPILADAS:
        if m == metodo and rx.match(caminho):
            return label
    recurso = _recurso(caminho)
    nome = _RECURSO_LABEL.get(recurso, recurso or caminho)
    return f"{_VERBO.get(metodo, metodo)} em {nome}"


async def registrar_acesso(metodo: str, caminho: str, authorization: Optional[str], status_code: int) -> None:
    """Grava um evento de auditoria a partir dos dados da requisição. Best-effort:
    qualquer falha aqui é silenciosa (auditoria nunca pode quebrar a resposta)."""
    metodo = (metodo or "").upper()
    if metodo not in _METODOS_ESCRITA:
        return
    # Fluxos de autenticação (login/cadastro/senha) não são auditados.
    if caminho.startswith("/api/auth"):
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        return  # sem token => sem autor atribuível (ex.: webhook do WhatsApp)
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = verify_access_token(token)
    except Exception:
        return  # token inválido/expirado: a própria rota já recusou
    autor = payload.get("sub")
    if not autor:
        return

    db = get_db()
    try:
        await db.auditoria.insert_one({
            "_id": new_id(),
            "conta_id": payload.get("conta_id"),
            "autor": autor,
            "metodo": metodo,
            "caminho": caminho,
            "recurso": _recurso(caminho),
            "acao": rotulo_acao(metodo, caminho),
            "status_code": int(status_code),
            "ok": 200 <= int(status_code) < 400,
            "created_at": now(),
        })
    except Exception:
        pass


def instalar_auditoria(app) -> None:
    """Registra o middleware HTTP que audita cada requisição de escrita."""
    @app.middleware("http")
    async def _auditoria_mw(request, call_next):
        response = await call_next(request)
        try:
            await registrar_acesso(
                request.method,
                request.url.path,
                request.headers.get("authorization"),
                response.status_code,
            )
        except Exception:
            pass
        return response
