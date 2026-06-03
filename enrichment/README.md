# Enriquecimento de base via Apollo.io

Script para enriquecer uma base de contatos/empresas usando a API da
[Apollo.io](https://apollo.io). Lê CSV / Excel / JSON, casa cada registro com
a base da Apollo (People Match) e grava um novo arquivo `*_enriched` com
e-mail, telefone, cargo, empresa, LinkedIn e localização.

## Instalação

```bash
cd enrichment
pip install -r requirements.txt
```

> O próprio `enrich.py` também instala as dependências automaticamente na
> primeira execução, caso falte algo.

## Configuração da API key (recomendado)

A chave é lida da variável de ambiente `APOLLO_API_KEY`. Se não existir, o
script usa um valor embutido por padrão — mas o ideal é **não** deixar a chave
no código:

```bash
export APOLLO_API_KEY="gJcssYSRNqwx2Dle-o8DUA"
```

> **Importante:** a Apollo.io autentica via header `X-Api-Key` (não `Bearer`).
> O script já usa o cabeçalho correto.

## Uso

```bash
# Enriquecimento individual (1 registro por chamada, 1s entre elas)
python enrich.py --file minha_base.csv

# Modo bulk: 10 registros por chamada (economiza chamadas)
python enrich.py --file minha_base.xlsx --batch

# Dry-run: mostra o que seria enviado, sem chamar a API nem gastar créditos
python enrich.py --file minha_base.csv --dry-run
```

## Fontes de enriquecimento (`--source`)

São duas fontes independentes. Por **padrão, só a Apollo roda** — a GeckoAPI
**não** é chamada e **não consome créditos** de lá.

```bash
# Padrão: SÓ Apollo (não toca na Gecko)
python enrich.py --file base.csv

# SÓ GeckoAPI, por CNPJ (não toca na Apollo)
python enrich.py --file base.csv --source gecko

# As duas fontes
python enrich.py --file base.csv --source both
```

| `--source` | Apollo | Gecko | Créditos Gecko |
|------------|:------:|:-----:|:--------------:|
| `apollo` (padrão) | ✅ | ❌ | nenhum |
| `gecko`    | ❌ | ✅ | sim           |
| `both`     | ✅ | ✅ | sim           |

A **GeckoAPI** (casadosdados.com.br) enriquece por **CNPJ** e adiciona as
colunas `gecko_razao_social`, `gecko_nome_fantasia`, `gecko_email`,
`gecko_phone`, `gecko_city`, `gecko_uf`, `gecko_situacao`, `gecko_enriched`.
Requer uma coluna de CNPJ na base e o token em `GECKO_API_KEY`:

```bash
export GECKO_API_KEY="seu-token-da-gecko"
```

> Se você pedir `--source gecko/both` mas a base não tiver coluna de CNPJ,
> a Gecko é automaticamente pulada (e nenhum crédito é gasto).

## Como funciona o mapeamento de colunas

Você **não** precisa renomear suas colunas. O script detecta automaticamente,
ignorando maiúsculas/minúsculas, espaços, hífens e underscores. Sinônimos
reconhecidos (parcial):

| Campo lógico        | Nomes aceitos (exemplos)                                   |
|---------------------|-----------------------------------------------------------|
| `first_name`        | first_name, firstname, nome, primeiro_nome                |
| `last_name`         | last_name, sobrenome, surname                             |
| `full_name`         | name, nome_completo, contato (dividido em first/last)     |
| `email`             | email, e-mail, Email, EMAIL, mail                         |
| `domain`            | domain, dominio, website, site, url                       |
| `organization_name` | company, empresa, razao_social, organizacao               |
| `linkedin_url`      | linkedin, linkedin_url, perfil_linkedin                   |

Para adicionar novos sinônimos, edite o dicionário `COLUMN_SYNONYMS` em
[enrich.py](enrich.py).

## Colunas adicionadas na saída

`apollo_email`, `apollo_phone`, `apollo_title`, `apollo_company`,
`apollo_linkedin`, `apollo_city`, `apollo_country`, `apollo_enriched`.

## Retomar de onde parou

O progresso é salvo no arquivo `_enriched` **após cada registro** (ou após cada
lote, no modo `--batch`). Se o script for interrompido, basta rodar o mesmo
comando de novo: ele lê o `_enriched` existente e pula tudo que já tem a coluna
`apollo_enriched` preenchida (`true` ou `false`).

## Rate limiting e erros

- 1 segundo entre chamadas individuais.
- Erro `429` (rate limit): aguarda 60s e tenta de novo.
- Até 3 tentativas por registro; erros de rede usam backoff.
- `no_match` → grava `apollo_enriched = false` e continua.
- Nenhum registro com erro derruba o script.
- Erros e avisos são gravados em `enrichment_errors.log`.

## Resumo final

Ao terminar, mostra total na base, processados, enriquecidos, sem match/erros,
chamadas feitas e estimativa de créditos usados.
