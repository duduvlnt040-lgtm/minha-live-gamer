import './env.mjs';
import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';

import { db, initDatabase, isAdminEmail, logAudit, WRITABLE_DATA_DIR } from './db.mjs';
import {
  checkDatabaseStatus,
  mirrorGameToSupabase,
  mirrorGlobalMusicToSupabase,
  supabaseAuthEnsureUser,
} from './supabase.mjs';
import {
  requireAuth,
  requireAdmin,
  getUserFromRequest,
  createSession,
  clearSession,
  registerUser,
  loginUser,
  updateUserProfile,
  changeUserPassword,
} from './auth.mjs';
import { getUserAccessStatus, requireActiveAccess } from './trial.mjs';
import {
  getCaktoConfig,
  updateCaktoConfig,
  processCaktoWebhook,
  listWebhookEvents,
  listPayments,
} from './cakto.mjs';
import {
  listGlobalGames,
  getGameById,
  saveUserSettings,
  saveUserTrigger,
  deleteUserTrigger,
  extractZipGame,
  extractZipPreview,
  promotePreviewToGame,
  validateGameLink,
  createGame,
  updateGame,
  deleteGame,
} from './games.mjs';
import {
  listGlobalMusic,
  addGlobalMusic,
  updateGlobalMusic,
  deleteGlobalMusic,
  listUserMusic,
  addUserMusic,
  deleteUserMusic,
  getUserPlaylist,
  saveUserPlaylist,
  verifyUserAudioToken,
} from './music.mjs';
import {
  connectTikTokLive,
  disconnectTikTokLive,
  getLiveStatus,
  simulateLiveEvent,
  registerUserSocket,
  broadcastToUser,
} from './tiktok.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const IS_VERCEL = Boolean(process.env.VERCEL);

const STATIC_GAMES_DIR = path.join(ROOT_DIR, 'data', 'games');
const PUBLIC_GAMES_DIR = path.join(ROOT_DIR, 'public', 'games');
const PUBLIC_COVERS_DIR = path.join(ROOT_DIR, 'public', 'covers');
const AUDIO_PUBLIC_DIR = path.join(ROOT_DIR, 'public', 'audio');

const GAMES_DIR = path.join(WRITABLE_DATA_DIR, 'games');
const PREVIEWS_DIR = path.join(WRITABLE_DATA_DIR, 'previews');
const WRITABLE_COVERS_DIR = IS_VERCEL ? path.join(WRITABLE_DATA_DIR, 'covers') : PUBLIC_COVERS_DIR;
const UPLOAD_TEMP_DIR = path.join(WRITABLE_DATA_DIR, 'incoming');
const MUSIC_GLOBAL_DIR = path.join(WRITABLE_DATA_DIR, 'music', 'global');
const MUSIC_USERS_DIR = path.join(WRITABLE_DATA_DIR, 'music', 'users');

[
  GAMES_DIR,
  PREVIEWS_DIR,
  WRITABLE_COVERS_DIR,
  UPLOAD_TEMP_DIR,
  MUSIC_GLOBAL_DIR,
  MUSIC_USERS_DIR,
].forEach((d) => {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
});

function saveUploadedImage(file, prefix = 'cover') {
  if (!file) return null;
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
  if (!allowedExts.includes(ext)) {
    try { unlinkSync(file.path); } catch {}
    throw new Error('Formato de imagem inválido. Envie PNG, JPG, WEBP, GIF ou SVG.');
  }
  const fileName = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const targetPath = path.join(WRITABLE_COVERS_DIR, fileName);
  copyFileSync(file.path, targetPath);
  try { unlinkSync(file.path); } catch {}
  return `/covers/${fileName}`;
}

// Configure Multer for ZIP, Covers and Audio uploads
const upload = multer({
  dest: UPLOAD_TEMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

const audioUpload = multer({
  dest: UPLOAD_TEMP_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'coverFile') {
      if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
        return cb(null, true);
      }
      return cb(new Error('Capa inválida. Use PNG, JPG, WEBP ou SVG.'));
    }
    if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de áudio não suportado. Envie MP3, WAV, OGG ou M4A.'));
    }
  },
});

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static covers & assets (writable uploads + bundled public assets)
app.use('/covers', express.static(WRITABLE_COVERS_DIR));
app.use('/covers', express.static(PUBLIC_COVERS_DIR));
app.use('/covers', express.static(path.join(ROOT_DIR, 'data', 'covers')));
app.use('/assets', express.static(path.join(ROOT_DIR, 'public', 'assets')));
app.use('/audio', express.static(AUDIO_PUBLIC_DIR));
app.use('/audio/global', express.static(MUSIC_GLOBAL_DIR));

// Strictly protected private audio serving for user-uploaded tracks
app.get('/audio/user/:userId/:filename', (req, res) => {
  const targetUserId = String(req.params.userId || '').replace(/[^0-9]/g, '');
  const safeFilename = path.basename(req.params.filename || '');
  if (!targetUserId || !safeFilename) {
    return res.status(400).send('Parâmetros inválidos');
  }

  const authUser = getUserFromRequest(req);
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const isOwner = authUser && (String(authUser.id) === targetUserId || authUser.isAdmin);
  const hasValidToken = verifyUserAudioToken(targetUserId, safeFilename, token);

  if (!isOwner && !hasValidToken) {
    return res.status(403).json({ error: 'Acesso negado. Esta música pertence a outra conta.' });
  }

  const filePath = path.join(MUSIC_USERS_DIR, targetUserId, safeFilename);
  if (!existsSync(filePath)) {
    return res.status(404).send('Áudio não encontrado');
  }
  res.sendFile(filePath);
});

// Serve game files directly with CORS and no iframe restriction (writable + bundled)
app.use(
  '/games',
  (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(GAMES_DIR),
  express.static(STATIC_GAMES_DIR),
  express.static(PUBLIC_GAMES_DIR)
);

// Serve admin game previews before publishing (admin-only)
app.use('/game-previews', requireAdmin, (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(PREVIEWS_DIR));

// Create HTTP and WebSocket server (persistent WebSockets run on standard Node server)
const server = http.createServer(app);
if (!IS_VERCEL) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/ws/live', `http://${req.headers.host || 'localhost'}`);
    const user = getUserFromRequest(req);
    const tokenUserId = url.searchParams.get('userId');
    const userId = user?.id || (tokenUserId ? Number(tokenUserId) : null);

    if (!userId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Não autenticado no WebSocket.' }));
      ws.close(1008, 'Unauthorized');
      return;
    }

    registerUserSocket(userId, ws);

    // Send initial live status
    ws.send(JSON.stringify({
      type: 'live:status',
      payload: getLiveStatus(userId),
    }));

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.action === 'connect' && msg.username) {
          await connectTikTokLive(userId, msg.username);
        } else if (msg.action === 'disconnect') {
          await disconnectTikTokLive(userId);
        } else if (msg.action === 'simulate' && msg.event) {
          simulateLiveEvent(userId, msg.event);
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });
  });
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const user = registerUser(email, password, displayName);
    createSession(res, user.id);
    const access = getUserAccessStatus(user);
    // Non-blocking mirror to Supabase Auth when env credentials are configured
    supabaseAuthEnsureUser({
      email: user.email,
      password,
      displayName: user.displayName,
      role: user.role,
    }).catch(() => {});
    res.json({ ok: true, user, access });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const user = loginUser(email, password);
    createSession(res, user.id);
    const access = getUserAccessStatus(user);
    res.json({ ok: true, user, access });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.json({ user: null, access: getUserAccessStatus(null) });
  }
  const access = getUserAccessStatus(user);
  res.json({ user, access });
});

app.get('/api/user/profile', requireAuth, (req, res) => {
  const access = getUserAccessStatus(req.user);
  res.json({ user: req.user, access });
});

app.put('/api/user/profile', requireAuth, (req, res) => {
  try {
    const updatedUser = updateUserProfile(req.user.id, req.body || {});
    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/user/password', requireAuth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = changeUserPassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. SUBSCRIPTION & CAKTO CLIENT ROUTES
// ==========================================
app.get('/api/subscription/plan', (req, res) => {
  const config = getCaktoConfig();
  res.json({
    name: 'MINHA LIVE GAME PREMIUM',
    price: 49.99,
    priceFormatted: 'R$ 49,99/mês',
    period: 'mensal',
    trialDays: 3,
    checkoutUrl: config.offer_url,
    features: [
      'Acesso completo a todos os jogos interativos da plataforma',
      'Conexão real e automática com TikTok LIVE sem necessidade de senha',
      'Overlays transparentes ilimitados compatíveis com OBS Studio e TikTok LIVE Studio',
      'Painel de controle com 7 abas de personalização avançada',
      'Sistema de músicas personalizadas e playlists automáticas',
      'Gatilhos configuráveis para presentes, comentários e curtidas',
      'Simulador de eventos em tempo real para testes antes da LIVE',
      'Atualizações semanais com novos jogos e recursos',
    ],
  });
});

// ==========================================
// 3. CAKTO WEBHOOK ENDPOINT
// ==========================================
app.post('/api/webhooks/cakto', async (req, res) => {
  try {
    const result = await processCaktoWebhook(req);
    res.json(result);
  } catch (err) {
    console.error('[Cakto Webhook Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. USER GAME & LIBRARY ROUTES
// ==========================================
app.get('/api/games', (req, res) => {
  const user = getUserFromRequest(req);
  const includeInactive = user?.isAdmin;
  const games = listGlobalGames(includeInactive);
  res.json({ games });
});

app.get('/api/games/:id', (req, res) => {
  const user = getUserFromRequest(req);
  const game = getGameById(req.params.id, user?.id);
  if (!game) {
    return res.status(404).json({ error: 'Jogo não encontrado.' });
  }
  res.json({ game });
});

// Save user settings (strictly isolated per user & game)
app.put('/api/games/:id/settings', requireAuth, (req, res) => {
  try {
    const result = saveUserSettings(req.user.id, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Triggers management (isolated per user)
app.post('/api/games/:id/triggers', requireAuth, requireActiveAccess, (req, res) => {
  try {
    const result = saveUserTrigger(req.user.id, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/games/:id/triggers/:triggerId', requireAuth, requireActiveAccess, (req, res) => {
  try {
    const result = deleteUserTrigger(req.user.id, req.params.triggerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. MUSIC & PLAYLIST ROUTES (GLOBAL & USER)
// ==========================================

// Global music listing for games (open to users)
app.get('/api/music/global', (req, res) => {
  const gameId = req.query.gameId ? String(req.query.gameId) : null;
  res.json({ tracks: listGlobalMusic(gameId, false) });
});

// Admin list global music (including inactive)
app.get('/api/admin/music', requireAdmin, (req, res) => {
  res.json({ tracks: listGlobalMusic(null, true) });
});

// Admin add global music track (audio + optional cover)
app.post(
  '/api/admin/music/upload',
  requireAdmin,
  audioUpload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const files = req.files || {};
      const audioFile = Array.isArray(files.audioFile) ? files.audioFile[0] : null;
      const coverFile = Array.isArray(files.coverFile) ? files.coverFile[0] : null;

      if (!audioFile) {
        return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado.' });
      }

      const { name, artist, category, defaultVolume, orderIndex, isActive, gameId } = req.body;
      const ext = path.extname(audioFile.originalname).toLowerCase();
      const fileName = `global_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const targetPath = path.join(MUSIC_GLOBAL_DIR, fileName);

      copyFileSync(audioFile.path, targetPath);
      try { unlinkSync(audioFile.path); } catch {}

      let coverUrl = null;
      if (coverFile) {
        coverUrl = saveUploadedImage(coverFile, 'music_cover');
      }

      const track = addGlobalMusic({
        name: name || audioFile.originalname.replace(ext, ''),
        artist: artist || 'Minha Live Game',
        category: category || 'Geral',
        cover_url: coverUrl,
        file_url: `/audio/global/${fileName}`,
        file_path: targetPath,
        default_volume: Number(defaultVolume ?? 80),
        order_index: Number(orderIndex ?? 0),
        game_id: gameId && gameId !== 'all' ? gameId : null,
        is_active: isActive === 'false' || isActive === false ? 0 : 1,
      });

      logAudit(req.user.id, 'GLOBAL_MUSIC_ADDED', { trackId: track.id, name: track.name, gameId: track.game_id });
      mirrorGlobalMusicToSupabase(track).catch(() => {});

      res.json({ ok: true, track });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.put('/api/admin/music/:id', requireAdmin, (req, res) => {
  try {
    const track = updateGlobalMusic(req.params.id, req.body);
    logAudit(req.user.id, 'GLOBAL_MUSIC_UPDATED', { trackId: req.params.id });
    res.json({ ok: true, track });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/music/:id', requireAdmin, (req, res) => {
  try {
    const result = deleteGlobalMusic(req.params.id);
    logAudit(req.user.id, 'GLOBAL_MUSIC_DELETED', { trackId: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// User private music routes
app.get('/api/music/my', requireAuth, (req, res) => {
  const gameId = req.query.gameId ? String(req.query.gameId) : null;
  res.json({ tracks: listUserMusic(req.user.id, gameId) });
});

app.post('/api/music/my/upload', requireAuth, audioUpload.single('audioFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado.' });
    }

    const { name, artist, gameId } = req.body;
    const userDir = path.join(MUSIC_USERS_DIR, String(req.user.id));
    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileName = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const targetPath = path.join(userDir, fileName);

    copyFileSync(req.file.path, targetPath);
    try { unlinkSync(req.file.path); } catch {}

    const track = addUserMusic(req.user.id, {
      name: name || req.file.originalname.replace(ext, ''),
      artist: artist || req.user.displayName,
      file_url: `/audio/user/${req.user.id}/${fileName}`,
      file_path: targetPath,
      game_id: gameId || null,
    });

    res.json({ ok: true, track });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/music/my/:id', requireAuth, (req, res) => {
  try {
    const result = deleteUserMusic(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// User playlist for specific game
app.get('/api/games/:gameId/playlist', requireAuth, (req, res) => {
  const result = getUserPlaylist(req.user.id, req.params.gameId);
  res.json(result);
});

app.put('/api/games/:gameId/playlist', requireAuth, (req, res) => {
  try {
    const result = saveUserPlaylist(req.user.id, req.params.gameId, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 6. TIKTOK LIVE CONNECTION ROUTES (REAL CONNECTION ONLY)
// ==========================================
app.get('/api/live/status', requireAuth, (req, res) => {
  res.json(getLiveStatus(req.user.id));
});

app.post('/api/live/connect', requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { username } = req.body || {};
    const status = await connectTikTokLive(req.user.id, username);
    res.json({ ok: true, status });
  } catch (err) {
    const liveStatus = err.liveStatus || getLiveStatus(req.user.id);
    const code = err.statusCode || (liveStatus.status === 'offline' ? 409 : 400);
    res.status(code).json({
      ok: false,
      error: err.message,
      status: liveStatus,
    });
  }
});

app.post('/api/live/disconnect', requireAuth, async (req, res) => {
  try {
    const result = await disconnectTikTokLive(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/live/simulate', requireAuth, (req, res) => {
  try {
    const result = simulateLiveEvent(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/live/recent-events', requireAuth, (req, res) => {
  const limit = Math.min(100, Number(req.query.limit || 50));
  const rows = db.prepare(`
    SELECT id, event_type AS type, user_name AS user, payload, occurred_at AS timestamp
    FROM recent_events
    WHERE user_id = ?
    ORDER BY occurred_at DESC LIMIT ?
  `).all(req.user.id, limit);

  const events = rows.map((r) => {
    try {
      return { ...JSON.parse(r.payload), id: r.id, timestamp: r.timestamp };
    } catch {
      return { id: r.id, type: r.type, user: r.user, timestamp: r.timestamp };
    }
  });

  res.json({ events });
});

// ==========================================
// 7. OVERLAY SERVING ROUTE (WITH AUDIO ENGINE)
// ==========================================
app.get('/overlay/:gameId/:userId', (req, res) => {
  const { gameId, userId } = req.params;
  const game = getGameById(gameId, userId);
  if (!game) {
    return res.status(404).send('<h1>Jogo não encontrado</h1>');
  }

  // Fetch target user's access status
  const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(userId);
  if (!targetUser) {
    return res.status(404).send('<h1>Usuário do overlay não encontrado</h1>');
  }

  const access = getUserAccessStatus(targetUser);
  if (!access.hasAccess) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Overlay Bloqueado</title>
      <style>
        body { margin: 0; background: rgba(0,0,0,0.85); color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }
        .card { background: #160d29; border: 2px solid #7c3aed; border-radius: 16px; padding: 32px; max-width: 480px; box-shadow: 0 0 40px rgba(124, 58, 237, 0.4); }
        h1 { color: #c084fc; font-size: 24px; margin-bottom: 12px; }
        p { color: #cbd5e1; line-height: 1.5; }
      </style>
      </head>
      <body>
        <div class="card">
          <h1>Período de Teste Expirado</h1>
          <p>O teste gratuito de 3 dias desta conta foi finalizado. Ative sua assinatura no painel <strong>Minha Live Game</strong> para liberar a transmissão do jogo no OBS / TikTok LIVE Studio.</p>
        </div>
      </body>
      </html>
    `);
  }

  // Fetch playlist for this user and game (with HMAC signed URLs for private user audio)
  const playlistData = getUserPlaylist(userId, gameId, { signForOverlay: true });
  const tracksJson = JSON.stringify(playlistData.tracks || []);
  const autoplay = Boolean(playlistData.playlist.is_autoplay);
  const loop = Boolean(playlistData.playlist.is_repeat);
  const volume = Number(playlistData.playlist.volume || 75) / 100;

  const gameSrc = game.type === 'link' ? game.entry_path : `/games/${game.directory}/${game.entry_path}`;

  // Generate complete OBS Browser Source overlay with SDK Bridge & Audio Player
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Overlay — ${game.name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
        #game-frame { width: 100vw; height: 100vh; border: none; background: transparent; display: block; }
      </style>
    </head>
    <body>
      <iframe
        id="game-frame"
        src="${gameSrc}?backend=1&overlay=1&ws=ws://${req.headers.host}/ws/live?userId=${userId}"
        allow="autoplay; fullscreen"
      ></iframe>

      <!-- Overlay Audio Engine -->
      <audio id="overlay-audio" preload="auto"></audio>

      <script>
        (function() {
          const userId = "${userId}";
          const gameId = "${gameId}";
          const frame = document.getElementById('game-frame');
          const audio = document.getElementById('overlay-audio');
          const tracks = ${tracksJson};
          let currentTrackIndex = 0;
          const isAutoplay = ${autoplay};
          const isLoop = ${loop};
          const baseVolume = ${volume};

          if (audio) {
            audio.volume = Math.max(0, Math.min(1, baseVolume));
            audio.addEventListener('ended', function() {
              if (tracks.length > 0) {
                if (currentTrackIndex + 1 < tracks.length) {
                  currentTrackIndex += 1;
                  playTrack(currentTrackIndex);
                } else if (isLoop) {
                  currentTrackIndex = 0;
                  playTrack(currentTrackIndex);
                }
              }
            });
          }

          function playTrack(idx) {
            if (!audio || !tracks[idx]) return;
            audio.src = tracks[idx].file_url;
            audio.play().catch(function() {
              console.log('[Overlay Audio] Autoplay deferred until interaction');
            });
          }

          if (isAutoplay && tracks.length > 0) {
            playTrack(0);
          }

          // WebSocket connection for real-time events
          const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = proto + '//' + window.location.host + '/ws/live?userId=' + userId;

          function connect() {
            const ws = new WebSocket(wsUrl);
            ws.onmessage = function(event) {
              try {
                const data = JSON.parse(event.data);
                if (frame && frame.contentWindow) {
                  frame.contentWindow.postMessage(data, '*');
                  if (data.type === 'live:event') {
                    frame.contentWindow.postMessage({
                      type: 'minha-live-games:event',
                      payload: data.payload
                    }, '*');
                  }
                }
              } catch (e) {}
            };
            ws.onclose = function() {
              setTimeout(connect, 2000);
            };
          }
          connect();

          window.addEventListener('click', function() {
            if (audio && audio.paused && tracks.length > 0) {
              playTrack(currentTrackIndex);
            }
          });
        })();
      </script>
    </body>
    </html>
  `);
});

// ==========================================
// 8. ADMIN MANAGEMENT & METRICS ROUTES
// ==========================================
app.get('/api/admin/metrics', requireAdmin, (req, res) => {
  const now = Date.now();
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin'").get().count;
  const activeSubs = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?)").get(now).count;
  const expiredSubs = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status != 'active' OR (expires_at IS NOT NULL AND expires_at <= ?)").get(now).count;
  const activeTrials = db.prepare(`
    SELECT COUNT(*) as count
    FROM trial_periods t
    JOIN users u ON u.id = t.user_id
    WHERE u.role != 'admin'
      AND t.is_active = 1
      AND t.expires_at > ?
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > ?))
  `).get(now, now).count;
  const publishedGames = db.prepare("SELECT COUNT(*) as count FROM global_games WHERE is_active = 1").get().count;
  const totalGames = db.prepare("SELECT COUNT(*) as count FROM global_games").get().count;
  const totalMusic = db.prepare("SELECT COUNT(*) as count FROM global_music WHERE is_active = 1").get().count;
  const totalUserMusic = db.prepare("SELECT COUNT(*) as count FROM user_music").get().count;
  const monthlyRevenue = Number((activeSubs * 49.99).toFixed(2));
  const liveConnections = db.prepare("SELECT COUNT(*) as count FROM live_connections WHERE status = 'connected'").get().count;
  const paymentsRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'approved'").get();

  const recentActivity = db.prepare(`
    SELECT a.id, a.action, a.details, a.created_at AS createdAt, u.email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 25
  `).all();

  res.json({
    totalUsers,
    activeSubs,
    expiredSubs,
    activeTrials,
    publishedGames,
    totalGames,
    totalMusic,
    totalUserMusic,
    monthlyRevenue,
    liveConnections,
    paymentsCount: paymentsRow.count,
    paymentsTotal: Number(Number(paymentsRow.total || 0).toFixed(2)),
    recentActivity,
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.display_name AS displayName, u.role, u.is_suspended AS isSuspended, u.created_at AS createdAt,
           COALESCE(u.tiktok_username, '') AS tiktokUsername,
           t.started_at AS trialStartedAt, t.expires_at AS trialExpiresAt,
           (SELECT status FROM subscriptions s WHERE s.user_id = u.id ORDER BY s.updated_at DESC LIMIT 1) AS subStatus,
           (SELECT expires_at FROM subscriptions s WHERE s.user_id = u.id ORDER BY s.updated_at DESC LIMIT 1) AS subExpiresAt
    FROM users u
    LEFT JOIN trial_periods t ON t.user_id = u.id
    ORDER BY u.created_at DESC
  `).all();

  res.json({ users });
});

app.post('/api/admin/users/:id/suspend', requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  const target = db.prepare('SELECT email, role FROM users WHERE id = ?').get(targetId);
  if (target && (isAdminEmail(target.email) || target.role === 'admin')) {
    return res.status(400).json({ error: 'O proprietário da plataforma não pode ser suspenso.' });
  }
  db.prepare('UPDATE users SET is_suspended = 1 WHERE id = ?').run(targetId);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
  logAudit(req.user.id, 'USER_SUSPENDED', { targetUserId: targetId, email: target?.email });
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/reactivate', requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  db.prepare('UPDATE users SET is_suspended = 0 WHERE id = ?').run(targetId);
  logAudit(req.user.id, 'USER_REACTIVATED', { targetUserId: targetId });
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/grant-subscription', requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  const now = Date.now();
  const expiresAt = now + 30 * 86400 * 1000;
  const subId = `sub_manual_${targetId}_${now}`;
  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan_name, amount, status, started_at, expires_at, cakto_transaction_id, created_at, updated_at)
    VALUES (?, ?, 'MINHA LIVE GAME PREMIUM', 49.99, 'active', ?, ?, 'admin_granted', ?, ?)
  `).run(subId, targetId, now, expiresAt, now, now);
  logAudit(req.user.id, 'ADMIN_GRANTED_SUBSCRIPTION', { targetUserId: targetId, subId });
  res.json({ ok: true, subId, expiresAt });
});

// Admin Subscriptions Management
app.get('/api/admin/subscriptions', requireAdmin, (req, res) => {
  const subscriptions = db.prepare(`
    SELECT s.id, s.user_id AS userId, s.plan_name AS planName, s.amount, s.status,
           s.started_at AS startedAt, s.expires_at AS expiresAt, s.cakto_transaction_id AS transactionId,
           s.created_at AS createdAt, s.updated_at AS updatedAt,
           u.email, u.display_name AS displayName
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC
  `).all();
  res.json({ subscriptions });
});

app.post('/api/admin/subscriptions/:id/cancel', requireAdmin, (req, res) => {
  const subId = req.params.id;
  db.prepare("UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE id = ?").run(Date.now(), subId);
  logAudit(req.user.id, 'ADMIN_CANCELED_SUBSCRIPTION', { subId });
  res.json({ ok: true });
});

// Admin Payments History
app.get('/api/admin/payments', requireAdmin, (req, res) => {
  const payments = listPayments(200);
  const totalApproved = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'approved'").get().total;
  res.json({ payments, totalApproved: Number(Number(totalApproved || 0).toFixed(2)) });
});

// Admin Audit Logs
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const limit = Math.min(300, Number(req.query.limit || 100));
  const logs = db.prepare(`
    SELECT a.id, a.user_id AS userId, a.action, a.details, a.created_at AS createdAt,
           u.email, u.display_name AS displayName, u.role
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT ?
  `).all(limit);
  res.json({ logs });
});

// Admin Security Overview
app.get('/api/admin/security', requireAdmin, (req, res) => {
  const now = Date.now();
  const activeSessions = db.prepare(`
    SELECT s.user_id AS userId, COUNT(*) AS sessionCount, MAX(s.expires_at) AS latestExpiry,
           u.email, u.display_name AS displayName, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > ?
    GROUP BY s.user_id
    ORDER BY latestExpiry DESC
  `).all(now);

  const suspendedUsers = db.prepare(`
    SELECT id, email, display_name AS displayName, created_at AS createdAt
    FROM users WHERE is_suspended = 1
  `).all();

  const adminAccounts = db.prepare(`
    SELECT id, email, display_name AS displayName, role, created_at AS createdAt
    FROM users WHERE role = 'admin'
  `).all();

  res.json({
    activeSessions,
    suspendedUsers,
    adminAccounts,
    policies: {
      adminOwnerEmail: 'duduvlnt040@gmail.com',
      backendRoleValidation: true,
      httpOnlySessionCookies: true,
      privateUserAudioHmacProtection: true,
      scryptPasswordHashing: true,
      caktoWebhookIdempotency: true,
    },
  });
});

app.post('/api/admin/security/revoke-sessions/:userId', requireAdmin, (req, res) => {
  const targetId = Number(req.params.userId);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Use o botão Sair para encerrar sua própria sessão.' });
  }
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
  logAudit(req.user.id, 'ADMIN_REVOKED_SESSIONS', { targetUserId: targetId });
  res.json({ ok: true });
});

// Admin Preview Game ZIP before publishing (validates index.html and serves real game)
app.post('/api/admin/games/preview-zip', requireAdmin, upload.single('zipFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo ZIP enviado para validação.' });
    }
    const preview = await extractZipPreview(req.file.path);
    try { unlinkSync(req.file.path); } catch {}
    res.json({ ok: true, validated: true, ...preview });
  } catch (err) {
    try { if (req.file?.path) unlinkSync(req.file.path); } catch {}
    res.status(400).json({ error: err.message });
  }
});

// Admin Validate Game Link before publishing
app.post('/api/admin/games/validate-link', requireAdmin, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: 'Informe uma URL válida para testar.' });
    }
    const result = await validateGameLink(url);
    res.json({ ok: true, validated: true, previewUrl: result.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Add Game by ZIP upload (supports direct zipFile OR validated previewId + optional cover/thumbnail)
app.post(
  '/api/admin/games/upload-zip',
  requireAdmin,
  upload.fields([
    { name: 'zipFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      const zipFile = Array.isArray(files.zipFile) ? files.zipFile[0] : null;
      const coverFile = Array.isArray(files.coverFile) ? files.coverFile[0] : null;
      const thumbnailFile = Array.isArray(files.thumbnailFile) ? files.thumbnailFile[0] : null;

      const { name, category, description, version, orderIndex, isActive, isFeatured, previewId } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'O nome do jogo é obrigatório.' });
      }
      if (!zipFile && !previewId) {
        return res.status(400).json({ error: 'Envie e valide o arquivo ZIP do jogo antes de publicar.' });
      }

      const rawSlug = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `game-${Date.now()}`;
      let uniqueSlug = rawSlug;
      let idx = 1;
      while (db.prepare('SELECT id FROM global_games WHERE id = ? OR slug = ?').get(uniqueSlug, uniqueSlug)) {
        uniqueSlug = `${rawSlug}-${idx++}`;
      }

      let entryHtml = 'index.html';
      if (previewId) {
        const promoted = promotePreviewToGame(previewId, uniqueSlug);
        entryHtml = promoted.entryHtml;
      } else if (zipFile) {
        const extracted = await extractZipGame(zipFile.path, uniqueSlug);
        entryHtml = extracted.entryHtml;
        try { unlinkSync(zipFile.path); } catch {}
      }

      const coverImage = saveUploadedImage(coverFile, 'game_cover') || '/covers/default-game.svg';
      const thumbnailImage = saveUploadedImage(thumbnailFile, 'game_thumb') || coverImage;

      const game = createGame({
        id: uniqueSlug,
        slug: uniqueSlug,
        name: String(name).trim(),
        description: String(description || '').trim(),
        category: category || '3D Interativo',
        version: version || '1.0.0',
        type: 'zip',
        entry_path: entryHtml,
        directory: uniqueSlug,
        cover_image: coverImage,
        thumbnail_image: thumbnailImage,
        is_active: isActive === 'true' || isActive === true || isActive === 1 || isActive === undefined,
        is_featured: isFeatured === 'true' || isFeatured === true || isFeatured === 1,
        is_validated: true,
        order_index: Number(orderIndex || 0),
      });

      logAudit(req.user.id, 'GLOBAL_GAME_PUBLISHED', { gameId: game.id, name: game.name, type: 'zip' });
      mirrorGameToSupabase(game).catch(() => {});

      res.json({ ok: true, game });
    } catch (err) {
      console.error('[Upload ZIP Error]:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// Admin Add Game by Link (supports JSON or multipart with coverFile/thumbnailFile)
app.post(
  '/api/admin/games/link',
  requireAdmin,
  upload.fields([
    { name: 'coverFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      const coverFile = Array.isArray(files.coverFile) ? files.coverFile[0] : null;
      const thumbnailFile = Array.isArray(files.thumbnailFile) ? files.thumbnailFile[0] : null;

      const { name, url, category, description, version, orderIndex, isActive, isFeatured } = req.body;
      if (!name || !url) {
        return res.status(400).json({ error: 'Nome e URL do jogo são obrigatórios.' });
      }

      await validateGameLink(url);

      const rawSlug = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `link-${Date.now()}`;
      const coverImage = saveUploadedImage(coverFile, 'game_cover') || '/covers/default-game.svg';
      const thumbnailImage = saveUploadedImage(thumbnailFile, 'game_thumb') || coverImage;

      const game = createGame({
        id: rawSlug,
        slug: rawSlug,
        name: String(name).trim(),
        description: String(description || '').trim(),
        category: category || 'Web Link',
        version: version || '1.0.0',
        type: 'link',
        entry_path: url,
        directory: null,
        cover_image: coverImage,
        thumbnail_image: thumbnailImage,
        is_active: isActive === true || isActive === 'true' || isActive === 1 || isActive === undefined,
        is_featured: isFeatured === true || isFeatured === 'true' || isFeatured === 1,
        is_validated: true,
        order_index: Number(orderIndex || 0),
      });

      logAudit(req.user.id, 'GLOBAL_GAME_PUBLISHED', { gameId: game.id, name: game.name, type: 'link' });
      mirrorGameToSupabase(game).catch(() => {});

      res.json({ ok: true, game });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Admin Update Game Files (ZIP) & Media while strictly preserving all user settings/triggers/playlists
app.post(
  '/api/admin/games/:id/update-files',
  requireAdmin,
  upload.fields([
    { name: 'zipFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const existing = getGameById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Jogo não encontrado.' });
      }

      const files = req.files || {};
      const zipFile = Array.isArray(files.zipFile) ? files.zipFile[0] : null;
      const coverFile = Array.isArray(files.coverFile) ? files.coverFile[0] : null;
      const thumbnailFile = Array.isArray(files.thumbnailFile) ? files.thumbnailFile[0] : null;

      const updates = {};
      if (req.body.version) updates.version = String(req.body.version).trim();
      if (req.body.name) updates.name = String(req.body.name).trim();
      if (req.body.description !== undefined) updates.description = String(req.body.description);
      if (req.body.category) updates.category = String(req.body.category);
      if (req.body.isActive !== undefined) updates.is_active = req.body.isActive === 'true' || req.body.isActive === true;

      if (zipFile) {
        const targetSlug = existing.directory || existing.slug;
        const { entryHtml } = await extractZipGame(zipFile.path, targetSlug);
        try { unlinkSync(zipFile.path); } catch {}
        updates.entry_path = entryHtml;
        updates.directory = targetSlug;
      }

      if (coverFile) {
        updates.cover_image = saveUploadedImage(coverFile, 'game_cover');
      }
      if (thumbnailFile) {
        updates.thumbnail_image = saveUploadedImage(thumbnailFile, 'game_thumb');
      }

      const updated = updateGame(req.params.id, updates);
      logAudit(req.user.id, 'GLOBAL_GAME_FILES_UPDATED', { gameId: req.params.id, version: updated.version });
      res.json({ ok: true, game: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.put('/api/admin/games/:id', requireAdmin, (req, res) => {
  try {
    const game = updateGame(req.params.id, req.body);
    logAudit(req.user.id, 'GLOBAL_GAME_UPDATED', { gameId: req.params.id });
    res.json({ ok: true, game });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/games/:id', requireAdmin, (req, res) => {
  try {
    const result = deleteGame(req.params.id);
    logAudit(req.user.id, 'GLOBAL_GAME_DELETED', { gameId: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Cakto configuration
app.get('/api/admin/cakto', requireAdmin, (req, res) => {
  const config = getCaktoConfig();
  const webhookUrl = `${req.protocol}://${req.headers.host}/api/webhooks/cakto`;
  const recentEvents = listWebhookEvents(50);
  const recentPayments = listPayments(50);

  res.json({
    config,
    webhookUrl,
    recentEvents,
    recentPayments,
  });
});

app.put('/api/admin/cakto', requireAdmin, (req, res) => {
  try {
    const updated = updateCaktoConfig(req.body);
    logAudit(req.user.id, 'CAKTO_CONFIG_UPDATED', {});
    res.json({ ok: true, config: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Health & Database Verification Endpoints (never exposes secret keys)
app.get('/api/health', async (_req, res) => {
  const dbStatus = await checkDatabaseStatus();
  res.json({
    ok: dbStatus.sqlite.connected || dbStatus.supabase.connected,
    database: {
      activePrimary: dbStatus.activePrimary,
      sqliteConnected: dbStatus.sqlite.connected,
      sqliteEngine: dbStatus.sqlite.engine,
      supabaseConfigured: dbStatus.supabase.configured,
      supabaseConnected: dbStatus.supabase.connected,
      supabaseSchemaReady: dbStatus.supabase.schemaReady,
    },
    timestamp: Date.now(),
  });
});

app.get('/api/admin/database-status', requireAdmin, async (_req, res) => {
  const status = await checkDatabaseStatus();
  res.json(status);
});

// Admin Platform Settings (APIs, general, security)
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM platform_settings WHERE key != 'internal_audio_secret'").all();
  const settings = {
    platformName: 'MINHA LIVE GAME',
    supportEmail: 'suporte@minhalivegame.com',
    maintenanceMode: false,
    trialHours: 72,
    subscriptionPrice: 49.99,
    tiktokPollingInterval: 1000,
    tiktokConnectorEnabled: true,
    supabaseUrl: process.env.SUPABASE_URL || '',
    allowUserMusicUpload: true,
    maxUserMusicSizeMb: 50,
  };
  rows.forEach((r) => {
    try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
  });
  res.json({ settings });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const now = Date.now();
  for (const [k, v] of Object.entries(req.body || {})) {
    if (k === 'internal_audio_secret') continue;
    db.prepare(`
      INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(k, JSON.stringify(v), now);
  }
  logAudit(req.user.id, 'PLATFORM_SETTINGS_UPDATED', { keys: Object.keys(req.body || {}) });
  res.json({ ok: true });
});

// ==========================================
// 9. FRONTEND SERVING (SPA) & SERVER BOOT
// ==========================================
const isProdMode =
  IS_VERCEL ||
  process.env.NODE_ENV === 'production' ||
  process.argv.includes('--prod') ||
  process.argv.includes('--production');

if (!isProdMode) {
  try {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: ROOT_DIR,
    });
    app.use(vite.middlewares);
  } catch (err) {
    console.log('[Notice] Vite middleware not active, falling back to static files.');
  }
}

if (!IS_VERCEL) {
  const distDir = path.resolve(ROOT_DIR, 'dist');
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Start Server only when running outside Vercel Serverless
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  MINHA LIVE GAME — PLATAFORMA SAAS PROFISSIONAL`);
    console.log(`  Servidor rodando em: http://127.0.0.1:${PORT}`);
    console.log(`  Webhook Cakto: http://127.0.0.1:${PORT}/api/webhooks/cakto`);
    console.log(`=======================================================`);
  });
}

export { app, server };
export default app;
