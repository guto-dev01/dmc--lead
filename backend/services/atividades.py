"""Registro central de atividades (log de eventos) com atribuição de autor.

Toda ação contável do sistema grava um documento em `db.atividades` contendo
QUEM a realizou (`autor` = e-mail/login do usuário autenticado). É a partir
deste log que o módulo de Equipes calcula a produtividade — sempre com dados
reais, nunca números fictícios. Eventos sem `autor` (anteriores a esta marcação)
simplesmente não entram em nenhuma contagem por colaborador.
"""
from database import new_id, now

# Tipos de evento contabilizados como produtividade e seus rótulos amigáveis.
# A chave é o `tipo` gravado em db.atividades; o valor é o texto exibido na UI.
TIPOS_PRODUTIVIDADE = {
    "empresa_criada": "Empresas cadastradas",
    "contato_criado": "Contatos cadastrados",
    "campanha_criada": "Campanhas criadas",
    "whatsapp_sent": "Mensagens de WhatsApp enviadas",
    "email_sent": "E-mails enviados",
    "enrich_cnpj": "Enriquecimentos por CNPJ",
    "enrich_auto": "Enriquecimentos automáticos",
    "discover_whatsapp": "WhatsApp descobertos",
    "discover_email": "E-mails descobertos",
    "status_alterado": "Status de prospecção atualizados",
    "tarefa_concluida": "Tarefas concluídas",
}


async def registrar(db, tipo: str, autor=None, descricao: str = "",
                    empresa_id=None, dados=None, conta_id=None) -> None:
    """Grava um evento em db.atividades. `autor` é o login/e-mail de quem agiu
    (None quando não há sessão atribuível). `conta_id` isola o evento por conta
    (tenant) — usado pelo módulo de Equipes/produtividade."""
    await db.atividades.insert_one({
        "_id": new_id(),
        "conta_id": conta_id,
        "empresa_id": empresa_id,
        "tipo": tipo,
        "autor": autor or None,
        "descricao": descricao,
        "dados": dados,
        "created_at": now(),
    })
