# Deploy do ImobPro no Railway

O ImobPro são **dois serviços** (backend FastAPI + frontend Next.js) que rodam a
partir dos `Dockerfile` de cada pasta. O banco é o **MongoDB Atlas** (externo — o
Railway não tem Mongo gerenciado nativo; pode-se usar o template do Atlas ou um
plugin). O Postgres/Redis/Evolution só são necessários se você quiser **WhatsApp**
(opcional — ver o fim).

Arquivos que já preparam o deploy:
- `backend/Dockerfile` + `backend/railway.json`
- `frontend/Dockerfile` + `frontend/railway.json` (Next `output: standalone`, escuta em `$PORT`/`0.0.0.0`)

---

## 1. Pré-requisitos
- Repositório no **GitHub** (faça `git push` com estes arquivos).
- **MongoDB Atlas** com a URI `mongodb+srv://...` (o mesmo banco que você já usa).
  - Em **Atlas → Network Access**, libere `0.0.0.0/0` (ou os IPs de egress do Railway),
    senão o backend não conecta.
- **SMTP** (ex.: Gmail com "Senha de app") e, se quiser o "Mapear mercado",
  uma chave **BRAVE_API_KEY** (recomendado) ou Google CSE.

---

## 2. Criar o projeto
1. https://railway.app → **New Project → Deploy from GitHub repo** → selecione o repo.
2. O Railway vai criar **um serviço**. Vamos transformar em dois (backend e frontend),
   cada um com um **Root Directory** diferente.

---

## 3. Serviço **Backend**
No serviço, **Settings**:
- **Root Directory:** `backend`
- **Builder:** Dockerfile (já detectado pelo `backend/railway.json`)
- **Networking → Generate Domain** (anote a URL, ex.: `https://imobpro-backend.up.railway.app`)

**Variables** (aba Variables) — mínimas em **negrito**:

| Variável | Valor |
|---|---|
| **MONGO_URL** | sua URI do Atlas `mongodb+srv://...` |
| **MONGO_DB** | `imobpro` |
| **SECRET_KEY** | uma string aleatória longa |
| **ADMIN_USERNAME** | `admin` |
| **ADMIN_PASSWORD** | uma senha forte (login admin) |
| **CONTA_PRINCIPAL_EMAIL** | e-mail do dono dos dados (ex.: `nathalial@complexodmc.com.br`) |
| **RESEND_API_KEY** | chave do Resend — **use isto no Railway** (o SMTP é bloqueado, veja abaixo) |
| **EMAIL_FROM** | remetente verificado (ex.: `lead@complexodmc.com.br`) — domínio verificado no Resend |
| SMTP_FROM_NOME | `ImobPro` (nome exibido do remetente) |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM / SMTP_USE_TLS | só se NÃO usar a API HTTP (não funciona no Railway Free/Trial/Hobby) |
| BRAVE_API_KEY | chave da Brave (busca de mercado) — ou GOOGLE_API_KEY+GOOGLE_CSE_ID |
| HUNTER_API_KEY | (opcional) e-mail de decisores |
| DONO_PRINCIPAL_EMAIL | (opcional) recebe aprovações de cadastro |
| FRONTEND_ORIGIN | **preencher depois** com a URL do frontend (CORS) |
| APP_PUBLIC_URL | **preencher depois** com a URL do frontend (link de reset de senha) |
| BACKEND_PUBLIC_URL | esta própria URL do backend |

> O `start` e a porta já vêm do `backend/railway.json` (`uvicorn ... --port $PORT`).
> Na subida, o backend conecta no Mongo, cria índices e semeia os dados iniciais.

> ⚠️ **E-mail no Railway:** o Railway BLOQUEIA conexões SMTP de saída (portas
> 25/465/587) nos planos Free/Trial/Hobby — por isso o "Enviar e-mail de teste"
> falha mesmo com as variáveis SMTP corretas. Use uma API HTTP (porta 443):
> crie uma conta no [Resend](https://resend.com), verifique seu domínio,
> e defina `RESEND_API_KEY` + `EMAIL_FROM`. O código usa a API automaticamente
> quando a chave existe. (Alternativa: assinar o plano Pro do Railway, que libera SMTP.)
> Confira o caminho ativo em `GET /` do backend: o campo `email_provider`
> deve mostrar `resend` (ou `brevo`).

---

## 4. Serviço **Frontend**
Crie um **segundo serviço** no mesmo projeto: **New → GitHub Repo** (o mesmo repo).
Em **Settings**:
- **Root Directory:** `frontend`
- **Builder:** Dockerfile (via `frontend/railway.json`)
- **Networking → Generate Domain** (anote, ex.: `https://imobpro-frontend.up.railway.app`)

**Variables:**

| Variável | Valor |
|---|---|
| **NEXT_PUBLIC_API_URL** | a URL pública do **backend** (passo 3) |

> ⚠️ `NEXT_PUBLIC_API_URL` é **assada no build** do Next. O Railway injeta as
> variables do serviço como *build args* (o `Dockerfile` já declara o `ARG`).
> Se você mudar essa URL depois, **redeploy** o frontend.

---

## 5. Conectar os dois (CORS + links)
Volte no **Backend → Variables** e preencha:
- `FRONTEND_ORIGIN` = URL do frontend (ex.: `https://imobpro-frontend.up.railway.app`)
- `APP_PUBLIC_URL` = mesma URL do frontend
- `BACKEND_PUBLIC_URL` = URL do backend

Salve → o backend faz **redeploy** sozinho. (Pode separar várias origins por vírgula.)

---

## 6. Testar
1. Abra a URL do **frontend**.
2. Login: `admin` / sua `ADMIN_PASSWORD`.
3. Troque o **ramo** no topo, teste **Empresas / Mercado / Mapa / Clientes** e o
   **Enviar e-mail de teste** (Campanhas → E-mail).

---

## 7. (Opcional) WhatsApp / Evolution API
Só se for usar disparo/recebimento de WhatsApp. Adicione no mesmo projeto:
1. **Database → Add PostgreSQL** (banco da Evolution).
2. **Database → Add Redis** (cache da Evolution).
3. **New → Docker Image** → `evoapicloud/evolution-api:v2.3.7`, com **Volume** em
   `/evolution/instances`, e as variáveis (espelhe o `render.full.yaml`):
   - `SERVER_PORT=8080`, `SERVER_URL=<url pública da evolution>`
   - `AUTHENTICATION_API_KEY=<mesma chave do backend>`, `AUTHENTICATION_TYPE=apikey`
   - `DATABASE_ENABLED=true`, `DATABASE_PROVIDER=postgresql`,
     `DATABASE_CONNECTION_URI=<URL do Postgres do Railway>`
   - `CACHE_REDIS_ENABLED=true`, `CACHE_REDIS_URI=<URL do Redis do Railway>`, `CACHE_REDIS_PREFIX_KEY=evolution`
4. No **Backend**, adicione:
   - `EVOLUTION_API_URL=<url interna/pública da evolution>`
   - `EVOLUTION_API_KEY=<a mesma chave>`
   - `EVOLUTION_INSTANCE=imobpro`
   - `WEBHOOK_URL=<url do backend>/api/whatsapp/webhook`

---

## Resumo da ordem
**Push → Backend (root=backend) + vars + domínio → Frontend (root=frontend, NEXT_PUBLIC_API_URL=backend) + domínio → preencher FRONTEND_ORIGIN/APP_PUBLIC_URL no backend → testar.**

Lista completa de variáveis: ver `.env.example`.
