import { db, DATA_DIR } from './db.mjs';
import { mkdirSync, existsSync, readdirSync, statSync, rmSync, createWriteStream, cpSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import yauzl from 'yauzl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT_DIR = resolve(__dirname, '..');
const GAMES_DIR = join(DATA_DIR, 'games');
const PREVIEWS_DIR = join(DATA_DIR, 'previews');

if (!existsSync(GAMES_DIR)) {
  mkdirSync(GAMES_DIR, { recursive: true });
}
if (!existsSync(PREVIEWS_DIR)) {
  mkdirSync(PREVIEWS_DIR, { recursive: true });
}

export function listGlobalGames(includeInactive = false) {
  const query = includeInactive
    ? 'SELECT * FROM global_games ORDER BY order_index ASC, created_at DESC'
    : 'SELECT * FROM global_games WHERE is_active = 1 ORDER BY order_index ASC, created_at DESC';
  return db.prepare(query).all();
}

export function getGameById(gameId, userId = null) {
  const game = db.prepare('SELECT * FROM global_games WHERE id = ?').get(gameId);
  if (!game) return null;

  let userSettings = {};
  let userTriggers = [];

  if (userId) {
    const sRow = db.prepare('SELECT settings_json FROM user_game_settings WHERE user_id = ? AND game_id = ?').get(userId, gameId);
    if (sRow?.settings_json) {
      try {
        userSettings = JSON.parse(sRow.settings_json);
      } catch {}
    }

    userTriggers = db.prepare('SELECT * FROM user_game_triggers WHERE user_id = ? AND game_id = ?').all(userId, gameId);
  }

  return {
    ...game,
    userSettings,
    userTriggers,
  };
}

export function saveUserSettings(userId, gameId, settings) {
  const now = Date.now();
  const settingsJson = JSON.stringify(settings || {});
  db.prepare(`
    INSERT INTO user_game_settings (user_id, game_id, settings_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, game_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at
  `).run(userId, gameId, settingsJson, now);
  return { ok: true, savedAt: now };
}

export function saveUserTrigger(userId, gameId, trigger) {
  const now = Date.now();
  const id = trigger.id || `trig_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO user_game_triggers (id, user_id, game_id, name, event_type, filter_value, min_value, action, duration, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      event_type = excluded.event_type,
      filter_value = excluded.filter_value,
      min_value = excluded.min_value,
      action = excluded.action,
      duration = excluded.duration,
      is_active = excluded.is_active
  `).run(
    id,
    userId,
    gameId,
    trigger.name || 'Novo Gatilho',
    trigger.event_type || 'gift',
    trigger.filter_value || '',
    Number(trigger.min_value || 1),
    trigger.action || 'boost',
    Number(trigger.duration || 5),
    trigger.is_active ? 1 : 0,
    now
  );
  return { id, ok: true };
}

export function deleteUserTrigger(userId, triggerId) {
  db.prepare('DELETE FROM user_game_triggers WHERE id = ? AND user_id = ?').run(triggerId, userId);
  return { ok: true };
}

function findEntryHtml(dir) {
  // Check root
  if (existsSync(join(dir, 'index.html'))) return 'index.html';

  // Check 1 level deep subdirectories
  const items = readdirSync(dir);
  for (const item of items) {
    const full = join(dir, item);
    if (statSync(full).isDirectory()) {
      if (existsSync(join(full, 'index.html'))) {
        return `${item}/index.html`;
      }
    }
  }
  return null;
}

function extractZipToDirectory(zipFilePath, targetDir) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }
    mkdirSync(targetDir, { recursive: true });

    let fileCount = 0;

    yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return rejectPromise(new Error(`Falha ao abrir arquivo ZIP: ${err.message}`));

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const fileName = entry.fileName.replace(/\\/g, '/');
        // Prevent path traversal
        if (fileName.includes('..') || fileName.startsWith('/')) {
          zipfile.readEntry();
          return;
        }

        const fullPath = join(targetDir, fileName);

        if (/\/$/.test(fileName)) {
          mkdirSync(fullPath, { recursive: true });
          zipfile.readEntry();
        } else {
          const parentDir = dirname(fullPath);
          if (parentDir && !existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true });
          }
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return rejectPromise(streamErr);
            const writeStream = createWriteStream(fullPath);
            fileCount += 1;
            readStream.pipe(writeStream);
            writeStream.on('finish', () => zipfile.readEntry());
            writeStream.on('error', rejectPromise);
          });
        }
      });

      zipfile.on('end', () => {
        const entryHtml = findEntryHtml(targetDir);
        if (!entryHtml) {
          try { rmSync(targetDir, { recursive: true, force: true }); } catch {}
          return rejectPromise(new Error('Nenhum arquivo index.html encontrado na raiz ou nas subpastas do arquivo ZIP.'));
        }
        resolvePromise({ targetDir, entryHtml, fileCount });
      });

      zipfile.on('error', rejectPromise);
    });
  });
}

export function extractZipGame(zipFilePath, slug) {
  const targetDir = join(GAMES_DIR, slug);
  return extractZipToDirectory(zipFilePath, targetDir);
}

export async function extractZipPreview(zipFilePath) {
  const previewId = `prev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const targetDir = join(PREVIEWS_DIR, previewId);
  const { entryHtml, fileCount } = await extractZipToDirectory(zipFilePath, targetDir);
  return {
    previewId,
    entryHtml,
    fileCount,
    previewUrl: `/game-previews/${previewId}/${entryHtml}`,
  };
}

export function promotePreviewToGame(previewId, slug) {
  const safeId = String(previewId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const sourceDir = join(PREVIEWS_DIR, safeId);
  if (!safeId || !existsSync(sourceDir)) {
    throw new Error('Prévia não encontrada ou expirada. Faça o upload do arquivo ZIP novamente.');
  }
  const entryHtml = findEntryHtml(sourceDir);
  if (!entryHtml) {
    throw new Error('A prévia não contém um arquivo index.html válido.');
  }

  const targetDir = join(GAMES_DIR, slug);
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  try { rmSync(sourceDir, { recursive: true, force: true }); } catch {}

  return { targetDir, entryHtml };
}

export async function validateGameLink(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('A URL deve começar com http:// ou https://');
    }

    const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'MinhaLiveGame/1.0' } });
    if (!res.ok) {
      throw new Error(`A URL respondeu com código de erro HTTP ${res.status}.`);
    }

    const xFrame = (res.headers.get('x-frame-options') || '').toUpperCase();
    if (xFrame === 'DENY' || xFrame === 'SAMEORIGIN') {
      throw new Error(`O site bloqueia incorporação em iframe (X-Frame-Options: ${xFrame}). Não é possível utilizá-lo como jogo embutido.`);
    }

    const csp = (res.headers.get('content-security-policy') || '').toLowerCase();
    if (csp.includes("frame-ancestors 'none'") || csp.includes("frame-ancestors 'self'")) {
      throw new Error('O site bloqueia incorporação via Content-Security-Policy (frame-ancestors).');
    }

    return { ok: true, url };
  } catch (err) {
    throw new Error(`Validação da URL falhou: ${err.message}`);
  }
}

export function createGame(gameData) {
  const now = Date.now();
  const baseSlug = (gameData.slug || gameData.id || `game_${crypto.randomUUID()}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  let slug = baseSlug;
  let suffix = 1;
  while (db.prepare('SELECT id FROM global_games WHERE id = ? OR slug = ?').get(slug, slug)) {
    slug = `${baseSlug}-${suffix++}`;
  }
  const id = slug;

  db.prepare(`
    INSERT INTO global_games (
      id, name, slug, description, category, version, type, entry_path, directory, cover_image, thumbnail_image, is_active, is_featured, is_validated, order_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    gameData.name,
    slug,
    gameData.description || '',
    gameData.category || 'Geral',
    gameData.version || '1.0.0',
    gameData.type || 'zip',
    gameData.entry_path || 'index.html',
    gameData.directory ?? (gameData.type === 'link' ? null : slug),
    gameData.cover_image || '/covers/default-game.svg',
    gameData.thumbnail_image || gameData.cover_image || '/covers/default-game.svg',
    gameData.is_active ? 1 : 0,
    gameData.is_featured ? 1 : 0,
    gameData.is_validated === false ? 0 : 1,
    Number(gameData.order_index || 0),
    now,
    now
  );

  return getGameById(id);
}

export function updateGame(gameId, updates) {
  const now = Date.now();
  const fields = [];
  const values = [];

  const allowed = [
    'name',
    'description',
    'category',
    'version',
    'cover_image',
    'thumbnail_image',
    'is_active',
    'is_featured',
    'is_validated',
    'order_index',
    'entry_path',
    'directory',
  ];
  for (const k of allowed) {
    if (updates[k] !== undefined) {
      fields.push(`${k} = ?`);
      if (['is_active', 'is_featured', 'is_validated'].includes(k)) {
        values.push(updates[k] ? 1 : 0);
      } else {
        values.push(updates[k]);
      }
    }
  }

  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(now);
    values.push(gameId);
    db.prepare(`UPDATE global_games SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return getGameById(gameId);
}

export function deleteGame(gameId) {
  const game = db.prepare('SELECT directory FROM global_games WHERE id = ?').get(gameId);
  db.prepare('DELETE FROM global_games WHERE id = ?').run(gameId);

  if (game?.directory) {
    const gamePath = join(GAMES_DIR, game.directory);
    if (existsSync(gamePath) && !['casamento-da-barata-3d', 'corrida-das-estrelas', 'recife-das-bolhas'].includes(game.directory)) {
      try {
        rmSync(gamePath, { recursive: true, force: true });
      } catch {}
    }
  }
  return { ok: true };
}
