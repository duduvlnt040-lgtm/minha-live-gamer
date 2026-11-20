// Ponte universal de eventos em tempo real para jogos HTML5 (ex.: Corrida Maluca das Estrelas)
// Suporta postMessage (iframe do Painel / Overlay OBS) e WebSocket direto (?ws=...).

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEventForGame(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const rawUser = raw.user;
  const userObj =
    rawUser && typeof rawUser === 'object'
      ? {
          id: String(rawUser.id || rawUser.uniqueId || rawUser.name || 'viewer'),
          name: String(rawUser.name || rawUser.nickname || rawUser.uniqueId || 'Espectador'),
          avatar: rawUser.avatar || raw.avatarUrl || '',
        }
      : {
          id: String(rawUser || raw.username || raw.nickname || 'viewer').replace(/^@+/, ''),
          name: String(raw.nickname || rawUser || raw.username || 'Espectador'),
          avatar: raw.avatarUrl || '',
        };

  const t = String(raw.type || '').toLowerCase();
  if (t === 'comment' || t === 'chat') {
    return {
      type: 'chat',
      user: userObj,
      comment: String(raw.comment || raw.text || ''),
    };
  }
  if (t === 'gift') {
    const count = Math.max(1, Number(raw.gift?.count ?? raw.count ?? 1));
    const totalVal = Math.max(1, Number(raw.gift?.diamonds ?? raw.giftValue ?? 1));
    const diamondsPerUnit = raw.gift?.diamonds
      ? Number(raw.gift.diamonds)
      : Math.max(1, Math.round(totalVal / count));
    return {
      type: 'gift',
      user: userObj,
      gift: {
        name: String(raw.gift?.name || raw.giftName || 'Presente'),
        diamonds: diamondsPerUnit,
        count,
      },
    };
  }
  if (t === 'like') {
    return {
      type: 'like',
      user: userObj,
      likes: Math.max(1, Number(raw.likes ?? raw.count ?? 1)),
    };
  }
  if (t === 'follow' || t === 'share' || t === 'member') {
    return {
      type: t,
      user: userObj,
    };
  }
  return null;
}

export function connectLive({ onEvent, onGame, onStatus } = {}) {
  const params = new URLSearchParams(window.location.search);
  let ws = null;

  function dispatchIncoming(data) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'live:event' || data.type === 'minha-live-games:event') {
      const normalized = normalizeEventForGame(data.payload);
      if (normalized && typeof onEvent === 'function') onEvent(normalized);
      return;
    }

    if (data.type === 'live:status' && typeof onStatus === 'function') {
      onStatus(data.payload);
      return;
    }

    if (data.type === 'minha-live-games:settings' && typeof onGame === 'function') {
      onGame('settings', data.payload);
      return;
    }

    if (data.type === 'minha-live-games:command' && typeof onGame === 'function') {
      onGame(data.command, data.payload);
    }
  }

  window.addEventListener('message', (event) => {
    dispatchIncoming(event.data);
  });

  // Optional direct WebSocket connection when ?ws= is passed and not inside overlay bridge
  const wsParam = params.get('ws');
  if (wsParam && params.get('overlay') !== '1') {
    try {
      ws = new WebSocket(wsParam);
      ws.onmessage = (e) => {
        try {
          dispatchIncoming(JSON.parse(e.data));
        } catch {}
      };
    } catch {}
  }

  return {
    send(payload) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      } catch {}
      try {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify(payload));
        }
      } catch {}
    },
    close() {
      try {
        ws?.close();
      } catch {}
    },
  };
}
