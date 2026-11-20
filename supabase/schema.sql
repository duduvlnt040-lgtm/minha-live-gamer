-- =========================================================================
-- MINHA LIVE GAME — SUPABASE SQL SCHEMA COMPLETO COM RLS, TRIGGERS E STORAGE
-- Plataforma SaaS de Jogos Interativos para TikTok LIVE
-- Conta Proprietária Vitalícia: duduvlnt040@gmail.com
-- =========================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. PROFILES (Vinculado a auth.users)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  tiktok_username TEXT DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =========================================================================
-- 2. TRIAL PERIODS (3 dias / 72 horas para usuários comuns)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.trial_periods (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + INTERVAL '72 hours'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =========================================================================
-- 3. SUBSCRIPTIONS (Plano Único: MINHA LIVE GAME PREMIUM - R$ 49,99/mês)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'MINHA LIVE GAME PREMIUM',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 49.99,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'pending', 'canceled', 'expired', 'refunded', 'chargeback')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cakto_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =========================================================================
-- 4. PAYMENTS & WEBHOOK EVENTS (Idempotência e Auditoria Cakto)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cakto_order_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id TEXT PRIMARY KEY, -- Chave de idempotência do evento Cakto
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =========================================================================
-- 5. CAKTO CONFIGURAÇÕES & PLATFORM SETTINGS (Exclusivo Administrador)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cakto_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =========================================================================
-- 6. GLOBAL GAMES (Biblioteca Global gerenciada EXCLUSIVAMENTE pelo Admin)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.global_games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  type TEXT NOT NULL DEFAULT 'zip' CHECK (type IN ('zip', 'link')),
  entry_path TEXT NOT NULL DEFAULT 'index.html',
  directory TEXT,
  cover_image TEXT,
  thumbnail_image TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_validated BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  config_schema JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =========================================================================
-- 7. USER GAME SETTINGS & TRIGGERS (Isolamento Total por Usuário)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.user_game_settings (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES public.global_games(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, game_id)
);

CREATE TABLE IF NOT EXISTS public.game_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES public.global_games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('gift', 'comment', 'like', 'follow', 'share', 'member')),
  filter_value TEXT,
  min_value INTEGER NOT NULL DEFAULT 1,
  action TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =========================================================================
-- 8. SISTEMA DE MÚSICAS: GLOBAL (ADMIN) E PRIVADO (USUÁRIOS) + PLAYLISTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.global_music (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'Minha Live Game',
  category TEXT NOT NULL DEFAULT 'Geral',
  cover_url TEXT,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  default_volume INTEGER NOT NULL DEFAULT 80 CHECK (default_volume BETWEEN 0 AND 100),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  game_id TEXT REFERENCES public.global_games(id) ON DELETE SET NULL, -- NULL = disponível globalmente
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_music (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'Minha Trilha',
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration NUMERIC(10, 2) DEFAULT 0,
  game_id TEXT REFERENCES public.global_games(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES public.global_games(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Playlist Oficial',
  is_autoplay BOOLEAN NOT NULL DEFAULT TRUE,
  is_repeat BOOLEAN NOT NULL DEFAULT TRUE,
  volume INTEGER NOT NULL DEFAULT 75 CHECK (volume BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, game_id)
);

CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL REFERENCES public.user_playlists(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (track_type IN ('global', 'user')),
  track_id TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================================================================
-- 9. LIVE CONNECTIONS, RECENT EVENTS & AUDIT LOGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.live_connections (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tiktok_username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  connected_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  total_events INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id TEXT REFERENCES public.global_games(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_global_games_active ON public.global_games(is_active, order_index);
CREATE INDEX IF NOT EXISTS idx_global_music_game ON public.global_music(game_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_music_user ON public.user_music(user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_user_playlists_user_game ON public.user_playlists(user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id, order_index);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =========================================================================
-- 10. FUNÇÕES DE SEGURANÇA NO BACKEND (IMUNE A MANIPULAÇÃO DO FRONTEND)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_official_admin_email(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN lower(trim(COALESCE(p_email, ''))) IN ('duduvlnt040@gmail.com', 'duduvln040@gmail.com');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (public.is_official_admin_email(email) OR role = 'admin')
      AND is_suspended = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_active_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
  v_suspended BOOLEAN;
  v_has_sub BOOLEAN;
  v_has_trial BOOLEAN;
BEGIN
  SELECT role, email, is_suspended INTO v_role, v_email, v_suspended
  FROM public.profiles WHERE id = p_user_id;

  -- Conta proprietária / administrador tem acesso vitalício irrestrito
  IF public.is_official_admin_email(v_email) OR v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_suspended THEN
    RETURN FALSE;
  END IF;

  -- Verifica assinatura ativa (MINHA LIVE GAME PREMIUM - R$ 49,99/mês)
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > timezone('utc', now()))
  ) INTO v_has_sub;
  IF v_has_sub THEN
    RETURN TRUE;
  END IF;

  -- Verifica período de teste gratuito (72 horas)
  SELECT EXISTS (
    SELECT 1 FROM public.trial_periods
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND expires_at > timezone('utc', now())
  ) INTO v_has_trial;

  RETURN v_has_trial;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =========================================================================
-- 11. TRIGGERS DE CADASTRO AUTOMÁTICO E PROTEÇÃO CONTRA ESCALAÇÃO DE ROLE
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_role TEXT;
  v_trial_expires TIMESTAMPTZ;
BEGIN
  v_is_admin := public.is_official_admin_email(NEW.email);
  v_role := CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END;
  v_trial_expires := CASE
    WHEN v_is_admin THEN timezone('utc', now()) + INTERVAL '100 years'
    ELSE timezone('utc', now()) + INTERVAL '72 hours'
  END;

  INSERT INTO public.profiles (id, email, display_name, role, is_suspended)
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_role,
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN public.is_official_admin_email(EXCLUDED.email) THEN 'admin' ELSE public.profiles.role END,
    updated_at = timezone('utc', now());

  INSERT INTO public.trial_periods (user_id, started_at, expires_at, is_active)
  VALUES (NEW.id, timezone('utc', now()), v_trial_expires, TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Impede que usuários comuns elevem a própria role para 'admin' via REST/Client SDK
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_official_admin_email(NEW.email) THEN
    NEW.role := 'admin';
    NEW.is_suspended := FALSE;
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    NEW.role := OLD.role;
    NEW.is_suspended := OLD.is_suspended;
  END IF;

  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- Migração segura: se duduvlnt040@gmail.com já existir, eleva para admin vitalício preservando dados
UPDATE public.profiles
SET role = 'admin', is_suspended = FALSE, updated_at = timezone('utc', now())
WHERE public.is_official_admin_email(email);

-- =========================================================================
-- 12. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cakto_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_music ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_music ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: PROFILES
DROP POLICY IF EXISTS "Usuários veem o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários veem o próprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Usuários editam o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários editam o próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- POLÍTICAS: GLOBAL GAMES (Somente Admin escreve; todos veem publicados)
DROP POLICY IF EXISTS "Todos visualizam jogos ativos" ON public.global_games;
CREATE POLICY "Todos visualizam jogos ativos" ON public.global_games
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Apenas admin gerencia jogos globais" ON public.global_games;
CREATE POLICY "Apenas admin gerencia jogos globais" ON public.global_games
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLÍTICAS: GLOBAL MUSIC (Somente Admin escreve; usuários veem ativas)
DROP POLICY IF EXISTS "Todos visualizam músicas globais ativas" ON public.global_music;
CREATE POLICY "Todos visualizam músicas globais ativas" ON public.global_music
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Apenas admin gerencia músicas globais" ON public.global_music;
CREATE POLICY "Apenas admin gerencia músicas globais" ON public.global_music
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLÍTICAS: USER PRIVATE MUSIC (Isolamento estrito: nunca aparece para outro usuário)
DROP POLICY IF EXISTS "Isolamento absoluto de músicas particulares" ON public.user_music;
CREATE POLICY "Isolamento absoluto de músicas particulares" ON public.user_music
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- POLÍTICAS: USER PLAYLISTS & TRACKS
DROP POLICY IF EXISTS "Isolamento de playlists do usuário" ON public.user_playlists;
CREATE POLICY "Isolamento de playlists do usuário" ON public.user_playlists
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Isolamento de faixas de playlists" ON public.playlist_tracks;
CREATE POLICY "Isolamento de faixas de playlists" ON public.playlist_tracks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_playlists p
      WHERE p.id = playlist_id AND (p.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_playlists p
      WHERE p.id = playlist_id AND (p.user_id = auth.uid() OR public.is_admin())
    )
  );

-- POLÍTICAS: USER GAME SETTINGS & TRIGGERS
DROP POLICY IF EXISTS "Isolamento total de configurações de jogos" ON public.user_game_settings;
CREATE POLICY "Isolamento total de configurações de jogos" ON public.user_game_settings
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Isolamento total de gatilhos" ON public.game_triggers;
CREATE POLICY "Isolamento total de gatilhos" ON public.game_triggers
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- POLÍTICAS: LIVE CONNECTIONS & GAME EVENTS
DROP POLICY IF EXISTS "Isolamento total de conexão TikTok" ON public.live_connections;
CREATE POLICY "Isolamento total de conexão TikTok" ON public.live_connections
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Isolamento total de eventos da live" ON public.game_events;
CREATE POLICY "Isolamento total de eventos da live" ON public.game_events
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- POLÍTICAS: CAKTO, PLATFORM SETTINGS, PAYMENTS, WEBHOOKS & AUDIT LOGS
DROP POLICY IF EXISTS "Apenas admin gerencia Cakto" ON public.cakto_config;
CREATE POLICY "Apenas admin gerencia Cakto" ON public.cakto_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Apenas admin gerencia configurações da plataforma" ON public.platform_settings;
CREATE POLICY "Apenas admin gerencia configurações da plataforma" ON public.platform_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Apenas admin vê webhooks" ON public.payment_webhook_events;
CREATE POLICY "Apenas admin vê webhooks" ON public.payment_webhook_events
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Apenas admin vê logs de auditoria" ON public.audit_logs;
CREATE POLICY "Apenas admin vê logs de auditoria" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Usuários consultam seus pagamentos" ON public.payments;
CREATE POLICY "Usuários consultam seus pagamentos" ON public.payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Usuários consultam sua própria assinatura" ON public.subscriptions;
CREATE POLICY "Usuários consultam sua própria assinatura" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Apenas admin altera assinaturas manualmente" ON public.subscriptions;
CREATE POLICY "Apenas admin altera assinaturas manualmente" ON public.subscriptions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Usuários consultam seu próprio teste" ON public.trial_periods;
CREATE POLICY "Usuários consultam seu próprio teste" ON public.trial_periods
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- =========================================================================
-- 13. SUPABASE STORAGE BUCKETS & ISOLAMENTO DE MÚSICAS PARTICULARES
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('game-assets', 'game-assets', TRUE),
  ('global-music', 'global-music', TRUE),
  ('user-private-music', 'user-private-music', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Músicas particulares: apenas o próprio usuário pode ler/enviar/deletar dentro da pasta {user_id}/
DROP POLICY IF EXISTS "Usuário gerencia seus próprios áudios privados" ON storage.objects;
CREATE POLICY "Usuário gerencia seus próprios áudios privados" ON storage.objects
  FOR ALL USING (
    bucket_id = 'user-private-music'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-private-music'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Assets globais e músicas globais: somente admin envia/altera
DROP POLICY IF EXISTS "Apenas admin gerencia assets e músicas globais" ON storage.objects;
CREATE POLICY "Apenas admin gerencia assets e músicas globais" ON storage.objects
  FOR ALL USING (
    bucket_id IN ('game-assets', 'global-music')
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id IN ('game-assets', 'global-music')
    AND public.is_admin()
  );
