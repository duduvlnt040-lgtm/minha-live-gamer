import './env.mjs';
import { db } from './db.mjs';

function isPlaceholder(val = '') {
  const s = String(val || '').trim().toLowerCase();
  if (!s) return true;
  return (
    s.includes('seu-projeto') ||
    s.includes('sua-chave') ||
    s.includes('your-project') ||
    s.includes('your-key') ||
    s === 'changeme'
  );
}

export function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const hasValidUrl = !isPlaceholder(url) && /^https?:\/\//i.test(url);
  const hasAnonKey = !isPlaceholder(anonKey) && anonKey.length >= 20;
  const hasServiceRoleKey = !isPlaceholder(serviceRoleKey) && serviceRoleKey.length >= 20;

  return {
    url: hasValidUrl ? url : '',
    anonKey: hasAnonKey ? anonKey : '',
    serviceRoleKey: hasServiceRoleKey ? serviceRoleKey : '',
    configured: hasValidUrl && (hasServiceRoleKey || hasAnonKey),
    hasServiceRoleKey,
    hasAnonKey,
  };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().configured;
}

function getAuthHeaders(useServiceRole = true) {
  const cfg = getSupabaseConfig();
  const key = useServiceRole && cfg.serviceRoleKey ? cfg.serviceRoleKey : cfg.anonKey;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Low-level PostgREST request against Supabase
 */
export async function supabaseRest(path, options = {}) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    return { ok: false, skipped: true, error: 'Supabase não configurado nas variáveis de ambiente.' };
  }

  const endpoint = `${cfg.url}/rest/v1/${path.replace(/^\/+/, '')}`;
  const res = await fetch(endpoint, {
    method: options.method || 'GET',
    headers: {
      ...getAuthHeaders(options.useServiceRole !== false),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs || 8000),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.message || data?.error_description || data?.hint || `HTTP ${res.status}`,
      data,
    };
  }

  return { ok: true, status: res.status, data };
}

export async function supabaseSelect(table, query = 'select=*&limit=50') {
  return supabaseRest(`${table}?${query}`, { method: 'GET' });
}

export async function supabaseUpsert(table, rows, onConflict = '') {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  return supabaseRest(`${table}${query}`, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: Array.isArray(rows) ? rows : [rows],
  });
}

export async function supabaseInsert(table, rows) {
  return supabaseRest(table, {
    method: 'POST',
    prefer: 'return=representation',
    body: Array.isArray(rows) ? rows : [rows],
  });
}

export async function supabaseDelete(table, filterQuery) {
  return supabaseRest(`${table}?${filterQuery}`, {
    method: 'DELETE',
  });
}

/**
 * Supabase Auth integration (backend-only, never exposes service key to client)
 */
export async function supabaseAuthEnsureUser({ email, password, displayName, role }) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured || !cfg.serviceRoleKey) {
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch(`${cfg.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          role: role || 'user',
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.msg || data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, user: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function supabaseAuthSignIn(email, password) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured || !cfg.anonKey) {
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error_description || data?.msg || `HTTP ${res.status}` };
    }
    return { ok: true, session: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Background mirror helpers: when Supabase env vars are configured, persist records to Supabase too
 */
export async function mirrorGameToSupabase(game) {
  if (!isSupabaseConfigured() || !game) return;
  try {
    await supabaseUpsert(
      'global_games',
      {
        id: game.id,
        name: game.name,
        slug: game.slug,
        description: game.description || '',
        category: game.category || 'Geral',
        version: game.version || '1.0.0',
        type: game.type || 'zip',
        entry_path: game.entry_path || 'index.html',
        directory: game.directory || null,
        cover_image: game.cover_image || null,
        thumbnail_image: game.thumbnail_image || null,
        is_active: Boolean(game.is_active),
        is_featured: Boolean(game.is_featured),
        is_validated: game.is_validated !== 0,
        order_index: Number(game.order_index || 0),
      },
      'id'
    );
  } catch (err) {
    console.warn('[Supabase Sync Game Warning]:', err.message);
  }
}

export async function mirrorGlobalMusicToSupabase(track) {
  if (!isSupabaseConfigured() || !track) return;
  try {
    await supabaseUpsert(
      'global_music',
      {
        id: track.id,
        name: track.name,
        artist: track.artist || 'Minha Live Game',
        category: track.category || 'Geral',
        cover_url: track.cover_url || null,
        file_url: track.file_url,
        file_path: track.file_path || track.file_url,
        default_volume: Number(track.default_volume ?? 80),
        order_index: Number(track.order_index ?? 0),
        is_active: Boolean(track.is_active),
        game_id: track.game_id || null,
      },
      'id'
    );
  } catch (err) {
    console.warn('[Supabase Sync Music Warning]:', err.message);
  }
}

/**
 * Real diagnostic check of both Local SQLite and Supabase connectivity.
 * NEVER exposes secret keys (returns only masked host & status).
 */
export async function checkDatabaseStatus() {
  // 1. Check real SQLite local connection
  let sqliteStatus = {
    connected: false,
    engine: 'SQLite 3 (node:sqlite WAL)',
    tablesCount: 0,
    usersCount: 0,
    gamesCount: 0,
    musicCount: 0,
    error: null,
  };

  try {
    const ping = db.prepare('SELECT 1 AS ok').get();
    const tables = db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get();
    const users = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    const games = db.prepare('SELECT COUNT(*) AS count FROM global_games').get();
    const music = db.prepare('SELECT COUNT(*) AS count FROM global_music').get();

    sqliteStatus = {
      connected: ping?.ok === 1,
      engine: 'SQLite 3 (node:sqlite WAL)',
      tablesCount: tables.count,
      usersCount: users.count,
      gamesCount: games.count,
      musicCount: music.count,
      error: null,
    };
  } catch (err) {
    sqliteStatus.error = err.message;
  }

  // 2. Check real Supabase connection if env vars are present
  const cfg = getSupabaseConfig();
  let maskedHost = null;
  if (cfg.url) {
    try {
      maskedHost = new URL(cfg.url).host;
    } catch {
      maskedHost = 'url-invalida';
    }
  }

  let supabaseStatus = {
    configured: cfg.configured,
    connected: false,
    host: maskedHost,
    authHealthy: false,
    schemaReady: false,
    hasServiceRoleKey: cfg.hasServiceRoleKey,
    hasAnonKey: cfg.hasAnonKey,
    schemaFile: 'supabase/schema.sql',
    error: cfg.configured
      ? null
      : 'Credenciais SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ainda não definidas no arquivo .env.',
  };

  if (cfg.configured) {
    try {
      // Check Auth health
      const authRes = await fetch(`${cfg.url}/auth/v1/health`, {
        headers: { apikey: cfg.anonKey || cfg.serviceRoleKey },
        signal: AbortSignal.timeout(6000),
      });
      supabaseStatus.authHealthy = authRes.ok;

      // Check PostgREST schema (global_games table)
      const restCheck = await supabaseRest('global_games?select=id&limit=1', { method: 'GET', timeoutMs: 6000 });
      if (restCheck.ok) {
        supabaseStatus.connected = true;
        supabaseStatus.schemaReady = true;
      } else {
        supabaseStatus.connected = authRes.ok;
        supabaseStatus.schemaReady = false;
        supabaseStatus.error = `Conexão Supabase respondeu, mas tabela global_games retornou: ${restCheck.error}. Execute supabase/schema.sql no SQL Editor do Supabase.`;
      }
    } catch (err) {
      supabaseStatus.connected = false;
      supabaseStatus.error = `Erro ao conectar no Supabase: ${err.message}`;
    }
  }

  const activePrimary =
    supabaseStatus.configured && supabaseStatus.connected && supabaseStatus.schemaReady
      ? 'supabase+sqlite'
      : 'sqlite';

  return {
    activePrimary,
    sqlite: sqliteStatus,
    supabase: supabaseStatus,
    checkedAt: Date.now(),
  };
}
