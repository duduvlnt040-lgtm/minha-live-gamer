# MINHA LIVE GAME — Arquitetura Railway (Backend) + Vercel (Frontend)

Plataforma SaaS completa de jogos interativos para TikTok LIVE preservando integralmente os 3 jogos oficiais:
- **Casamento da Barata 3D**
- **Corrida Maluca das Estrelas**
- **Recife das Bolhas**

## Arquitetura de Produção
- **Frontend (Vercel):** React + TypeScript + Vite (`vercel.json`, build `npm run build` → `dist/`), comunicando-se com o backend via `VITE_API_URL` e `VITE_WS_URL`.
- **Backend (Railway):** Express + WebSocket (`/ws/live`) + `tiktok-live-connector` v2.5.0 + Overlays OBS (`/overlay/:gameId/:userId`) + Cakto Webhook com validação HMAC/Secret + SQLite em **volume persistente (`/app/data`)** (`railway.json`, start `npm start`, healthcheck `/api/health`).
- **Supabase (Opcional):** Schema SQL completo com 17 tabelas e RLS em `supabase/schema.sql`, com espelhamento opcional via variáveis de ambiente no backend.

## Execução Local
```bash
npm install
npm run build
npm start
```
Acesse `http://127.0.0.1:3000`.

## Testes
```bash
npm run typecheck
npm run build
npm test
npm run test:upload
```
