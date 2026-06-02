import asyncpg

from database import settings


async def ensure_schema() -> None:
    conn = await asyncpg.connect(
        settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    )
    try:
        statements = [
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS dados_cnpj JSONB",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cnpj_fonte VARCHAR(120)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cnpj_enriquecido_em TIMESTAMP",
            # --- Prospecção (planilha Complexo DMC) ---
            # Eixo geográfico e funil de prospecção
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS eixo VARCHAR(80)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cargo_alvo VARCHAR(120)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS status_prospeccao VARCHAR(40) DEFAULT 'nao_iniciado'",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'normal'",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS proxima_acao VARCHAR(255)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS data_agendada TIMESTAMP",
            # Contatos de prédio
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sindico VARCHAR(255)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tel_sindico VARCHAR(30)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS zelador VARCHAR(255)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tel_portaria VARCHAR(30)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS administradora VARCHAR(255)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tel_administradora VARCHAR(30)",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255)",
            # Coordenadas para o Mapa de Ativos (geocodificadas via OSM)
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION",
            "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION",
            # Libera o tipo "administradora" no CHECK
            "ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_tipo_check",
            "ALTER TABLE empresas ADD CONSTRAINT empresas_tipo_check CHECK (tipo IN ('incorporadora','construtora','imobiliaria','corretora','administradora','outro'))",
            "CREATE INDEX IF NOT EXISTS idx_empresas_eixo ON empresas(eixo)",
            "CREATE INDEX IF NOT EXISTS idx_empresas_status_prospeccao ON empresas(status_prospeccao)",
            """
            CREATE TABLE IF NOT EXISTS mercado_itens (
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
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_mercado_itens_area ON mercado_itens(area)",
            "CREATE INDEX IF NOT EXISTS idx_mercado_itens_tipo ON mercado_itens(tipo)",
            "CREATE INDEX IF NOT EXISTS idx_mercado_itens_empresa ON mercado_itens(empresa_id)",
            "CREATE INDEX IF NOT EXISTS idx_mercado_itens_nome ON mercado_itens USING gin(nome gin_trgm_ops)",
            # --- Complexo DMC: intermediação (parceiros + empreendimentos) ---
            "CREATE EXTENSION IF NOT EXISTS pgcrypto",
            """
            CREATE TABLE IF NOT EXISTS dmc_parceiros (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nome VARCHAR(160) NOT NULL,
                sigla VARCHAR(20),
                cor VARCHAR(9) DEFAULT '#00e7fc',
                creci VARCHAR(40),
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS dmc_empreendimentos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                codigo VARCHAR(20),
                nome VARCHAR(255) NOT NULL,
                tipologia VARCHAR(60),
                parceiro_id UUID REFERENCES dmc_parceiros(id) ON DELETE SET NULL,
                prospector VARCHAR(120),
                status VARCHAR(40) DEFAULT 'Originação',
                cidade VARCHAR(120),
                uf VARCHAR(2),
                bairro VARCHAR(120),
                endereco VARCHAR(255),
                cep VARCHAR(12),
                area_terreno NUMERIC,
                area_construida NUMERIC,
                valor_venda NUMERIC,
                valor_locacao NUMERIC,
                iptu NUMERIC,
                condominio NUMERIC,
                cap_rate NUMERIC,
                ocupacao NUMERIC,
                inquilinos INTEGER,
                ano_construcao INTEGER,
                matricula VARCHAR(120),
                cartorio VARCHAR(160),
                inscricao_imobiliaria VARCHAR(120),
                zoneamento TEXT,
                url_fonte VARCHAR(600),
                foto_url VARCHAR(600),
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                observacoes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_dmc_emp_status ON dmc_empreendimentos(status)",
            "CREATE INDEX IF NOT EXISTS idx_dmc_emp_parceiro ON dmc_empreendimentos(parceiro_id)",
            # --- Decisores: contatos (donos/sócios/diretores) por empresa ---
            """
            CREATE TABLE IF NOT EXISTS contatos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
                nome VARCHAR(255) NOT NULL,
                cargo VARCHAR(100),
                email VARCHAR(255),
                telefone VARCHAR(20),
                whatsapp VARCHAR(20),
                linkedin VARCHAR(255),
                notas TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_contatos_empresa ON contatos(empresa_id)",
        ]
        for stmt in statements:
            await conn.execute(stmt)
    finally:
        await conn.close()
