-- ============================================================
-- Complexo DMC — módulo de intermediação (empreendimentos/parceiros)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS dmc_parceiros (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        VARCHAR(160) NOT NULL,
    sigla       VARCHAR(20),
    cor         VARCHAR(9)  DEFAULT '#00e7fc',
    creci       VARCHAR(40),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dmc_empreendimentos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                VARCHAR(20),                 -- DMC-001...
    nome                  VARCHAR(255) NOT NULL,
    tipologia             VARCHAR(60),
    parceiro_id           UUID REFERENCES dmc_parceiros(id) ON DELETE SET NULL,
    prospector            VARCHAR(120),
    status                VARCHAR(40) DEFAULT 'Originação',
    cidade                VARCHAR(120),
    uf                    VARCHAR(2),
    bairro                VARCHAR(120),
    endereco              VARCHAR(255),
    cep                   VARCHAR(12),
    area_terreno          NUMERIC,
    area_construida       NUMERIC,
    valor_venda           NUMERIC,
    valor_locacao         NUMERIC,
    iptu                  NUMERIC,
    condominio            NUMERIC,
    cap_rate              NUMERIC,
    ocupacao              NUMERIC,
    inquilinos            INTEGER,
    ano_construcao        INTEGER,
    matricula             VARCHAR(120),
    cartorio              VARCHAR(160),
    inscricao_imobiliaria VARCHAR(120),
    zoneamento            TEXT,
    url_fonte             VARCHAR(600),
    foto_url              VARCHAR(600),
    lat                   DOUBLE PRECISION,
    lng                   DOUBLE PRECISION,
    observacoes           TEXT,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dmc_emp_status   ON dmc_empreendimentos(status);
CREATE INDEX IF NOT EXISTS idx_dmc_emp_parceiro ON dmc_empreendimentos(parceiro_id);
