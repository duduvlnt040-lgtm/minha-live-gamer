# MINHA LIVE GAME — Plataforma SaaS de Jogos Interativos para TikTok LIVE

Plataforma full-stack profissional preservando integralmente os 3 jogos oficiais:
- **Casamento da Barata 3D**
- **Corrida Maluca das Estrelas**
- **Recife das Bolhas**

Com Painel Administrativo exclusivo (`duduvlnt040@gmail.com` — acesso vitalício), Painel do Usuário Comum separado, teste gratuito de 72 horas (3 dias), assinatura mensal **R$ 49,99/mês** via Cakto (webhook validado com HMAC/Secret e idempotência), sistema de músicas globais e particulares, overlays OBS em tempo real e conector real TikTok LIVE (`tiktok-live-connector` v2.5.0).

---

## Arquitetura de Produção
- **Frontend (Vercel):** React 19 + TypeScript + Vite (`vercel.json`, `npm run build` → `dist/`), comunicando-se com o backend via `VITE_API_URL` e `VITE_WS_URL`.
- **Backend (Railway):** Node.js >= 22.12 + Express + WebSocket (`/ws/live`) + Overlays OBS (`/overlay/:gameId/:userId`) + SQLite persistente em volume (`/app/data`, via `DATA_DIR` / `RAILWAY_VOLUME_MOUNT_PATH`), configurado em `railway.json` (`npm start`, healthcheck `/api/health`).
- **Supabase (Integração Backend via `.env`):** Schema completo em `supabase/schema.sql` (17 tabelas, RLS, triggers e storage buckets) + cliente backend em `server/supabase.mjs` (sem expor chaves no frontend).

---

## Execução e Testes no Windows (PowerShell)
Requisitos: **Node.js 22.12+** (ou superior).

```powershell
# 1. Instalar dependências
npm install

# 2. (Opcional) Copiar modelo de variáveis de ambiente
Copy-Item .env.example .env

# 3. Verificar tipos TypeScript e gerar build de produção
npm run typecheck
npm run build

# 4. Rodar testes automatizados
npm test
npm run test:upload

# 5. Iniciar servidor completo em produção local
npm start
```
Acesse no navegador: `http://127.0.0.1:3000`

Para desenvolvimento com hot-reload (Vite middleware + Express):
```powershell
npm run dev
```

---

## Implantação (Railway + Vercel + Supabase + Cakto)

### 1. Backend no Railway
1. Conecte o repositório GitHub (branch `main`). O Railway usa `railway.json` (`npm start`, healthcheck `/api/health`).
2. Monte um **Volume Persistente** em `/app/data`.
3. Configure as variáveis de ambiente listadas em `.env.example`:
   - `NODE_ENV=production`, `DATA_DIR=/app/data`
   - `FRONTEND_URL=https://SEU-APP.vercel.app`
   - `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`
   - `SESSION_SECRET`, `AUDIO_SIGNING_SECRET`, `ADMIN_EMAIL=duduvlnt040@gmail.com`
   - `CAKTO_OFFER_URL`, `CAKTO_PRODUCT_ID`, `CAKTO_OFFER_ID`, `CAKTO_WEBHOOK_SECRET`
   - *(Opcionais)* `TIKTOK_SIGN_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 2. Frontend no Vercel
1. Importe o repositório GitHub (Framework: Vite, Build: `npm run build`, Output: `dist`, Node: `22.x`).
2. Configure em **Environment Variables**:
   - `VITE_API_URL=https://SEU-BACKEND.up.railway.app`
   - `VITE_WS_URL=wss://SEU-BACKEND.up.railway.app/ws/live`

### 3. Supabase (Opcional / Nuvem)
1. Execute `supabase/schema.sql` no SQL Editor do Supabase.
2. Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` apenas nas variáveis do Railway (nunca no frontend).

### 4. Webhook Cakto
Configure no painel da Cakto:
```
https://SEU-BACKEND.up.railway.app/api/webhooks/cakto
```