-- Importação dos alvos de prospecção do Complexo DMC (planilha Mapa de Prospecção)
-- Idempotente: insere quem não existe e atualiza os campos de prospecção dos existentes.

WITH dados(nome, tipo, eixo, cargo_alvo, administradora, prioridade, tel) AS (
    VALUES
    ('JHSF',                 'incorporadora', 'Jardins',          'Dir. Relacionamento',     'Lello Condomínios',   'alta',   NULL::varchar),
    ('Adolpho Lindenberg',   'incorporadora', 'Jardins',          'Gerente Comercial',       'Auxiliadora Predial', 'normal', NULL),
    ('Cyrela (High-End)',    'incorporadora', 'Jardins',          'Gerente Clientes Corp.',  'Lello Condomínios',   'media',  NULL),
    ('Fernandez Mera',       'imobiliaria',   'Jardins',          'Dir. Parcerias',          NULL,                  'normal', NULL),
    ('Coelho da Fonseca',    'imobiliaria',   'Jardins',          'Dir. Atendimento Privado',NULL,                  'normal', NULL),
    ('Mbras Imóveis',        'imobiliaria',   'Jardins',          'Head Relacionamento',     NULL,                  'normal', NULL),
    ('Even Construtora',     'incorporadora', 'Paulista/Paraíso', 'Head Exp. Cliente',       'Hubert Imóveis',      'media',  NULL),
    ('Mitre Realty (Haus)',  'incorporadora', 'Paulista/Paraíso', 'Diretor Comercial',       'Auxiliadora Predial', 'normal', NULL),
    ('EZTEC',                'incorporadora', 'Paulista/Paraíso', 'Head Jurídico Imob.',     'Lello Condomínios',   'normal', NULL),
    ('Tegra Incorporadora',  'incorporadora', 'Paulista/Paraíso', 'Gerente Marketing',       'Auxiliadora Predial', 'normal', NULL),
    ('Lello Condomínios',    'administradora','Paulista/Paraíso', 'Gerente de Contas',       NULL,                  'alta',   '(11) 3177-2500'),
    ('Hubert Imóveis',       'administradora','Paulista/Paraíso', 'Dir. Condomínios',        NULL,                  'media',  NULL),
    ('Gafisa',               'incorporadora', 'Bela Vista',       'Gerente Pós-Venda',       'Lello Condomínios',   'media',  NULL),
    ('Trisul',               'incorporadora', 'Bela Vista',       'Coord. Atendimento',      'Auxiliadora Predial', 'normal', NULL),
    ('Stan Desenv. Imob.',   'incorporadora', 'Consolação',       'Dir. Incorporação',       'Lello Condomínios',   'normal', NULL),
    ('Idea!Zarvos',          'incorporadora', 'Consolação',       'Head Novos Negócios',     NULL,                  'normal', NULL),
    ('Yuca / Housi',         'administradora','Consolação',       'Head Expansão',           NULL,                  'media',  NULL),
    ('Auxiliadora Predial',  'administradora','Consolação',       'Gerente Reg. Cond.',      NULL,                  'alta',   '(11) 3150-7000'),
    ('Lopes High Class',     'imobiliaria',   'Jardins',          'Head Gestão Leads',       NULL,                  'normal', NULL),
    ('One Imóveis SP',       'imobiliaria',   'Jardins',          'Gerente Nov. Negócios',   NULL,                  'normal', NULL)
)
, inseridos AS (
    INSERT INTO empresas (nome, tipo, eixo, cargo_alvo, administradora, prioridade, telefone,
                          regiao, municipio, uf, status_prospeccao, observacoes)
    SELECT d.nome, d.tipo, d.eixo, d.cargo_alvo, d.administradora, d.prioridade, d.tel,
           d.eixo, 'São Paulo', 'SP', 'nao_iniciado', 'Importado da planilha Complexo DMC'
    FROM dados d
    WHERE NOT EXISTS (SELECT 1 FROM empresas e WHERE lower(e.nome) = lower(d.nome))
    RETURNING 1
)
UPDATE empresas e SET
    tipo = d.tipo,
    eixo = d.eixo,
    cargo_alvo = d.cargo_alvo,
    administradora = COALESCE(d.administradora, e.administradora),
    prioridade = d.prioridade,
    telefone = COALESCE(e.telefone, d.tel),
    updated_at = NOW()
FROM dados d
WHERE lower(e.nome) = lower(d.nome);
