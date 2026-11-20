# MINHA LIVE GAME — Plataforma SaaS de Jogos Interativos para TikTok LIVE

Plataforma profissional pronta para envio ao **GitHub** e publicação no **Vercel**, preservando todos os jogos (`Casamento da Barata 3D`, `Corrida Maluca das Estrelas`, `Recife das Bolhas`), Painel Administrativo exclusivo, Painel de Usuário Comum separado, Sistema de Músicas (global e particular), Integração Cakto (`R$ 49,99/mês` + 72h de teste), Conector real TikTok LIVE e integração Supabase.

---

## Estrutura Preparada para Vercel
- `api/index.mjs` — Entrypoint Serverless Functions do Vercel (exporta o app Express sem `server.listen`)
- `vercel.json` — Build Vite (`dist`), roteamento `/api/*`, `/overlay/*`, `/audio/*`, SPA fallback e headers CORS para `/games/*`
- `public/games/`, `public/covers/`, `public/audio/` — Jogos estáticos, capas e trilhas servidos via CDN no Vercel
- `src/` — Frontend React + TypeScript + Vite (Painel Admin Executivo + Painel Streamer)
- `server/` — Backend completo (Auth, Trial 72h, Cakto Webhook idempotente, Jogos, Músicas, TikTok LIVE, Supabase)
- `supabase/schema.sql` — Script SQL completo (17 tabelas, RLS, triggers, proteção contra escalação de privilégio e storage buckets)
- `.env.example` — Todas as variáveis de ambiente necessárias (sem senhas ou chaves secretas)

---

## Como Publicar no GitHub + Vercel

### 1. Configurar o Supabase
1. Crie um projeto em [supabase.com](https://supabase.com/dashboard).
2. Abra o **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e execute.
3. Em **Project Settings → API**, copie `Project URL`, `anon public` key e `service_role` key (mantenha a `service_role` apenas nas variáveis de ambiente do servidor/Vercel).

### 2. Enviar ao GitHub
```bash
git init
git add .
git commit -m "Deploy inicial Minha Live Game para Vercel"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/minha-live-game.git
git push -u origin main
```

### 3. Importar no Vercel
1. No [Vercel Dashboard](https://vercel.com/new), importe seu repositório do GitHub.
2. O Vercel detectará automaticamente as configurações em `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Node.js Version**: `22.x` (compatível com `engines.node >=22.12.0`)
3. Em **Settings → Environment Variables**, adicione as variáveis listadas em `.env.example`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - `AUDIO_SIGNING_SECRET`
   - `COOKIE_SECURE=true`
   - `ADMIN_EMAIL=duduvlnt040@gmail.com`
   - `CAKTO_OFFER_URL`, `CAKTO_PRODUCT_ID`, `CAKTO_OFFER_ID`, `CAKTO_WEBHOOK_SECRET`
   - `TIKTOK_SIGN_API_KEY` (opcional)
4. Clique em **Deploy**.

### 4. Configurar Webhook na Cakto
No painel da Cakto, aponte o Webhook de pagamentos para:
```
https://SEU-DOMINIO.vercel.app/api/webhooks/cakto
```

### Observação sobre WebSockets persistentes (TikTok LIVE 24/7)
O Vercel Serverless executa requisições HTTP sob demanda (até 60s) e não mantém conexões WebSocket abertas indefinidamente.
- Para transmissões longas de TikTok LIVE com WebSocket contínuo, você pode rodar este **mesmo repositório** com `npm start` em um servidor Node persistente (Railway, Render, Fly.io ou VPS) e configurar `VITE_WS_URL=wss://SEU-SERVIDOR-NODE/ws/live` nas variáveis de ambiente do Vercel.

---

## Execução Local
```bash
npm install
cp .env.example .env
npm run build
npm start
```
Acesse `http://127.0.0.1:3000`.
