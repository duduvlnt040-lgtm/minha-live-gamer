import { connectLive, escapeHtml } from '../../js/live.js';
import { createRace, startRace, handleEvent, tick, standings, topPlayers, DEFAULT_TEAMS } from './engine.js';

const params = new URLSearchParams(location.search);
if (params.get('fundo') === 'transparente') document.body.classList.add('transparent');
let soundOn = params.get('som') !== '0';
const RESULT_SECONDS = 12;

const TRACK_H = 1170;
const RUNNER_START = 230; // altura (px) da largada, acima do número da pista
const RUNNER_END = TRACK_H - 40;

let settings = { roundSeconds: Number(params.get('tempo')) || 180, trackLength: Number(params.get('distancia')) || 1000 };
let race = createRace({ config: settings });
let nextRoundAt = null;

// ---------- escala do palco ----------
const stage = document.getElementById('stage');
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

// ---------- montagem ----------
const track = document.getElementById('track');
const lanes = new Map();
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}
function teamVars(t) {
  return `--c:${t.color};--c-a:${shade(t.color, 0.35)};--c-b:${shade(t.color, 0.18)};--c-border:${shade(t.color, 0.8)};--c-dark:${shade(t.color, 0.45)}`;
}
function build() {
  track.innerHTML = '';
  lanes.clear();
  for (const t of race.teams) {
    const el = document.createElement('div');
    el.className = 'lane';
    el.setAttribute('style', teamVars(t));
    el.innerHTML = `
      <div class="lane-fill"></div>
      <div class="lane-pct">0%</div>
      <div class="runner"><div class="runner-crown">👑</div><div class="runner-body">${t.emoji}</div></div>
      <div class="lane-info"><div class="lane-num">${t.id}</div><div class="lane-name">${escapeHtml(t.name)}</div><div class="lane-stats">👥 <span class="members">0</span></div></div>`;
    track.appendChild(el);
    lanes.set(t.id, {
      el,
      runner: el.querySelector('.runner'),
      fill: el.querySelector('.lane-fill'),
      pct: el.querySelector('.lane-pct'),
      members: el.querySelector('.members'),
    });
  }
  document.getElementById('choices').innerHTML = race.teams
    .map((t) => `<div class="choice" style="${teamVars(t)}"><span class="n">${t.id}</span>${t.emoji}</div>`)
    .join('');
}

// ---------- render ----------
function teamById(id) { return race.teams.find((t) => t.id === id); }

function render() {
  const order = standings(race);
  const leaderId = order[0].distance > 0 ? order[0].id : null;
  for (const t of race.teams) {
    const l = lanes.get(t.id);
    const p = t.distance / race.config.trackLength;
    l.runner.style.bottom = `${RUNNER_START + p * (RUNNER_END - RUNNER_START)}px`;
    l.fill.style.height = `${RUNNER_START + p * (RUNNER_END - RUNNER_START)}px`;
    l.pct.textContent = `${Math.floor(p * 100)}%`;
    l.members.textContent = t.members;
    l.runner.classList.toggle('leader', t.id === leaderId);
  }
  const top = topPlayers(race, 7);
  document.getElementById('top').innerHTML = top.length
    ? top.map((pl) => {
        const t = teamById(pl.teamId);
        return `<li style="${teamVars(t)}"><span class="dot">${t.emoji}</span><span class="nm">${escapeHtml(pl.name)}</span><span class="pts">${Math.round(pl.points)}</span></li>`;
      }).join('')
    : '<li><span class="empty">Comente para aparecer aqui!</span></li>';
}

function renderTimer(now) {
  const el = document.getElementById('timer');
  let secs;
  if (race.phase === 'running') secs = Math.max(0, Math.ceil((race.endsAt - now) / 1000));
  else if (race.phase === 'finished') secs = 0;
  else secs = race.config.roundSeconds;
  el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  el.classList.toggle('hurry', race.phase === 'running' && secs <= 15);
}

// ---------- efeitos ----------
const feed = document.getElementById('feed');
function addFeed(html, color) {
  const div = document.createElement('div');
  div.className = 'feed-item';
  if (color) div.style.setProperty('--c', color);
  div.innerHTML = html;
  feed.prepend(div);
  while (feed.children.length > 14) feed.lastChild.remove();
}

function popAt(teamId, text, big) {
  const l = lanes.get(teamId);
  if (!l) return;
  const pop = document.createElement('div');
  pop.className = 'pop' + (big ? ' big' : '');
  pop.textContent = text;
  pop.style.bottom = `${parseFloat(l.runner.style.bottom || RUNNER_START) + 70}px`;
  l.el.appendChild(pop);
  setTimeout(() => pop.remove(), 1400);
  l.runner.classList.remove('boost');
  void l.runner.offsetWidth;
  l.runner.classList.add('boost');
}

let bannerTimer;
function banner(html, ms = 2600) {
  const b = document.getElementById('banner');
  b.innerHTML = html;
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
}

function short(name) {
  name = String(name || '');
  return name.length > 14 ? name.slice(0, 13) + '…' : name;
}

function applyEffects(effects) {
  for (const fx of effects) {
    const t = teamById(fx.teamId);
    const who = escapeHtml(short(fx.user?.name));
    const amt = Math.round(fx.amount || 0);
    switch (fx.kind) {
      case 'join':
        popAt(t.id, `+ ${short(fx.user.name)}`);
        addFeed(`<b>${who}</b> entrou no ${t.emoji} ${escapeHtml(t.name)}`, t.color);
        beep(520, 0.06);
        break;
      case 'switch':
        addFeed(`<b>${who}</b> trocou para ${t.emoji} ${escapeHtml(t.name)}`, t.color);
        break;
      case 'auto-join':
        addFeed(`<b>${who}</b> foi para ${t.emoji} ${escapeHtml(t.name)}`, t.color);
        break;
      case 'comment':
        popAt(t.id, `+${amt}`);
        beep(660, 0.04);
        break;
      case 'turbo':
        popAt(t.id, `🚀 TURBO +${amt}`, true);
        addFeed(`🚀 <b>${who}</b> usou TURBO!`, t.color);
        beep(880, 0.12, 'sawtooth');
        break;
      case 'like':
        popAt(t.id, `❤️ +${amt}`);
        break;
      case 'follow':
        popAt(t.id, `⭐ +${amt}`, true);
        addFeed(`⭐ <b>${who}</b> seguiu! +${amt} para ${t.emoji}`, t.color);
        beep(760, 0.15);
        break;
      case 'share':
        popAt(t.id, `📣 +${amt}`, true);
        addFeed(`📣 <b>${who}</b> compartilhou! +${amt}`, t.color);
        break;
      case 'gift':
      case 'mega-gift': {
        const gname = escapeHtml(fx.gift?.name || 'presente');
        const count = fx.gift?.count > 1 ? ` x${fx.gift.count}` : '';
        popAt(t.id, `🎁 +${amt}`, true);
        addFeed(`🎁 <b>${who}</b> mandou ${gname}${count}`, t.color);
        if (fx.kind === 'mega-gift' || amt >= 40) {
          banner(`🚀 ${who} deu FOGUETE no ${t.emoji} ${escapeHtml(t.name)}!<small>${gname}${count} · +${amt} metros</small>`);
          confettiBurst(t.color, 120);
        }
        fanfare();
        break;
      }
    }
  }
}

// ---------- som ----------
let audioCtx;
function beep(freq, dur, type = 'square') {
  if (!soundOn) return;
  try {
    audioCtx ||= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.05, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {}
}
function fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle'), i * 90)); }

// ---------- confete ----------
const cv = document.getElementById('confetti');
const cx = cv.getContext('2d');
let parts = [];
function confettiBurst(color, n = 200) {
  const colors = [color, '#ffd23f', '#fff', '#ff6bd6', '#5cf2ff'];
  for (let i = 0; i < n; i++) {
    parts.push({ x: 540 + (Math.random() - 0.5) * 300, y: 800, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 30 - 8, r: Math.random() * 10 + 6, c: colors[i % colors.length], a: Math.random() * 6, life: 160 });
  }
}
function drawConfetti() {
  cx.clearRect(0, 0, 1080, 1920);
  parts = parts.filter((p) => p.life-- > 0 && p.y < 2000);
  for (const p of parts) {
    p.vy += 0.6; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.2;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore();
  }
}

// ---------- fluxo da rodada ----------
function newRound() {
  race = createRace({ config: settings });
  build();
  startRace(race);
  nextRoundAt = null;
  document.getElementById('result').classList.add('hidden');
  feed.innerHTML = '';
  banner('🏁 VALENDO! Comente 1, 2, 3 ou 4!', 2500);
  render();
}

function showResult() {
  const winner = teamById(race.winnerId);
  const card = document.querySelector('.result-card');
  if (winner) {
    card.style.setProperty('--c', winner.color);
    document.getElementById('result-emoji').textContent = winner.emoji;
    document.getElementById('result-title').textContent = `${winner.name.toUpperCase()} VENCEU!`;
    const mvps = topPlayers(race, 3, winner.id);
    document.getElementById('result-mvp').innerHTML = mvps.length
      ? `MVP: <b>${escapeHtml(mvps[0].name)}</b> (${Math.round(mvps[0].points)} pts)` +
        (mvps.length > 1 ? `<br>Também brilharam: ${mvps.slice(1).map((m) => escapeHtml(m.name)).join(', ')}` : '')
      : '';
    confettiBurst(winner.color, 350);
    fanfare();
  } else {
    card.style.setProperty('--c', '#6c3cff');
    document.getElementById('result-emoji').textContent = '😴';
    document.getElementById('result-title').textContent = 'NINGUÉM CORREU!';
    document.getElementById('result-mvp').textContent = 'Comente o número do seu time na próxima!';
  }
  document.getElementById('result').classList.remove('hidden');
  nextRoundAt = Date.now() + RESULT_SECONDS * 1000;
}

function loop() {
  const now = Date.now();
  if (tick(race, now)) {
    render();
    showResult();
  }
  if (race.phase === 'finished' && nextRoundAt) {
    const s = Math.max(0, Math.ceil((nextRoundAt - now) / 1000));
    document.getElementById('result-next').textContent = `Próxima corrida em ${s}s`;
    if (now >= nextRoundAt) newRound();
  }
  renderTimer(now);
  drawConfetti();
  requestAnimationFrame(loop);
}

// ---------- conexão com o servidor ----------
const live = connectLive({
  onEvent: (ev) => applyAndRender(ev),
  onGame(command, payload) {
    if (command === 'restart') newRound();
    if (command === 'settings' && payload) {
      settings = { ...settings, ...payload };
      newRound();
    }
    if (command === 'sound') soundOn = !!payload?.on;
  },
});

// publica o placar para o painel
setInterval(() => {
  live.send({
    kind: 'game-state',
    state: {
      game: 'corrida',
      preview: params.get('preview') === '1',
      phase: race.phase,
      secondsLeft: race.phase === 'running' ? Math.max(0, Math.ceil((race.endsAt - Date.now()) / 1000)) : 0,
      teams: race.teams.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, color: t.color, distance: Math.round(t.distance), members: t.members })),
      trackLength: race.config.trackLength,
      winnerId: race.winnerId,
      players: race.players.size,
    },
  });
}, 1000);

// atalhos de teclado para testar sem live: 1-4 entra no time, espaço = comentário aleatório, g = presente, r = reiniciar
let fakeN = 0;
addEventListener('keydown', (e) => {
  const fake = (type, extra) => applyAndRender({ type, user: { id: 'kb' + (fakeN % 30), name: 'Teclado' + (fakeN % 30) }, ...extra });
  if (e.key >= '1' && e.key <= String(DEFAULT_TEAMS.length)) { fakeN++; fake('chat', { comment: e.key }); }
  else if (e.key === ' ') { fakeN++; fake('chat', { comment: 'bora' }); }
  else if (e.key === 'g') fake('gift', { gift: { name: 'Rosa', diamonds: 1, count: 5 } });
  else if (e.key === 'G') fake('gift', { gift: { name: 'Leão', diamonds: 299, count: 1 } });
  else if (e.key === 'r') newRound();
});
function applyAndRender(ev) {
  const wasRunning = race.phase === 'running';
  applyEffects(handleEvent(race, ev));
  render();
  if (wasRunning && race.phase === 'finished') showResult();
}

newRound();
requestAnimationFrame(loop);
