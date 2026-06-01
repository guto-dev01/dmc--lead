# 🏢 ImobPro — Sistema de Prospecção Imobiliária

Sistema completo de prospecção para incorporadoras, construtoras e imobiliárias da região de **Consolação / Jardins / Bela Vista** em São Paulo.

---

## 🚀 Funcionalidades

- ✅ **Cadastro de empresas** — 15 empresas da região já pré-carregadas
- ✅ **Consulta Receita Federal** — Busca dados via CNPJ (BrasilAPI + ReceitaWS)
- ✅ **WhatsApp integrado** — Envio de mensagens via Evolution API
- ✅ **Templates de mensagem** — Com variáveis personalizadas
- ✅ **Campanhas em massa** — Disparo para múltiplas empresas
- ✅ **Dashboard** — Métricas em tempo real
- ✅ **Log de atividades** — Histórico completo

---

## 📦 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 + Tailwind CSS |
| Backend | FastAPI (Python 3.12) |
| Banco | PostgreSQL 16 |
| WhatsApp | Evolution API |
| Proxy | Nginx |
| Deploy | Docker Compose |

---

## ⚡ Deploy na VPS

### 1. Pré-requisitos

```bash
# Ubuntu 22.04+
apt update && apt install -y docker.io docker-compose git
```

### 2. Clonar e configurar

```bash
git clone <seu-repo> imobpro
cd imobpro
cp .env.example .env
nano .env  # Preencha suas configurações
```

### 2.1 Banco de dados

O sistema usa **PostgreSQL 16**.

- Para usar o banco local do Docker, deixe `DATABASE_URL` apontando para o serviço `postgres`.
- Para usar um banco gerenciado, troque apenas `DATABASE_URL` para a URL do provedor.

Exemplo para ambiente local:

```bash
POSTGRES_PASSWORD=imobpro123
DATABASE_URL=postgresql://imobpro:imobpro123@postgres:5432/imobpro
```

Exemplo para banco gerenciado:

```bash
DATABASE_URL=postgresql://usuario:senha@host:5432/nome_do_banco
```

### 3. Subir os serviços

```bash
docker-compose up -d --build
```

### 4. Verificar

```bash
docker-compose ps
curl http://localhost:8000/
# Acesse: http://SEU_IP:3000
```

---

## 📱 Configurar WhatsApp (Evolution API)

### Instalar Evolution API separadamente

```bash
docker run -d \
  --name evolution \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=SuaChave \
  atendai/evolution-api:latest
```

### Criar instância e conectar

```bash
# Criar instância
curl -X POST http://SEU_IP:8080/instance/create \
  -H "apikey: SuaChave" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "imobpro", "qrcode": true}'

# Ver QR Code
curl http://SEU_IP:8080/instance/connect/imobpro \
  -H "apikey: SuaChave"
```

### Configurar Webhook (para receber respostas)

```bash
curl -X POST http://SEU_IP:8080/webhook/set/imobpro \
  -H "apikey: SuaChave" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://SEU_IP:8000/api/whatsapp/webhook",
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT"]
  }'
```

---

## 🏗️ Estrutura do Projeto

```
imobpro/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── database.py          # Config BD
│   ├── routers/
│   │   ├── empresas.py      # CRUD empresas + enrich CNPJ
│   │   ├── cnpj.py          # Consulta Receita Federal
│   │   ├── whatsapp.py      # Evolution API integration
│   │   ├── campanhas.py     # Disparos em massa
│   │   ├── templates.py     # Templates de mensagem
│   │   └── dashboard.py     # Métricas
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── page.jsx         # Dashboard principal
│   │   └── layout.jsx
│   └── Dockerfile
├── docker/
│   ├── init.sql             # Schema + dados iniciais
│   └── nginx.conf           # Proxy reverso
├── docker-compose.yml
└── .env.example
```

---

## ⚙️ Variáveis principais

- `DATABASE_URL` - conexão do backend com o PostgreSQL
- `POSTGRES_PASSWORD` - senha do banco local do Docker
- `EVOLUTION_API_URL` - URL interna da Evolution API
- `EVOLUTION_SERVER_URL` - URL pública usada para QR Code e webhooks
- `EVOLUTION_API_KEY` - chave da Evolution API
- `NEXT_PUBLIC_API_URL` - URL pública do backend usada pelo frontend
- `SECRET_KEY` - chave de segurança do backend

---

## 🔌 API Endpoints

```
GET  /api/dashboard              — Métricas gerais
GET  /api/empresas               — Listar empresas
POST /api/empresas               — Criar empresa
GET  /api/empresas/:id           — Detalhes da empresa
PATCH /api/empresas/:id          — Atualizar empresa
POST /api/empresas/:id/enrich-cnpj — Buscar dados Receita Federal

GET  /api/cnpj/consulta/:cnpj    — Consultar CNPJ

GET  /api/whatsapp/status        — Status da conexão
POST /api/whatsapp/enviar        — Enviar mensagem
POST /api/whatsapp/enviar-template — Enviar com template
GET  /api/whatsapp/conversas/:id — Histórico de conversas
POST /api/whatsapp/webhook       — Receber mensagens

GET  /api/templates              — Listar templates
POST /api/templates              — Criar template

GET  /api/campanhas              — Listar campanhas
POST /api/campanhas              — Criar campanha
POST /api/campanhas/:id/iniciar  — Disparar campanha
```

---

## 🌎 Empresas Pré-carregadas

15 empresas da região mapeada já cadastradas:

- Tegra Incorporadora
- Cyrela Brazil Realty
- Vitacon
- Tecnisa
- One Innovation
- Gafisa
- AAM Incorporadora
- Fibra Experts
- Yuny Incorporadora
- Setin Incorporadora
- Lopes Consultoria
- Zimmermann Imóveis
- JAD Imóveis
- Consolação Imóveis Assessoria
- Imobiliária Bella Vista

---

## 📝 Licença

Desenvolvido por Gustavo — uso privado.
