import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const IS_VERCEL = Boolean(process.env.VERCEL);
export const WRITABLE_DATA_DIR = IS_VERCEL
  ? join(os.tmpdir(), 'minha-live-game-data')
  : join(ROOT_DIR, 'data');

if (!existsSync(WRITABLE_DATA_DIR)) {
  mkdirSync(WRITABLE_DATA_DIR, { recursive: true });
}

const dbPath = join(WRITABLE_DATA_DIR, 'minha-live-game.sqlite3');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency & foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Official administrator emails
export const ADMIN_EMAILS = new Set([
  'duduvlnt040@gmail.com',
  'duduvln040@gmail.com',
]);

export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return ADMIN_EMAILS.has(email.toLowerCase().trim());
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
      is_suspended INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trial_periods (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_name TEXT NOT NULL DEFAULT 'MINHA LIVE GAME PREMIUM',
      amount REAL NOT NULL DEFAULT 49.99,
      status TEXT NOT NULL DEFAULT 'inactive', -- 'active', 'pending', 'canceled', 'expired', 'refunded'
      started_at INTEGER,
      expires_at INTEGER,
      cakto_transaction_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cakto_order_id TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      received_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cakto_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS global_games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      type TEXT NOT NULL DEFAULT 'zip', -- 'zip' or 'link'
      entry_path TEXT NOT NULL DEFAULT 'index.html',
      directory TEXT,
      cover_image TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_game_settings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL REFERENCES global_games(id) ON DELETE CASCADE,
      settings_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS user_game_triggers (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL REFERENCES global_games(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      event_type TEXT NOT NULL, -- 'gift', 'comment', 'like', 'follow', 'share'
      filter_value TEXT,
      min_value INTEGER NOT NULL DEFAULT 1,
      action TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    -- =========================================================
    -- SISTEMA DE MÚSICAS: GLOBAL (ADMIN) E PRIVADO (USUÁRIOS)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS global_music (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT 'Minha Live Game',
      category TEXT NOT NULL DEFAULT 'Festiva',
      cover_url TEXT,
      file_url TEXT NOT NULL,
      file_path TEXT NOT NULL,
      default_volume INTEGER NOT NULL DEFAULT 80,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      game_id TEXT, -- NULL para todos os jogos, ou ID de jogo específico
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_music (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT 'Minha Trilha',
      file_url TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration REAL,
      game_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_playlists (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL REFERENCES global_games(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Minha Playlist',
      is_autoplay INTEGER NOT NULL DEFAULT 1,
      is_repeat INTEGER NOT NULL DEFAULT 1,
      volume INTEGER NOT NULL DEFAULT 75,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
      track_type TEXT NOT NULL, -- 'global' ou 'user'
      track_id TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS live_connections (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tiktok_username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'connecting', 'connected', 'error'
      connected_at INTEGER,
      last_event_at INTEGER,
      total_events INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recent_events (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT,
      event_type TEXT NOT NULL,
      user_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurred_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_games_slug ON global_games(slug);
    CREATE INDEX IF NOT EXISTS idx_events_user ON recent_events(user_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_global_music_game ON global_music(game_id);
    CREATE INDEX IF NOT EXISTS idx_user_music_user ON user_music(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_playlists ON user_playlists(user_id, game_id);
  `);

  migrateSchemaColumns();
  migrateAdminAccounts();
  seedInitialData();
}

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[DB] Added column ${table}.${column}`);
  }
}

function migrateSchemaColumns() {
  ensureColumn('global_games', 'thumbnail_image', 'TEXT');
  ensureColumn('global_games', 'is_validated', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('playlist_tracks', 'is_primary', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'tiktok_username', "TEXT DEFAULT ''");
}

export function logAudit(userId, action, details = {}) {
  try {
    const serialized = typeof details === 'string' ? details : JSON.stringify(details);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, details, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId ?? null, String(action), serialized, Date.now());
  } catch (err) {
    console.error('[Audit Log Error]:', err.message);
  }
}

export function getAudioSigningSecret() {
  if (process.env.AUDIO_SIGNING_SECRET) {
    return process.env.AUDIO_SIGNING_SECRET;
  }
  const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'internal_audio_secret'").get();
  if (row?.value) {
    try { return JSON.parse(row.value); } catch { return row.value; }
  }
  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('internal_audio_secret', ?, ?)
    ON CONFLICT(key) DO NOTHING
  `).run(JSON.stringify(secret), Date.now());
  return secret;
}

// Scrypt password hashing
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, storedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Migration helper to ensure duduvlnt040@gmail.com and duduvln040@gmail.com
 * are permanently elevated to admin with lifetime status, preserving passwords.
 */
function migrateAdminAccounts() {
  const now = Date.now();
  for (const email of ADMIN_EMAILS) {
    const existing = db.prepare('SELECT id, role, is_suspended FROM users WHERE email = ?').get(email);
    if (existing) {
      if (existing.role !== 'admin' || existing.is_suspended) {
        db.prepare("UPDATE users SET role = 'admin', is_suspended = 0 WHERE id = ?").run(existing.id);
        console.log(`[DB] Migrated account ${email} to full administrator role.`);
      }

      // Ensure lifetime trial marker
      const hasTrial = db.prepare('SELECT user_id FROM trial_periods WHERE user_id = ?').get(existing.id);
      if (!hasTrial) {
        db.prepare('INSERT INTO trial_periods (user_id, started_at, expires_at, is_active) VALUES (?, ?, ?, 1)')
          .run(existing.id, now, now + 36500 * 86400 * 1000);
      } else {
        db.prepare('UPDATE trial_periods SET expires_at = ?, is_active = 1 WHERE user_id = ?')
          .run(now + 36500 * 86400 * 1000, existing.id);
      }
    }
  }
}

function seedInitialData() {
  const now = Date.now();

  // Seed Cakto configuration defaults if not present
  const caktoConfigs = [
    ['offer_url', 'https://cakto.com.br/checkout/minha-live-game-premium'],
    ['product_id', 'prod_minha_live_game_premium'],
    ['offer_id', 'off_mensal_4990'],
    ['webhook_secret', 'cakto_wh_secret_live_game'],
  ];
  for (const [key, val] of caktoConfigs) {
    const exists = db.prepare('SELECT key FROM cakto_config WHERE key = ?').get(key);
    if (!exists) {
      db.prepare('INSERT INTO cakto_config (key, value) VALUES (?, ?)').run(key, val);
    }
  }

  // Seed Starter Games
  const starterGames = [
    {
      id: 'casamento-da-barata-3d',
      name: 'Casamento da Barata 3D',
      slug: 'casamento-da-barata-3d',
      description: 'O casamento mais agitado da internet! A cerimônia 3D interativa mais divertida do TikTok LIVE. Cada presente coroa a noiva, movimenta os padrinhos e faz o salão dançar em 3D!',
      category: '3D Interativo',
      version: '1.2.0',
      type: 'zip',
      entry_path: 'index.html',
      directory: 'casamento-da-barata-3d',
      cover_image: '/covers/casamento-da-barata-3d.svg',
      is_active: 1,
      is_featured: 1,
      order_index: 1,
    },
    {
      id: 'corrida-das-estrelas',
      name: 'Corrida Maluca das Estrelas',
      slug: 'corrida-das-estrelas',
      description: 'Disputa de corrida multiplayer ao vivo onde os espectadores escolhem seus carros e impulsionam com comentários, curtidas e presentes do TikTok!',
      category: 'Competitivo',
      version: '1.0.0',
      type: 'zip',
      entry_path: 'index.html',
      directory: 'corrida-das-estrelas',
      cover_image: '/covers/corrida-das-estrelas.svg',
      is_active: 1,
      is_featured: 1,
      order_index: 2,
    },
    {
      id: 'recife-das-bolhas',
      name: 'Recife das Bolhas',
      slug: 'recife-das-bolhas',
      description: 'Aquário interativo no fundo do mar. Os espectadores soltam bolhas, invocam tubarões e baús de tesouros em tempo real.',
      category: 'Simulação',
      version: '1.0.0',
      type: 'zip',
      entry_path: 'index.html',
      directory: 'recife-das-bolhas',
      cover_image: '/covers/recife-das-bolhas.svg',
      is_active: 1,
      is_featured: 0,
      order_index: 3,
    },
  ];

  for (const game of starterGames) {
    const exists = db.prepare('SELECT id FROM global_games WHERE id = ?').get(game.id);
    if (!exists) {
      db.prepare(`
        INSERT INTO global_games (id, name, slug, description, category, version, type, entry_path, directory, cover_image, is_active, is_featured, order_index, created_at, updated_at)
        VALUES (@id, @name, @slug, @description, @category, @version, @type, @entry_path, @directory, @cover_image, @is_active, @is_featured, @order_index, ${now}, ${now})
      `).run(game);
      console.log(`[DB] Seeded starter game: ${game.name}`);
    }
  }

  // Seed Starter Global Music tracks
  const starterMusic = [
    {
      id: 'music-marcha-nupcial-arrocha',
      name: 'Marcha Nupcial no Arrocha 3D',
      artist: 'Banda da Barata Oficial',
      category: 'Cerimônia',
      cover_url: '/covers/casamento-da-barata-3d.svg',
      file_url: '/audio/marcha_arrocha.wav',
      file_path: 'marcha_arrocha.wav',
      default_volume: 85,
      order_index: 1,
      is_active: 1,
      game_id: 'casamento-da-barata-3d',
    },
    {
      id: 'music-baile-dos-padrinhos',
      name: 'Baile dos Padrinhos e Noivos',
      artist: 'Minha Live Game Beats',
      category: 'Dança',
      cover_url: '/covers/casamento-da-barata-3d.svg',
      file_url: '/audio/baile_padrinhos.wav',
      file_path: 'baile_padrinhos.wav',
      default_volume: 75,
      order_index: 2,
      is_active: 1,
      game_id: 'casamento-da-barata-3d',
    },
    {
      id: 'music-corrida-turbo-beat',
      name: 'Corrida Turbo Synthwave',
      artist: 'Electro Live',
      category: 'Velocidade',
      cover_url: '/covers/corrida-das-estrelas.svg',
      file_url: '/audio/corrida_turbo.wav',
      file_path: 'corrida_turbo.wav',
      default_volume: 80,
      order_index: 3,
      is_active: 1,
      game_id: 'corrida-das-estrelas',
    },
    {
      id: 'music-mar-calmo-aquario',
      name: 'Ondas Relaxantes do Recife',
      artist: 'Ambient Ocean',
      category: 'Relaxante',
      cover_url: '/covers/recife-das-bolhas.svg',
      file_url: '/audio/recife_ondas.wav',
      file_path: 'recife_ondas.wav',
      default_volume: 65,
      order_index: 4,
      is_active: 1,
      game_id: 'recife-das-bolhas',
    },
  ];

  for (const track of starterMusic) {
    const exists = db.prepare('SELECT id, file_url FROM global_music WHERE id = ?').get(track.id);
    if (!exists) {
      db.prepare(`
        INSERT INTO global_music (id, name, artist, category, cover_url, file_url, file_path, default_volume, order_index, is_active, game_id, created_at)
        VALUES (@id, @name, @artist, @category, @cover_url, @file_url, @file_path, @default_volume, @order_index, @is_active, @game_id, ${now})
      `).run(track);
      console.log(`[DB] Seeded starter global music: ${track.name}`);
    } else if (exists.file_url && exists.file_url.endsWith('.mp3') && exists.file_url.startsWith('/audio/')) {
      db.prepare('UPDATE global_music SET file_url = ?, file_path = ? WHERE id = ?')
        .run(track.file_url, track.file_path, track.id);
    }
  }
}

// Auto-run init on module load
initDatabase();
