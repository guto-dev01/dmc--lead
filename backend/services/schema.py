"""Garante índices e dados iniciais no MongoDB.

Equivale ao antigo init.sql + ALTERs do Postgres: no Mongo não há schema fixo,
então aqui só criamos índices (incluindo os UNIQUE que substituem as constraints)
e semeamos as empresas/templates iniciais quando o banco está vazio.
"""
import uuid

from pymongo import ASCENDING, DESCENDING

from database import get_db, now, settings

# Namespace fixo p/ gerar _id determinístico das linhas de seed (idempotente:
# reexecutar o seed — mesmo em corrida entre workers — nunca duplica).
_SEED_NS = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _seed_id(prefixo: str, chave: str) -> str:
    return str(uuid.uuid5(_SEED_NS, f"{prefixo}:{chave}"))


async def _drop_index_se_existir(coll, nome: str) -> None:
    """Remove um índice pelo nome, ignorando se ele não existir. Usado para
    substituir índices únicos antigos (globais) pelos novos por conta (tenant)."""
    try:
        await coll.drop_index(nome)
    except Exception:
        pass


async def _ensure_indexes(db) -> None:
    # empresas — cnpj único POR CONTA (multi-tenant): contas diferentes podem ter
    # o mesmo CNPJ. Substitui o índice global antigo (uniq_empresas_cnpj).
    await _drop_index_se_existir(db.empresas, "uniq_empresas_cnpj")
    await db.empresas.create_index(
        [("conta_id", ASCENDING), ("cnpj", ASCENDING)],
        unique=True,
        partialFilterExpression={"cnpj": {"$type": "string"}},
        name="uniq_empresas_conta_cnpj",
    )
    await db.empresas.create_index([("conta_id", ASCENDING)])
    await db.empresas.create_index([("tipo", ASCENDING)])
    await db.empresas.create_index([("ramo", ASCENDING)])
    await db.empresas.create_index([("conta_id", ASCENDING), ("ramo", ASCENDING)])
    await db.empresas.create_index([("eixo", ASCENDING)])
    await db.empresas.create_index([("status_prospeccao", ASCENDING)])
    await db.empresas.create_index([("conta_id", ASCENDING), ("score", DESCENDING), ("created_at", DESCENDING)])

    await db.contatos.create_index([("conta_id", ASCENDING)])
    await db.contatos.create_index([("empresa_id", ASCENDING)])

    # usuarios (donos/colaboradores) — e-mail único e índices de organização
    await db.usuarios.create_index([("email", ASCENDING)], unique=True, name="uniq_usuarios_email")
    await db.usuarios.create_index([("conta_id", ASCENDING)])
    await db.usuarios.create_index([("status", ASCENDING)])
    await db.usuarios.create_index([("funcao", ASCENDING)])
    await db.usuarios.create_index([("equipe_id", ASCENDING)])

    # equipes — agrupamento organizacional de colaboradores (por conta)
    await db.equipes.create_index([("conta_id", ASCENDING)])
    await db.equipes.create_index([("nome", ASCENDING)])
    await db.equipes.create_index([("status", ASCENDING)])

    await db.conversas.create_index([("conta_id", ASCENDING)])
    await db.conversas.create_index([("empresa_id", ASCENDING)])
    await db.conversas.create_index([("numero_whatsapp", ASCENDING)])

    await db.mensagens.create_index([("conta_id", ASCENDING)])
    await db.mensagens.create_index([("conversa_id", ASCENDING)])
    await db.mensagens.create_index([("created_at", ASCENDING)])

    await db.campanhas.create_index([("conta_id", ASCENDING), ("created_at", DESCENDING)])
    await db.campanha_itens.create_index([("conta_id", ASCENDING)])
    await db.campanha_itens.create_index([("campanha_id", ASCENDING)])
    await db.campanha_itens.create_index([("empresa_id", ASCENDING)])

    await db.atividades.create_index([("conta_id", ASCENDING)])
    await db.atividades.create_index([("empresa_id", ASCENDING)])
    await db.atividades.create_index([("created_at", DESCENDING)])
    # produtividade — consultas por conta + autor + período e por tipo
    await db.atividades.create_index([("conta_id", ASCENDING), ("autor", ASCENDING), ("created_at", DESCENDING)])
    await db.atividades.create_index([("tipo", ASCENDING)])

    # auditoria — registro completo de ações por usuário (quem fez o quê/quando).
    # Consulta principal: por conta + autor, mais recentes primeiro.
    await db.auditoria.create_index([("conta_id", ASCENDING), ("autor", ASCENDING), ("created_at", DESCENDING)])
    await db.auditoria.create_index([("conta_id", ASCENDING), ("created_at", DESCENDING)])
    await db.auditoria.create_index([("created_at", DESCENDING)])

    # mercado_itens — UNIQUE (conta, area, tipo, nome, url) usado no upsert do scan.
    # Substitui o índice global antigo (uniq_mercado_item).
    await _drop_index_se_existir(db.mercado_itens, "uniq_mercado_item")
    await db.mercado_itens.create_index(
        [("conta_id", ASCENDING), ("area", ASCENDING), ("tipo", ASCENDING), ("nome", ASCENDING), ("url", ASCENDING)],
        unique=True,
        name="uniq_mercado_conta_item",
    )
    await db.mercado_itens.create_index([("conta_id", ASCENDING)])
    await db.mercado_itens.create_index([("area", ASCENDING)])
    await db.mercado_itens.create_index([("tipo", ASCENDING)])
    await db.mercado_itens.create_index([("empresa_id", ASCENDING)])

    await db.dmc_parceiros.create_index([("conta_id", ASCENDING)])
    await db.dmc_parceiros.create_index([("nome", ASCENDING)])
    await db.dmc_empreendimentos.create_index([("conta_id", ASCENDING)])
    await db.dmc_empreendimentos.create_index([("status", ASCENDING)])
    await db.dmc_empreendimentos.create_index([("parceiro_id", ASCENDING)])

    # templates — agora por conta (cada conta tem os seus)
    await db.templates.create_index([("conta_id", ASCENDING)])

    # tarefas — atividades internas; filtros por status/prioridade/responsável
    await db.tarefas.create_index([("conta_id", ASCENDING)])
    await db.tarefas.create_index([("arquivada", ASCENDING)])
    await db.tarefas.create_index([("status", ASCENDING)])
    await db.tarefas.create_index([("prioridade", ASCENDING)])
    await db.tarefas.create_index([("responsavel", ASCENDING)])
    await db.tarefas.create_index([("data_vencimento", ASCENDING), ("created_at", DESCENDING)])


EMPRESAS_SEED = [
    ("Tegra Incorporadora", "incorporadora", "Consolação/Jardins", "Jardins", "Mencionada no mapa original. Empreendimentos em Consolação.", ["alto-padrao", "ativo", "mapa-original"]),
    ("Cyrela Brazil Realty", "incorporadora", "Consolação/Jardins", "Bela Cintra", "On The Sky - R. Bela Cintra, 532. Maior incorporadora do Brasil.", ["alto-padrao", "listada-b3"]),
    ("Vitacon", "incorporadora", "Bela Vista", "Bela Vista", "VN Consolação e Vitacon Bela Vista. Foco em mobilidade urbana.", ["compactos", "mobilidade"]),
    ("Tecnisa", "incorporadora", "Jardins", "Jardins", "Kalea Jardins - R. Consolação 3288. Em construção.", ["alto-padrao"]),
    ("One Innovation", "incorporadora", "Bela Vista", "Bela Vista", "Nex One Parque Augusta - 504 unidades, R$220mi VGV, entrega 2028.", ["multifamily", "top-imobiliario"]),
    ("Gafisa", "incorporadora", "Jardins", "Jardins", "Alto padrão em Jardins. Parceria Tonino Lamborghini.", ["alto-padrao", "listada-b3"]),
    ("AAM Incorporadora", "incorporadora", "Bela Vista", "Bela Vista", "Torre Bela Vista - R. Maria Paula 184. 581 unidades, 40 pavimentos.", ["grande-escala"]),
    ("Fibra Experts", "incorporadora", "Consolação", "Consolação", "Prestes a fechar terreno na Rua Augusta para novo projeto.", ["prospeccao"]),
    ("Yuny Incorporadora", "incorporadora", "Jardins", "Jardins", "Forte presença em Jardins. Alto padrão e projetos inovadores.", ["alto-padrao"]),
    ("Setin Incorporadora", "incorporadora", "Jardins", "Jardins", "Médio e alto padrão desde 1979.", ["medio-alto-padrao"]),
    ("Lopes Consultoria de Imóveis", "imobiliaria", "Consolação/Jardins", "Consolação", "Maior imobiliária do Brasil. 132 imobiliárias em Bela Vista.", ["grande-rede"]),
    ("Zimmermann Imóveis", "imobiliaria", "Jardins", "Jardins", "25+ anos de mercado. Cobre Consolação, Jardins e Bela Vista.", ["especializada"]),
    ("JAD Imóveis", "imobiliaria", "Bela Vista", "Bela Vista", "Especializada em Bela Vista, Consolação e Liberdade.", ["local", "especializada"]),
    ("Consolação Imóveis Assessoria", "imobiliaria", "Consolação", "Consolação", "Especializada na região. Venda, locação e lançamentos.", ["local"]),
    ("Imobiliária Bella Vista", "imobiliaria", "Bela Vista", "Bela Vista", "Prontos, em construção, planta e usados.", ["local"]),
]

TEMPLATES_SEED = [
    (
        "Apresentação Inicial", "prospecção",
        "Olá, {{nome}}! Tudo bem? 🏢\n\nSou {{meu_nome}} e entrei em contato porque identificamos que a {{empresa}} atua na região de Consolação/Jardins/Bela Vista em São Paulo.\n\nDesenvolvemos soluções específicas para incorporadoras e imobiliárias da região. Posso compartilhar algumas informações que podem ser relevantes para vocês?\n\nAguardo seu retorno! 🙂",
        ["nome", "meu_nome", "empresa"],
    ),
    (
        "Follow-up", "follow-up",
        "Olá, {{nome}}! 👋\n\nPassando para retomar nosso contato. Enviamos uma mensagem anteriormente sobre nossas soluções para o mercado imobiliário de Consolação/Jardins.\n\nVocê teve a oportunidade de ver? Posso tirar qualquer dúvida!",
        ["nome"],
    ),
    (
        "Proposta Comercial", "comercial",
        "Olá, {{nome}}!\n\nConforme nossa conversa, segue uma breve apresentação das nossas soluções para a {{empresa}}:\n\n✅ Gestão de leads e prospecção automatizada\n✅ Integração WhatsApp Business\n✅ Dashboard com dados da Receita Federal\n✅ Campanhas de comunicação personalizadas\n\nPosso agendar uma demonstração de 15 minutos? Qual o melhor horário para você? 📅",
        ["nome", "empresa"],
    ),
]

# Templates do ramo funerário (semeados de forma idempotente para todas as contas).
TEMPLATES_FUNERARIA_SEED = [
    (
        "Apresentação Inicial (Funerária)", "prospecção",
        "Olá, {{nome}}! Tudo bem?\n\nSou {{meu_nome}} e entrei em contato porque identificamos que a {{empresa}} atua com serviços funerários e de assistência na sua região.\n\nDesenvolvemos soluções para gestão de famílias atendidas, contratos de plano funerário e relacionamento com parceiros (cemitérios, crematórios e floriculturas). Posso compartilhar como ajudamos funerárias a organizar a captação e o pós-atendimento?\n\nFico à disposição.",
        ["nome", "meu_nome", "empresa"],
    ),
    (
        "Follow-up (Funerária)", "follow-up",
        "Olá, {{nome}}!\n\nPassando para retomar nosso contato sobre as soluções de gestão para o setor funerário.\n\nVocê teve a oportunidade de avaliar? Posso esclarecer qualquer dúvida.",
        ["nome"],
    ),
    (
        "Proposta Comercial (Funerária)", "comercial",
        "Olá, {{nome}}!\n\nConforme nossa conversa, segue uma breve apresentação das nossas soluções para a {{empresa}}:\n\n✅ Gestão de planos funerários e renovações\n✅ Cadastro e histórico de famílias atendidas\n✅ Comunicação automatizada (WhatsApp) com clientes e parceiros\n✅ Dashboard com dados da Receita Federal\n\nPosso agendar uma demonstração de 15 minutos? Qual o melhor horário para você?",
        ["nome", "empresa"],
    ),
]


async def _conta_principal_id(db):
    """conta_id da conta principal (dono cujo e-mail é conta_principal_email).
    None quando esse usuário ainda não existe — nesse caso não semeamos para não
    criar dados órfãos sem dono. A migração cria esse usuário antes de migrar."""
    email = (settings.conta_principal_email or "").strip().lower()
    if not email:
        return None
    u = await db.usuarios.find_one({"email": email}, {"conta_id": 1})
    if not u:
        return None
    return u.get("conta_id") or u["_id"]


async def _seed_inicial(db) -> None:
    """Semeia empresas e templates iniciais (na conta principal) somente se as
    coleções estiverem vazias. Sem conta principal definida, não semeia."""
    conta_id = await _conta_principal_id(db)
    if not conta_id:
        return

    if await db.empresas.count_documents({}, limit=1) == 0:
        ts = now()
        for nome, tipo, regiao, bairro, observacoes, tags in EMPRESAS_SEED:
            doc = {
                "_id": _seed_id("empresa", nome), "conta_id": conta_id,
                "nome": nome, "tipo": tipo, "ramo": "imobiliaria", "regiao": regiao, "bairro": bairro,
                "municipio": "São Paulo", "uf": "SP",
                "observacoes": observacoes, "tags": tags,
                "score": 0, "status_prospeccao": "nao_iniciado", "prioridade": "normal",
                "created_at": ts, "updated_at": ts,
            }
            # upsert por _id determinístico: idempotente mesmo com workers em corrida
            await db.empresas.update_one({"_id": doc["_id"]}, {"$setOnInsert": doc}, upsert=True)

    if await db.templates.count_documents({}, limit=1) == 0:
        ts = now()
        for nome, categoria, conteudo, variaveis in TEMPLATES_SEED:
            doc = {
                "_id": _seed_id("template", nome), "conta_id": conta_id,
                "nome": nome, "categoria": categoria, "conteudo": conteudo,
                "variaveis": variaveis, "ativo": True, "ramo": "imobiliaria", "created_at": ts,
            }
            await db.templates.update_one({"_id": doc["_id"]}, {"$setOnInsert": doc}, upsert=True)

    # Templates de funerária: semeados sempre (idempotente por _id), inclusive em
    # contas já existentes, para que o ramo funerária funcione de imediato.
    ts = now()
    for nome, categoria, conteudo, variaveis in TEMPLATES_FUNERARIA_SEED:
        doc = {
            "_id": _seed_id("template", nome), "conta_id": conta_id,
            "nome": nome, "categoria": categoria, "conteudo": conteudo,
            "variaveis": variaveis, "ativo": True, "ramo": "funeraria", "created_at": ts,
        }
        await db.templates.update_one({"_id": doc["_id"]}, {"$setOnInsert": doc}, upsert=True)


async def _backfill_ramo(db) -> None:
    """Marca os registros antigos (sem `ramo`) com o ramo padrão, para que o
    filtro por ramo do app funcione. Tudo que existe hoje é imobiliário; o módulo
    DMC (intermediação institucional) é o ramo 'corporativa'."""
    sem_ramo = {"ramo": {"$exists": False}}
    await db.empresas.update_many(sem_ramo, {"$set": {"ramo": "imobiliaria"}})
    await db.mercado_itens.update_many(sem_ramo, {"$set": {"ramo": "imobiliaria"}})
    await db.templates.update_many(sem_ramo, {"$set": {"ramo": "imobiliaria"}})
    await db.dmc_empreendimentos.update_many(sem_ramo, {"$set": {"ramo": "corporativa"}})
    await db.dmc_parceiros.update_many(sem_ramo, {"$set": {"ramo": "corporativa"}})


async def ensure_schema() -> None:
    db = get_db()
    await _ensure_indexes(db)
    await _backfill_ramo(db)
    await _seed_inicial(db)
