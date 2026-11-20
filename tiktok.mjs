import './env.mjs';
import { db, logAudit } from './db.mjs';
import {
  TikTokLiveConnection,
  UserOfflineError,
  InvalidUniqueIdError,
  ConnectTimeoutError,
  SignatureRateLimitError,
} from 'tiktok-live-connector';
import crypto from 'node:crypto';

// In-memory active connection pool: userId -> ConnectionState
// A user is ONLY considered 'connected' when an active live instance exists here
// AND liveConnection.isConnected === true.
const connectionPool = new Map();

// Map of userId -> Set<WebSocket> (streamer dashboard + overlays)
export const userWebsockets = new Map();

// On server boot, never carry over stale 'connected'/'connecting' rows from previous runs
try {
  db.prepare(`
    UPDATE live_connections
    SET status = 'disconnected'
    WHERE status IN ('connected', 'connecting')
  `).run();
} catch {}

export function registerUserSocket(userId, ws) {
  if (!userWebsockets.has(userId)) {
    userWebsockets.set(userId, new Set());
  }
  userWebsockets.get(userId).add(ws);

  ws.on('close', () => {
    const set = userWebsockets.get(userId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) userWebsockets.delete(userId);
    }
  });
}

export function broadcastToUser(userId, message) {
  const sockets = userWebsockets.get(userId);
  if (!sockets || sockets.size === 0) return;

  const payload = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === 1) {
      try {
        ws.send(payload);
      } catch {}
    }
  }
}

export function getLiveStatus(userId) {
  const pooled = connectionPool.get(userId);
  const dbRow = db
    .prepare('SELECT tiktok_username, status, connected_at, last_event_at, total_events FROM live_connections WHERE user_id = ?')
    .get(userId);

  // Strict real connection guard: NEVER report connected without a real active WebSocket session
  const actuallyConnected = Boolean(
    pooled &&
      pooled.status === 'connected' &&
      pooled.connection &&
      pooled.connection.isConnected === true
  );

  let effectiveStatus = 'disconnected';
  if (actuallyConnected) {
    effectiveStatus = 'connected';
  } else if (pooled?.status === 'connecting') {
    effectiveStatus = 'connecting';
  } else if (pooled?.status === 'offline') {
    effectiveStatus = 'offline';
  } else if (pooled?.status === 'error') {
    effectiveStatus = 'error';
  } else if (dbRow?.status === 'offline' || dbRow?.status === 'error') {
    effectiveStatus = dbRow.status;
  }

  return {
    connected: actuallyConnected,
    status: effectiveStatus,
    username: pooled?.username || dbRow?.tiktok_username || '',
    roomId: actuallyConnected ? pooled?.roomId || null : null,
    viewerCount: actuallyConnected ? pooled?.viewerCount || 0 : 0,
    connectedAt: actuallyConnected ? pooled?.connectedAt || null : null,
    lastEventAt: pooled?.lastEventAt || dbRow?.last_event_at || null,
    totalEvents: pooled?.totalEvents ?? dbRow?.total_events ?? 0,
    eventCounts: pooled?.eventCounts || { comment: 0, like: 0, gift: 0, follow: 0, share: 0 },
    activeOverlayCount: userWebsockets.get(userId)?.size || 0,
    errorMessage: actuallyConnected ? null : pooled?.errorMessage || null,
  };
}

function extractUserInfo(data) {
  const uniqueId =
    data?.user?.uniqueId ||
    data?.uniqueId ||
    data?.user?.nickname ||
    data?.nickname ||
    'espectador';
  const nickname = data?.user?.nickname || data?.nickname || uniqueId;
  const avatarUrl =
    data?.user?.profilePicture?.url?.[0] ||
    data?.user?.profilePictureUrl ||
    data?.profilePictureUrl ||
    undefined;

  const formattedUser = uniqueId.startsWith('@') ? uniqueId : `@${uniqueId}`;
  return { user: formattedUser, nickname, avatarUrl };
}

function classifyTikTokError(err, username) {
  const rawMsg = String(err?.exception?.message || err?.message || err?.info || '').trim();
  const lower = rawMsg.toLowerCase();
  const errName = String(err?.exception?.name || err?.name || '');

  const isOffline =
    err instanceof UserOfflineError ||
    err?.exception instanceof UserOfflineError ||
    errName === 'UserOfflineError' ||
    lower.includes("isn't online") ||
    lower.includes('not online') ||
    lower.includes('user is offline') ||
    lower.includes('user offline') ||
    lower.includes('offline') ||
    lower.includes('live has ended') ||
    lower.includes('stream ended') ||
    lower.includes('room_id') && lower.includes('not found') ||
    lower.includes('status: 4') ||
    lower.includes('not live');

  if (isOffline) {
    return {
      status: 'offline',
      message: `A LIVE de @${username} está offline no momento. Inicie uma transmissão ao vivo no TikTok para conectar.`,
    };
  }

  if (err instanceof InvalidUniqueIdError || errName === 'InvalidUniqueIdError') {
    return {
      status: 'error',
      message: `O perfil @${username} é inválido ou não foi encontrado no TikTok.`,
    };
  }

  if (err instanceof ConnectTimeoutError || errName === 'ConnectTimeoutError' || lower.includes('timeout')) {
    return {
      status: 'error',
      message: `Tempo esgotado ao tentar conectar à LIVE de @${username}. Verifique sua conexão com a internet e tente novamente.`,
    };
  }

  if (err instanceof SignatureRateLimitError || errName === 'SignatureRateLimitError' || lower.includes('rate limit')) {
    return {
      status: 'error',
      message: 'Limite temporário de conexões do conector TikTok LIVE atingido. Aguarde alguns instantes ou configure TIKTOK_SIGN_API_KEY no .env.',
    };
  }

  if (lower.includes('enotfound') || lower.includes('econnrefused') || lower.includes('network') || lower.includes('fetch failed') || lower.includes('eacces')) {
    return {
      status: 'error',
      message: `Erro de conexão com os servidores do TikTok LIVE (${rawMsg || 'rede indisponível'}). Verifique o acesso à internet do servidor.`,
    };
  }

  // TikTok often fails fetching roomId when user has never streamed or is offline
  if (lower.includes('failed to retrieve room') || lower.includes('failed to fetch room')) {
    return {
      status: 'offline',
      message: `Não foi encontrada nenhuma transmissão ativa para @${username}. Inicie uma LIVE no TikTok e tente novamente.`,
    };
  }

  return {
    status: 'error',
    message: rawMsg
      ? `Erro de conexão com a TikTok LIVE de @${username}: ${rawMsg}`
      : `Erro de conexão ao tentar conectar à LIVE de @${username}.`,
  };
}

function recordEvent(userId, event) {
  const now = Date.now();
  const id = `evt_${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO recent_events (id, user_id, game_id, event_type, user_name, payload, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    event.gameId || null,
    event.type,
    event.user || '@anônimo',
    JSON.stringify(event),
    now
  );

  // Update live_connections counter
  db.prepare(`
    UPDATE live_connections
    SET last_event_at = ?, total_events = total_events + 1
    WHERE user_id = ?
  `).run(now, userId);

  const pooled = connectionPool.get(userId);
  if (pooled) {
    pooled.totalEvents = (pooled.totalEvents || 0) + 1;
    pooled.lastEventAt = now;
    if (pooled.eventCounts && event.type in pooled.eventCounts) {
      pooled.eventCounts[event.type] += 1;
    }
  }

  // Broadcast real-time event to dashboard and overlays
  broadcastToUser(userId, {
    type: 'live:event',
    payload: { ...event, id, timestamp: now },
    timestamp: now,
  });
}

export async function connectTikTokLive(userId, rawUsername) {
  const username = String(rawUsername || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, '')
    .replace(/\/live.*$/i, '')
    .replace(/^@+/, '')
    .trim();

  if (!username || username.length < 2 || !/^[a-zA-Z0-9._]+$/.test(username)) {
    throw new Error('Informe um @ válido do TikTok (apenas letras, números, ponto ou underline).');
  }

  // Cleanly close any previous connection for this user
  await disconnectTikTokLive(userId, { silent: true });

  const now = Date.now();

  db.prepare(`
    INSERT INTO live_connections (user_id, tiktok_username, status, connected_at, last_event_at, total_events)
    VALUES (?, ?, 'connecting', NULL, NULL, 0)
    ON CONFLICT(user_id) DO UPDATE SET
      tiktok_username = excluded.tiktok_username,
      status = 'connecting',
      connected_at = NULL
  `).run(userId, username);

  // Persist user's last used TikTok handle
  try {
    db.prepare('UPDATE users SET tiktok_username = ? WHERE id = ?').run(username, userId);
  } catch {}

  const state = {
    status: 'connecting',
    username,
    roomId: null,
    viewerCount: 0,
    connectedAt: null,
    lastEventAt: null,
    totalEvents: 0,
    eventCounts: { comment: 0, like: 0, gift: 0, follow: 0, share: 0 },
    errorMessage: null,
    connection: null,
  };
  connectionPool.set(userId, state);

  // Immediately broadcast 'connecting' status to UI
  broadcastToUser(userId, {
    type: 'live:status',
    payload: getLiveStatus(userId),
  });

  try {
    const signApiKey = String(process.env.TIKTOK_SIGN_API_KEY || process.env.EULER_API_KEY || '').trim();
    const options = {
      processInitialData: false,
      fetchRoomInfoOnConnect: true,
      enableExtendedGiftInfo: true,
      ...(signApiKey ? { signApiKey } : {}),
    };

    const liveConnection = new TikTokLiveConnection(username, options);
    state.connection = liveConnection;

    // 1. Real connection confirmed by TikTok Webcast WebSocket
    liveConnection.on('connected', (connState) => {
      if (connectionPool.get(userId) !== state) return;
      state.status = 'connected';
      state.connectedAt = Date.now();
      state.roomId = connState?.roomId || liveConnection.roomId || null;
      state.errorMessage = null;

      db.prepare(`
        UPDATE live_connections
        SET status = 'connected', connected_at = ?
        WHERE user_id = ?
      `).run(state.connectedAt, userId);

      logAudit(userId, 'TIKTOK_LIVE_CONNECTED', { username, roomId: state.roomId });

      broadcastToUser(userId, {
        type: 'live:status',
        payload: getLiveStatus(userId),
      });
      console.log(`[TikTok LIVE] Conectado de verdade em @${username} (roomId: ${state.roomId}, user: ${userId})`);
    });

    // 2. Disconnected from stream
    liveConnection.on('disconnected', () => {
      if (connectionPool.get(userId) !== state) return;
      if (state.status !== 'offline' && state.status !== 'error') {
        state.status = 'disconnected';
      }
      db.prepare('UPDATE live_connections SET status = ? WHERE user_id = ?').run(state.status, userId);
      broadcastToUser(userId, {
        type: 'live:status',
        payload: getLiveStatus(userId),
      });
      console.log(`[TikTok LIVE] Desconectado de @${username} (status: ${state.status})`);
    });

    // 3. Stream ended while connected -> transition to LIVE offline
    liveConnection.on('streamEnd', () => {
      if (connectionPool.get(userId) !== state) return;
      state.status = 'offline';
      state.errorMessage = `A transmissão ao vivo de @${username} foi encerrada. Inicie uma nova LIVE para reconectar.`;
      db.prepare("UPDATE live_connections SET status = 'offline' WHERE user_id = ?").run(userId);
      broadcastToUser(userId, {
        type: 'live:status',
        payload: getLiveStatus(userId),
      });
    });

    // 4. Connection / runtime error (v2.5.0 emits { info, exception })
    liveConnection.on('error', (errPayload) => {
      if (connectionPool.get(userId) !== state) return;
      // Only downgrade live status if WebSocket is no longer connected
      if (!liveConnection.isConnected) {
        const classified = classifyTikTokError(errPayload, username);
        state.status = classified.status;
        state.errorMessage = classified.message;
        db.prepare('UPDATE live_connections SET status = ? WHERE user_id = ?').run(classified.status, userId);
        broadcastToUser(userId, {
          type: 'live:status',
          payload: getLiveStatus(userId),
        });
      }
      console.error(`[TikTok LIVE Error] @${username}:`, errPayload?.exception?.message || errPayload?.info || errPayload);
    });

    // 5. Real-time viewer count
    liveConnection.on('roomUser', (data) => {
      if (connectionPool.get(userId) !== state) return;
      const count = Number(data?.viewerCount ?? 0);
      if (count !== state.viewerCount) {
        state.viewerCount = count;
        broadcastToUser(userId, {
          type: 'live:status',
          payload: getLiveStatus(userId),
        });
      }
    });

    // 6. Real-time COMMENTS (chat)
    liveConnection.on('chat', (data) => {
      const { user, nickname, avatarUrl } = extractUserInfo(data);
      recordEvent(userId, {
        type: 'comment',
        user,
        nickname,
        comment: data?.comment || '',
        avatarUrl,
        source: 'tiktok_live',
      });
    });

    // 7. Real-time GIFTS (presentes)
    liveConnection.on('gift', (data) => {
      // For streakable gifts (giftType === 1), emit final combo count when repeatEnd is true
      if (data?.giftType === 1 && !data?.repeatEnd) {
        return;
      }
      const { user, nickname, avatarUrl } = extractUserInfo(data);
      const giftName =
        data?.giftDetails?.giftName ||
        data?.extendedGiftInfo?.name ||
        data?.giftName ||
        `Presente #${data?.giftId || ''}`.trim();
      const repeatCount = Math.max(1, Number(data?.repeatCount || 1));
      const diamondCount = Math.max(
        1,
        Number(data?.giftDetails?.diamondCount || data?.extendedGiftInfo?.diamond_count || data?.diamondCount || 1)
      );

      recordEvent(userId, {
        type: 'gift',
        user,
        nickname,
        giftName,
        giftValue: diamondCount * repeatCount,
        count: repeatCount,
        avatarUrl,
        source: 'tiktok_live',
      });
    });

    // 8. Real-time LIKES (curtidas)
    liveConnection.on('like', (data) => {
      const { user, nickname, avatarUrl } = extractUserInfo(data);
      recordEvent(userId, {
        type: 'like',
        user,
        nickname,
        count: Math.max(1, Number(data?.likeCount || 1)),
        totalLikeCount: Number(data?.totalLikeCount || 0),
        avatarUrl,
        source: 'tiktok_live',
      });
    });

    // 9. Real-time NEW FOLLOWERS (novos seguidores)
    liveConnection.on('follow', (data) => {
      const { user, nickname, avatarUrl } = extractUserInfo(data);
      recordEvent(userId, {
        type: 'follow',
        user,
        nickname,
        comment: 'começou a seguir o canal!',
        avatarUrl,
        source: 'tiktok_live',
      });
    });

    // 10. Real-time SHARES (compartilhamentos)
    liveConnection.on('share', (data) => {
      const { user, nickname, avatarUrl } = extractUserInfo(data);
      recordEvent(userId, {
        type: 'share',
        user,
        nickname,
        comment: 'compartilhou a LIVE!',
        avatarUrl,
        source: 'tiktok_live',
      });
    });

    // Attempt REAL connection to TikTok LIVE
    const connState = await liveConnection.connect();

    // Verify real connection before returning
    if (!liveConnection.isConnected) {
      throw new UserOfflineError('Conexão WebSocket não estabelecida.');
    }

    state.status = 'connected';
    state.connectedAt = state.connectedAt || Date.now();
    state.roomId = connState?.roomId || liveConnection.roomId || state.roomId;
    state.errorMessage = null;

    db.prepare(`
      UPDATE live_connections
      SET status = 'connected', connected_at = ?
      WHERE user_id = ?
    `).run(state.connectedAt, userId);

    const finalStatus = getLiveStatus(userId);
    broadcastToUser(userId, {
      type: 'live:status',
      payload: finalStatus,
    });

    return finalStatus;
  } catch (err) {
    // Cleanup connection instance safely
    try {
      if (state.connection) await state.connection.disconnect();
    } catch {}
    state.connection = null;

    const classified = classifyTikTokError(err, username);
    state.status = classified.status;
    state.errorMessage = classified.message;

    db.prepare('UPDATE live_connections SET status = ? WHERE user_id = ?').run(classified.status, userId);

    const failureStatus = getLiveStatus(userId);
    broadcastToUser(userId, {
      type: 'live:status',
      payload: failureStatus,
    });

    const outErr = new Error(classified.message);
    outErr.liveStatus = failureStatus;
    outErr.statusCode = classified.status === 'offline' ? 409 : 502;
    throw outErr;
  }
}

export async function disconnectTikTokLive(userId, { silent = false } = {}) {
  const pooled = connectionPool.get(userId);
  if (pooled) {
    try {
      if (pooled.connection) {
        await pooled.connection.disconnect();
      }
    } catch {}
    connectionPool.delete(userId);
  }

  db.prepare("UPDATE live_connections SET status = 'disconnected' WHERE user_id = ?").run(userId);

  const status = getLiveStatus(userId);
  if (!silent) {
    broadcastToUser(userId, {
      type: 'live:status',
      payload: status,
    });
  }
  return { ok: true, status };
}

export function simulateLiveEvent(userId, eventInput) {
  const now = Date.now();
  const event = {
    type: eventInput.type || 'gift',
    user: eventInput.user || '@testador',
    comment: eventInput.comment,
    giftName: eventInput.giftName || (eventInput.type === 'gift' ? 'Rosa Dourada' : undefined),
    giftValue: eventInput.giftValue ?? (eventInput.type === 'gift' ? 10 : undefined),
    count: eventInput.count ?? 1,
    avatarUrl: eventInput.avatarUrl,
    timestamp: now,
    source: 'simulation',
    simulation: true,
  };

  recordEvent(userId, event);
  return { ok: true, event };
}
