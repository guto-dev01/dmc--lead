# Deploy na Render — ImobPro / Complexo DMC

O `docker-compose` não roda na Render. O arquivo `render.yaml` recria cada peça
como um serviço gerenciado. Siga os passos abaixo.

## 0. Pré-requisito: repositório no GitHub
A Render faz deploy a partir do Git. Crie um repositório (privado) e suba o projeto.
O `.gitignore` já protege o `.env` (suas senhas/chaves **não** vão para o GitHub).

```bash
git init
git add .
git commit -m "ImobPro/DMC inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/imobpro.git
git push -u origin main
```

## 1. Criar o Blueprint na Render
1. Acesse https://dashboard.render.com → **New** → **Blueprint**.
2. Conecte o repositório do GitHub.
3. A Render lê o `render.yaml` e mostra os serviços: banco `imobpro-db`,
   `evolution-db`, `imobpro-redis`, `imobpro-backend`, `imobpro-frontend`,
   `imobpro-evolution`.
4. Clique em **Apply**.

## 2. Preencher os segredos (campos marcados como "sync: false")
No painel de cada serviço, em **Environment**, defina:

**imobpro-backend**
- `EVOLUTION_API_KEY` → uma chave forte qualquer (ex.: `imobpro-prod-2026-xyz`)
- `ADMIN_PASSWORD` → senha de login do sistema
- `GOOGLE_API_KEY` e `GOOGLE_CSE_ID` → (opcional) para o "Mapear mercado"

**imobpro-evolution**
- `AUTHENTICATION_API_KEY` → **a MESMA** chave usada em `EVOLUTION_API_KEY` acima

## 3. Conferir as URLs (importante)
As URLs em `render.yaml` assumem os nomes `imobpro-backend`, `imobpro-frontend`
e `imobpro-evolution`. Se a Render adicionar um sufixo (quando o nome já existe),
as URLs reais mudam. Confira a URL de cada serviço no painel e, se forem
diferentes, ajuste estas variáveis e **refaça o deploy**:

| Serviço | Variável | Deve apontar para |
|---|---|---|
| imobpro-frontend | `NEXT_PUBLIC_API_URL` | URL do **backend** |
| imobpro-backend | `FRONTEND_ORIGIN` | URL do **frontend** |
| imobpro-backend | `EVOLUTION_API_URL` | URL da **evolution** |
| imobpro-backend | `WEBHOOK_URL` | URL do **backend** + `/api/whatsapp/webhook` |
| imobpro-evolution | `SERVER_URL` | URL da **evolution** |

> Mudou `NEXT_PUBLIC_API_URL`? O frontend precisa de **rebuild** (Manual Deploy →
> Clear build cache & deploy), pois essa URL é fixada no build.

## 4. Conectar o WhatsApp
1. Abra o frontend (`https://imobpro-frontend.onrender.com`) e faça login
   (usuário `admin`, senha definida em `ADMIN_PASSWORD`).
2. Vá em **WhatsApp** → gere o QR Code e escaneie no celular.
3. A sessão fica salva no disco da Evolution (não cai a cada deploy).

## Custos (resumo)
- `imobpro-evolution` precisa de plano pago (Starter) por causa do **disco** e por
  ter que ficar **sempre online**.
- Backend e Frontend: Starter recomendado (o free "dorme" e dá lentidão).
- Bancos e Redis: começam no free; **o Postgres free expira em ~30 dias** —
  troque por um plano pago para produção.

## Observação sobre planos
Se a Render recusar algum `plan:` do `render.yaml` (os nomes mudam de tempos em
tempos), ajuste o plano direto no painel do serviço — o resto da configuração
continua valendo.
