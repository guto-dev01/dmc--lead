-- ImobPro Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Empresas (incorporadoras, imobiliárias, construtoras)
CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    razao_social VARCHAR(255),
    nome_fantasia VARCHAR(255),
    tipo VARCHAR(50) CHECK (tipo IN ('incorporadora', 'construtora', 'imobiliaria', 'corretora', 'outro')),
    status_receita VARCHAR(50),
    situacao_cadastral VARCHAR(100),
    data_abertura DATE,
    natureza_juridica VARCHAR(100),
    porte VARCHAR(50),
    capital_social DECIMAL(15,2),
    cnaes_principal VARCHAR(10),
    descricao_cnae VARCHAR(255),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    municipio VARCHAR(100),
    uf VARCHAR(2),
    cep VARCHAR(9),
    email VARCHAR(255),
    telefone VARCHAR(20),
    telefone2 VARCHAR(20),
    whatsapp VARCHAR(20),
    website VARCHAR(255),
    regiao VARCHAR(100),
    observacoes TEXT,
    dados_cnpj JSONB,
    cnpj_fonte VARCHAR(120),
    cnpj_enriquecido_em TIMESTAMP,
    tags TEXT[],
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Contatos (pessoas físicas vinculadas às empresas)
CREATE TABLE contatos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    cargo VARCHAR(100),
    email VARCHAR(255),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    linkedin VARCHAR(255),
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Conversas WhatsApp
CREATE TABLE conversas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    contato_id UUID REFERENCES contatos(id),
    numero_whatsapp VARCHAR(20) NOT NULL,
    status VARCHAR(30) DEFAULT 'ativo' CHECK (status IN ('ativo', 'aguardando', 'finalizado', 'bloqueado')),
    ultimo_contato TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Mensagens
CREATE TABLE mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversa_id UUID REFERENCES conversas(id) ON DELETE CASCADE,
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    tipo VARCHAR(20) DEFAULT 'text',
    conteudo TEXT,
    status VARCHAR(20) DEFAULT 'sent',
    whatsapp_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Templates de mensagem
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    categoria VARCHAR(50),
    conteudo TEXT NOT NULL,
    variaveis TEXT[],
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Campanhas de prospecção
CREATE TABLE campanhas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    template_id UUID REFERENCES templates(id),
    status VARCHAR(30) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'agendada', 'em_andamento', 'pausada', 'concluida')),
    total_envios INTEGER DEFAULT 0,
    enviados INTEGER DEFAULT 0,
    respondidos INTEGER DEFAULT 0,
    data_inicio TIMESTAMP,
    data_fim TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Itens da campanha (empresas/contatos alvo)
CREATE TABLE campanha_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campanha_id UUID REFERENCES campanhas(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES empresas(id),
    contato_id UUID REFERENCES contatos(id),
    status VARCHAR(30) DEFAULT 'pendente',
    enviado_em TIMESTAMP,
    respondido_em TIMESTAMP
);

-- Atividades/Log
CREATE TABLE atividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    tipo VARCHAR(50),
    descricao TEXT,
    dados JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Radar de mercado imobiliário
CREATE TABLE mercado_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
    area VARCHAR(120),
    tipo VARCHAR(40) DEFAULT 'outro',
    nome VARCHAR(255) NOT NULL,
    subtitulo VARCHAR(255),
    bairro VARCHAR(120),
    municipio VARCHAR(120),
    uf VARCHAR(2),
    endereco VARCHAR(255),
    valor_venda VARCHAR(50),
    valor_locacao VARCHAR(50),
    dormitorios INTEGER,
    suites INTEGER,
    vagas INTEGER,
    area_privativa INTEGER,
    status VARCHAR(50),
    empreendimento VARCHAR(255),
    url VARCHAR(600) NOT NULL,
    fonte VARCHAR(255),
    dados JSONB,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (area, tipo, nome, url)
);

-- Índices
CREATE INDEX idx_empresas_cnpj ON empresas(cnpj);
CREATE INDEX idx_empresas_tipo ON empresas(tipo);
CREATE INDEX idx_empresas_nome ON empresas USING gin(nome gin_trgm_ops);
CREATE INDEX idx_mensagens_conversa ON mensagens(conversa_id);
CREATE INDEX idx_conversas_empresa ON conversas(empresa_id);
CREATE INDEX idx_mercado_itens_area ON mercado_itens(area);
CREATE INDEX idx_mercado_itens_tipo ON mercado_itens(tipo);
CREATE INDEX idx_mercado_itens_empresa ON mercado_itens(empresa_id);
CREATE INDEX idx_mercado_itens_nome ON mercado_itens USING gin(nome gin_trgm_ops);

-- Dados iniciais: empresas da região Consolação/Jardins/Bela Vista
INSERT INTO empresas (nome, tipo, regiao, bairro, municipio, uf, observacoes, tags) VALUES
('Tegra Incorporadora', 'incorporadora', 'Consolação/Jardins', 'Jardins', 'São Paulo', 'SP', 'Mencionada no mapa original. Empreendimentos em Consolação.', ARRAY['alto-padrao','ativo','mapa-original']),
('Cyrela Brazil Realty', 'incorporadora', 'Consolação/Jardins', 'Bela Cintra', 'São Paulo', 'SP', 'On The Sky - R. Bela Cintra, 532. Maior incorporadora do Brasil.', ARRAY['alto-padrao','listada-b3']),
('Vitacon', 'incorporadora', 'Bela Vista', 'Bela Vista', 'São Paulo', 'SP', 'VN Consolação e Vitacon Bela Vista. Foco em mobilidade urbana.', ARRAY['compactos','mobilidade']),
('Tecnisa', 'incorporadora', 'Jardins', 'Jardins', 'São Paulo', 'SP', 'Kalea Jardins - R. Consolação 3288. Em construção.', ARRAY['alto-padrao']),
('One Innovation', 'incorporadora', 'Bela Vista', 'Bela Vista', 'São Paulo', 'SP', 'Nex One Parque Augusta - 504 unidades, R$220mi VGV, entrega 2028.', ARRAY['multifamily','top-imobiliario']),
('Gafisa', 'incorporadora', 'Jardins', 'Jardins', 'São Paulo', 'SP', 'Alto padrão em Jardins. Parceria Tonino Lamborghini.', ARRAY['alto-padrao','listada-b3']),
('AAM Incorporadora', 'incorporadora', 'Bela Vista', 'Bela Vista', 'São Paulo', 'SP', 'Torre Bela Vista - R. Maria Paula 184. 581 unidades, 40 pavimentos.', ARRAY['grande-escala']),
('Fibra Experts', 'incorporadora', 'Consolação', 'Consolação', 'São Paulo', 'SP', 'Prestes a fechar terreno na Rua Augusta para novo projeto.', ARRAY['prospeccao']),
('Yuny Incorporadora', 'incorporadora', 'Jardins', 'Jardins', 'São Paulo', 'SP', 'Forte presença em Jardins. Alto padrão e projetos inovadores.', ARRAY['alto-padrao']),
('Setin Incorporadora', 'incorporadora', 'Jardins', 'Jardins', 'São Paulo', 'SP', 'Médio e alto padrão desde 1979.', ARRAY['medio-alto-padrao']),
('Lopes Consultoria de Imóveis', 'imobiliaria', 'Consolação/Jardins', 'Consolação', 'São Paulo', 'SP', 'Maior imobiliária do Brasil. 132 imobiliárias em Bela Vista.', ARRAY['grande-rede']),
('Zimmermann Imóveis', 'imobiliaria', 'Jardins', 'Jardins', 'São Paulo', 'SP', '25+ anos de mercado. Cobre Consolação, Jardins e Bela Vista.', ARRAY['especializada']),
('JAD Imóveis', 'imobiliaria', 'Bela Vista', 'Bela Vista', 'São Paulo', 'SP', 'Especializada em Bela Vista, Consolação e Liberdade.', ARRAY['local','especializada']),
('Consolação Imóveis Assessoria', 'imobiliaria', 'Consolação', 'Consolação', 'São Paulo', 'SP', 'Especializada na região. Venda, locação e lançamentos.', ARRAY['local']),
('Imobiliária Bella Vista', 'imobiliaria', 'Bela Vista', 'Bela Vista', 'São Paulo', 'SP', 'Prontos, em construção, planta e usados.', ARRAY['local']);

-- Templates iniciais
INSERT INTO templates (nome, categoria, conteudo, variaveis) VALUES
('Apresentação Inicial', 'prospecção', 'Olá, {{nome}}! Tudo bem? 🏢

Sou {{meu_nome}} e entrei em contato porque identificamos que a {{empresa}} atua na região de Consolação/Jardins/Bela Vista em São Paulo.

Desenvolvemos soluções específicas para incorporadoras e imobiliárias da região. Posso compartilhar algumas informações que podem ser relevantes para vocês?

Aguardo seu retorno! 🙂', ARRAY['nome','meu_nome','empresa']),
('Follow-up', 'follow-up', 'Olá, {{nome}}! 👋

Passando para retomar nosso contato. Enviamos uma mensagem anteriormente sobre nossas soluções para o mercado imobiliário de Consolação/Jardins.

Você teve a oportunidade de ver? Posso tirar qualquer dúvida!', ARRAY['nome']),
('Proposta Comercial', 'comercial', 'Olá, {{nome}}!

Conforme nossa conversa, segue uma breve apresentação das nossas soluções para a {{empresa}}:

✅ Gestão de leads e prospecção automatizada
✅ Integração WhatsApp Business
✅ Dashboard com dados da Receita Federal
✅ Campanhas de comunicação personalizadas

Posso agendar uma demonstração de 15 minutos? Qual o melhor horário para você? 📅', ARRAY['nome','empresa']);
