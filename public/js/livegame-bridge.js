// SDK Bridge universal (window.LiveGame) para jogos que usam window.LiveGame.onEvent / onStatus (ex.: Recife das Bolhas)
(function () {
  if (window.LiveGame) return;

  const eventListeners = [];
  const statusListeners = [];

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const rawUser = typeof raw.user === 'string' ? raw.user.replace(/^@+/, '') : raw.user?.name || raw.nickname || 'visitante';
    return {
      type: raw.type === 'chat' ? 'comment' : raw.type,
      username: rawUser,
      nickname: raw.nickname || rawUser,
      text: raw.comment || raw.text || '',
      comment: raw.comment || raw.text || '',
      giftName: raw.giftName || raw.gift?.name || '',
      giftValue: Number(raw.giftValue ?? raw.gift?.diamonds ?? 1),
      count: Number(raw.count ?? raw.likes ?? raw.gift?.count ?? 1),
      avatarUrl: raw.avatarUrl || '',
      timestamp: raw.timestamp || Date.now(),
    };
  }

  window.LiveGame = {
    onEvent(cb) {
      if (typeof cb === 'function') eventListeners.push(cb);
    },
    onStatus(cb) {
      if (typeof cb === 'function') statusListeners.push(cb);
    },
  };

  window.addEventListener('message', function (ev) {
    const data = ev.data;
    if (!data || typeof data !== 'object') return;

    if ((data.type === 'live:event' || data.type === 'minha-live-games:event') && data.payload) {
      const normalized = normalizeEvent(data.payload);
      if (normalized) {
        for (const fn of eventListeners) {
          try { fn(normalized); } catch {}
        }
      }
    } else if (data.type === 'live:status' && data.payload) {
      const st = {
        status: data.payload.status || 'disconnected',
        user: data.payload.username || '',
        connected: Boolean(data.payload.connected),
      };
      for (const fn of statusListeners) {
        try { fn(st); } catch {}
      }
    }
  });
})();
