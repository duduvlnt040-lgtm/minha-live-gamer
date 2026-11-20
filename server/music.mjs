import { db, getAudioSigningSecret } from './db.mjs';
import crypto from 'node:crypto';
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';

export function createUserAudioToken(userId, filename) {
  const secret = getAudioSigningSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}:${path.basename(filename)}`)
    .digest('hex');
}

export function verifyUserAudioToken(userId, filename, token) {
  if (!token || typeof token !== 'string') return false;
  const expected = createUserAudioToken(userId, filename);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function signUserAudioUrl(userId, fileUrl) {
  if (!fileUrl || !fileUrl.startsWith(`/audio/user/${userId}/`)) return fileUrl;
  const filename = path.basename(fileUrl);
  const token = createUserAudioToken(userId, filename);
  return `${fileUrl}?token=${token}`;
}

export function listGlobalMusic(gameId = null, includeInactive = false) {
  let query = 'SELECT * FROM global_music WHERE 1=1';
  const params = [];

  if (!includeInactive) {
    query += ' AND is_active = 1';
  }

  if (gameId) {
    query += ' AND (game_id IS NULL OR game_id = ?)';
    params.push(gameId);
  }

  query += ' ORDER BY order_index ASC, created_at DESC';
  return db.prepare(query).all(...params);
}

export function addGlobalMusic(track) {
  const now = Date.now();
  const id = track.id || `gm_${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO global_music (
      id, name, artist, category, cover_url, file_url, file_path, default_volume, order_index, is_active, game_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    track.name || 'Nova Música',
    track.artist || 'Minha Live Game',
    track.category || 'Geral',
    track.cover_url || null,
    track.file_url,
    track.file_path,
    Number(track.default_volume ?? 80),
    Number(track.order_index ?? 0),
    track.is_active ? 1 : 0,
    track.game_id || null,
    now
  );

  return db.prepare('SELECT * FROM global_music WHERE id = ?').get(id);
}

export function updateGlobalMusic(id, updates) {
  const allowed = ['name', 'artist', 'category', 'cover_url', 'default_volume', 'order_index', 'is_active', 'game_id'];
  const fields = [];
  const values = [];

  for (const k of allowed) {
    if (updates[k] !== undefined) {
      fields.push(`${k} = ?`);
      if (k === 'is_active') {
        values.push(updates[k] ? 1 : 0);
      } else if (k === 'game_id') {
        values.push(updates[k] || null);
      } else {
        values.push(updates[k]);
      }
    }
  }

  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE global_music SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return db.prepare('SELECT * FROM global_music WHERE id = ?').get(id);
}

export function deleteGlobalMusic(id) {
  const track = db.prepare('SELECT file_path FROM global_music WHERE id = ?').get(id);
  db.prepare('DELETE FROM global_music WHERE id = ?').run(id);
  db.prepare("DELETE FROM playlist_tracks WHERE track_type = 'global' AND track_id = ?").run(id);

  if (track?.file_path && existsSync(track.file_path)) {
    try {
      rmSync(track.file_path, { force: true });
    } catch {}
  }
  return { ok: true };
}

// ==========================================
// USER PRIVATE MUSIC
// ==========================================
export function listUserMusic(userId, gameId = null) {
  let query = 'SELECT * FROM user_music WHERE user_id = ?';
  const params = [userId];

  if (gameId) {
    query += ' AND (game_id IS NULL OR game_id = ?)';
    params.push(gameId);
  }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
}

export function addUserMusic(userId, track) {
  const now = Date.now();
  const id = `um_${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO user_music (
      id, user_id, name, artist, file_url, file_path, duration, game_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    track.name || 'Minha Faixa',
    track.artist || 'Usuário',
    track.file_url,
    track.file_path,
    track.duration || 0,
    track.game_id || null,
    now
  );

  return db.prepare('SELECT * FROM user_music WHERE id = ?').get(id);
}

export function deleteUserMusic(userId, musicId) {
  const track = db.prepare('SELECT file_path FROM user_music WHERE id = ? AND user_id = ?').get(musicId, userId);
  db.prepare('DELETE FROM user_music WHERE id = ? AND user_id = ?').run(musicId, userId);
  db.prepare("DELETE FROM playlist_tracks WHERE track_type = 'user' AND track_id = ?").run(musicId);

  if (track?.file_path && existsSync(track.file_path)) {
    try {
      rmSync(track.file_path, { force: true });
    } catch {}
  }
  return { ok: true };
}

// ==========================================
// PLAYLISTS (USER + GAME COMBINATION)
// ==========================================
export function getUserPlaylist(userId, gameId, { signForOverlay = false } = {}) {
  const now = Date.now();
  let playlist = db.prepare('SELECT * FROM user_playlists WHERE user_id = ? AND game_id = ?').get(userId, gameId);

  if (!playlist) {
    const id = `pl_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO user_playlists (id, user_id, game_id, name, is_autoplay, is_repeat, volume, created_at, updated_at)
      VALUES (?, ?, ?, 'Playlist Oficial', 1, 1, 75, ?, ?)
    `).run(id, userId, gameId, now, now);
    playlist = db.prepare('SELECT * FROM user_playlists WHERE id = ?').get(id);
  }

  const rawTracks = db.prepare(`
    SELECT id, playlist_id, track_type, track_id, order_index, COALESCE(is_primary, 0) AS is_primary
    FROM playlist_tracks
    WHERE playlist_id = ?
    ORDER BY COALESCE(is_primary, 0) DESC, order_index ASC
  `).all(playlist.id);

  const populatedTracks = [];
  for (const pt of rawTracks) {
    if (pt.track_type === 'global') {
      const g = db.prepare('SELECT id, name, artist, category, cover_url, file_url, default_volume FROM global_music WHERE id = ? AND is_active = 1').get(pt.track_id);
      if (g) {
        populatedTracks.push({
          ...g,
          trackType: 'global',
          playlistTrackId: pt.id,
          orderIndex: pt.order_index,
          isPrimary: Boolean(pt.is_primary),
        });
      }
    } else if (pt.track_type === 'user') {
      const u = db.prepare('SELECT id, name, artist, file_url FROM user_music WHERE id = ? AND user_id = ?').get(pt.track_id, userId);
      if (u) {
        populatedTracks.push({
          ...u,
          file_url: signForOverlay ? signUserAudioUrl(userId, u.file_url) : u.file_url,
          trackType: 'user',
          playlistTrackId: pt.id,
          orderIndex: pt.order_index,
          isPrimary: Boolean(pt.is_primary),
        });
      }
    }
  }

  return {
    playlist,
    tracks: populatedTracks,
  };
}

export function saveUserPlaylist(userId, gameId, data) {
  const now = Date.now();
  const playlist = getUserPlaylist(userId, gameId).playlist;

  db.prepare(`
    UPDATE user_playlists
    SET name = ?, is_autoplay = ?, is_repeat = ?, volume = ?, updated_at = ?
    WHERE id = ?
  `).run(
    data.name || playlist.name,
    data.is_autoplay !== undefined ? (data.is_autoplay ? 1 : 0) : playlist.is_autoplay,
    data.is_repeat !== undefined ? (data.is_repeat ? 1 : 0) : playlist.is_repeat,
    Math.max(0, Math.min(100, Number(data.volume ?? playlist.volume))),
    now,
    playlist.id
  );

  // If new track list provided, update playlist_tracks (strict ownership validation)
  if (Array.isArray(data.tracks)) {
    db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlist.id);
    const insertTrack = db.prepare(`
      INSERT INTO playlist_tracks (id, playlist_id, track_type, track_id, order_index, is_primary)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    data.tracks.forEach((t, idx) => {
      if (!t || !t.id) return;
      const trackType = t.trackType === 'user' ? 'user' : 'global';
      if (trackType === 'user') {
        const owns = db.prepare('SELECT id FROM user_music WHERE id = ? AND user_id = ?').get(t.id, userId);
        if (!owns) return; // Never allow adding another user's private track
      } else {
        const exists = db.prepare('SELECT id FROM global_music WHERE id = ?').get(t.id);
        if (!exists) return;
      }
      insertTrack.run(`pt_${crypto.randomUUID()}`, playlist.id, trackType, t.id, idx, t.isPrimary ? 1 : 0);
    });
  }

  return getUserPlaylist(userId, gameId);
}
