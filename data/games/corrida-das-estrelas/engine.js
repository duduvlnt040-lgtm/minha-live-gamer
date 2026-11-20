// Motor do jogo "Corrida das Torcidas".
// Lógica pura, sem DOM: roda no navegador e nos testes (node --test).

export const DEFAULT_TEAMS = [
  { id: 1, name: 'Fogo', emoji: '🔥', color: '#ff4d4f', aliases: ['fogo', 'vermelho', 'red'] },
  { id: 2, name: 'Água', emoji: '🌊', color: '#2f9bff', aliases: ['agua', 'azul', 'blue'] },
  { id: 3, name: 'Selva', emoji: '🌿', color: '#2ecc71', aliases: ['selva', 'verde', 'green'] },
  { id: 4, name: 'Raio', emoji: '⚡', color: '#a259ff', aliases: ['raio', 'roxo', 'purple'] },
];

export const DEFAULT_CONFIG = {
  trackLength: 1000,      // distância até a linha de chegada
  roundSeconds: 180,      // se ninguém chegar, quem estiver na frente vence
  commentPush: 4,         // cada comentário de quem já está num time
  joinPush: 6,            // ao entrar num time
  commentCooldownMs: 1500,// anti-spam por pessoa
  turboPush: 18,          // comentário "turbo"
  turboCooldownMs: 10000,
  likePush: 0.5,          // por like
  followPush: 25,
  sharePush: 20,
  diamondPush: 4,         // por diamante de presente
  maxGiftPush: 400,       // limite por presente, para não acabar a corrida num clique
};

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim();
}

export function createRace(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
  const teams = (options.teams || DEFAULT_TEAMS).map((t) => ({
    ...t,
    aliases: (t.aliases || []).map(normalize).concat(normalize(t.name)),
    distance: 0,
    members: 0,
  }));
  return {
    config,
    teams,
    phase: 'waiting', // waiting -> running -> finished
    startedAt: null,
    endsAt: null,
    winnerId: null,
    players: new Map(), // userId -> { userId, name, avatar, teamId, points, lastComment, lastTurbo }
  };
}

export function startRace(state, now = Date.now()) {
  for (const t of state.teams) {
    t.distance = 0;
    t.members = 0;
  }
  state.players.clear();
  state.phase = 'running';
  state.startedAt = now;
  state.endsAt = now + state.config.roundSeconds * 1000;
  state.winnerId = null;
  return state;
}

/** Descobre qual time a mensagem escolhe ("1", "time 2", "azul", "vou de fogo"...). */
export function parseTeamChoice(state, comment) {
  const text = normalize(comment);
  if (!text) return null;
  const words = text.split(/\s+/);
  for (const w of words) {
    const n = Number(w);
    if (Number.isInteger(n) && state.teams.some((t) => t.id === n)) return n;
  }
  for (const t of state.teams) {
    if (t.aliases.some((a) => a && words.includes(a))) return t.id;
  }
  return null;
}

function getPlayer(state, user) {
  return state.players.get(user.id) || null;
}

function team(state, id) {
  return state.teams.find((t) => t.id === id);
}

function push(state, player, amount, now) {
  const t = team(state, player.teamId);
  if (!t || state.phase !== 'running' || amount <= 0) return 0;
  const before = t.distance;
  t.distance = Math.min(state.config.trackLength, t.distance + amount);
  const gained = t.distance - before;
  player.points += gained;
  if (t.distance >= state.config.trackLength) finish(state, t.id, now);
  return gained;
}

function finish(state, winnerId) {
  if (state.phase !== 'running') return;
  state.phase = 'finished';
  state.winnerId = winnerId;
}

/**
 * Processa um evento normalizado da live.
 * ev = { type: 'chat'|'gift'|'like'|'follow'|'share', user: {id, name, avatar}, comment, gift: {name, diamonds, count}, likes }
 * Retorna uma lista de efeitos para a interface animar.
 */
export function handleEvent(state, ev, now = Date.now()) {
  const effects = [];
  if (state.phase !== 'running' || !ev || !ev.user || !ev.user.id) return effects;
  const cfg = state.config;
  let player = getPlayer(state, ev.user);
  if (player) {
    player.name = ev.user.name || player.name;
    player.avatar = ev.user.avatar || player.avatar;
  }

  if (ev.type === 'chat') {
    const choice = parseTeamChoice(state, ev.comment);
    if (choice && (!player || player.teamId !== choice)) {
      if (player) team(state, player.teamId).members--;
      else {
        player = { userId: ev.user.id, name: ev.user.name, avatar: ev.user.avatar, teamId: choice, points: 0, lastComment: 0, lastTurbo: -Infinity };
        state.players.set(ev.user.id, player);
      }
      const switched = player.teamId !== choice;
      player.teamId = choice;
      team(state, choice).members++;
      player.lastComment = now;
      const gained = push(state, player, cfg.joinPush, now);
      effects.push({ kind: switched ? 'switch' : 'join', teamId: choice, user: ev.user, amount: gained });
      return effects;
    }
    if (!player) {
      effects.push({ kind: 'hint', user: ev.user });
      return effects;
    }
    const isTurbo = /\bturbo\b/.test(normalize(ev.comment));
    if (isTurbo && now - player.lastTurbo >= cfg.turboCooldownMs) {
      player.lastTurbo = now;
      player.lastComment = now;
      const gained = push(state, player, cfg.turboPush, now);
      effects.push({ kind: 'turbo', teamId: player.teamId, user: ev.user, amount: gained });
      return effects;
    }
    if (now - player.lastComment >= cfg.commentCooldownMs) {
      player.lastComment = now;
      const gained = push(state, player, cfg.commentPush, now);
      effects.push({ kind: 'comment', teamId: player.teamId, user: ev.user, amount: gained });
    }
    return effects;
  }

  if (!player) {
    // quem ainda não escolheu time: presentes/follows vão para o time em último lugar (ajuda a equilibrar)
    if (ev.type === 'gift' || ev.type === 'follow' || ev.type === 'share') {
      const last = [...state.teams].sort((a, b) => a.distance - b.distance)[0];
      player = { userId: ev.user.id, name: ev.user.name, avatar: ev.user.avatar, teamId: last.id, points: 0, lastComment: 0, lastTurbo: -Infinity };
      state.players.set(ev.user.id, player);
      last.members++;
      effects.push({ kind: 'auto-join', teamId: last.id, user: ev.user, amount: 0 });
    } else {
      return effects;
    }
  }

  if (ev.type === 'gift') {
    const diamonds = Math.max(1, Number(ev.gift?.diamonds) || 1) * Math.max(1, Number(ev.gift?.count) || 1);
    const gained = push(state, player, Math.min(cfg.maxGiftPush, diamonds * cfg.diamondPush), now);
    effects.push({ kind: diamonds >= 99 ? 'mega-gift' : 'gift', teamId: player.teamId, user: ev.user, amount: gained, gift: ev.gift, diamonds });
  } else if (ev.type === 'like') {
    const gained = push(state, player, (Number(ev.likes) || 1) * cfg.likePush, now);
    if (gained > 0) effects.push({ kind: 'like', teamId: player.teamId, user: ev.user, amount: gained });
  } else if (ev.type === 'follow') {
    effects.push({ kind: 'follow', teamId: player.teamId, user: ev.user, amount: push(state, player, cfg.followPush, now) });
  } else if (ev.type === 'share') {
    effects.push({ kind: 'share', teamId: player.teamId, user: ev.user, amount: push(state, player, cfg.sharePush, now) });
  }
  return effects;
}

/** Chamado periodicamente: encerra a rodada quando o tempo acaba. */
export function tick(state, now = Date.now()) {
  if (state.phase === 'running' && now >= state.endsAt) {
    const leader = standings(state)[0];
    finish(state, leader.distance > 0 ? leader.id : null);
    return true;
  }
  return false;
}

export function standings(state) {
  return [...state.teams].sort((a, b) => b.distance - a.distance || a.id - b.id);
}

export function topPlayers(state, limit = 5, teamId = null) {
  return [...state.players.values()]
    .filter((p) => teamId == null || p.teamId === teamId)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}
