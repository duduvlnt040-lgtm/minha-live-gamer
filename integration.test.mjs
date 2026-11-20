import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { db } from '../server/db.mjs';
import { app, server } from '../server/index.mjs';

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };

  const res = await fetch(url, { ...options, headers });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    data = await res.json();
  } else if (ct.includes('audio/') || ct.includes('octet-stream')) {
    data = Buffer.from(await res.arrayBuffer());
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, data };
}

// Helper to build a minimal valid ZIP file in memory (store method, no compression)
function buildSimpleZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  // CRC32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c >>> 0;
  }
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  for (const { name, content } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const crc = crc32(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralSize = centralParts.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

// Helper to create a tiny valid WAV buffer
function buildTinyWav() {
  const samples = 2000;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

// Create a test session directly in SQLite for the verified owner account without touching or hardcoding any password
function createDirectSessionForUser(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    tokenHash,
    userId,
    Date.now() + 3600 * 1000
  );
  return {
    cookie: `minha_live_session=${encodeURIComponent(token)}`,
    cleanup: () => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash),
  };
}

async function runTests() {
  console.log('===================================================================');
  console.log('  BATERIA COMPLETA DE TESTES E2E — MINHA LIVE GAME (MASTER UPDATE)');
  console.log('===================================================================');

  const cleanupCallbacks = [];

  try {
    // TEST 1: Starter Games Preserved
    console.log('[TEST 1] Verificando jogos iniciais preservados...');
    const gamesRes = await request('/api/games');
    assert.equal(gamesRes.status, 200);
    const ids = gamesRes.data.games.map((g) => g.id);
    assert.ok(ids.includes('casamento-da-barata-3d'), 'Casamento da Barata 3D deve existir');
    assert.ok(ids.includes('corrida-das-estrelas'), 'Corrida Maluca das Estrelas deve existir');
    assert.ok(ids.includes('recife-das-bolhas'), 'Recife das Bolhas deve existir');

    const barataHtml = await request('/games/casamento-da-barata-3d/index.html');
    assert.equal(barataHtml.status, 200);
    assert.ok(barataHtml.data.includes('CASAMENTO DA BARATA 3D'));
    console.log('  -> OK: Todos os 3 jogos originais preservados e servindo HTML real.');

    // TEST 2: Starter Audio Tracks Playable
    console.log('[TEST 2] Verificando arquivos de áudio reais das músicas globais iniciais...');
    const globalMusicInit = await request('/api/music/global');
    assert.equal(globalMusicInit.status, 200);
    assert.ok(globalMusicInit.data.tracks.length >= 4);
    const firstAudio = await request(globalMusicInit.data.tracks[0].file_url);
    assert.equal(firstAudio.status, 200);
    assert.ok(Buffer.isBuffer(firstAudio.data) && firstAudio.data.subarray(0, 4).toString() === 'RIFF');
    console.log('  -> OK: Áudios iniciais existem e retornam WAV válido.');

    // TEST 3: Admin Account duduvlnt040@gmail.com Lifetime & No Hardcoded Password
    console.log('[TEST 3] Validando conta administradora oficial duduvlnt040@gmail.com...');
    let ownerRow = db.prepare("SELECT id, email, role, is_suspended FROM users WHERE email = 'duduvlnt040@gmail.com'").get();
    let createdOwnerInTest = false;
    if (!ownerRow) {
      const regOwner = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'duduvlnt040@gmail.com',
          password: `OwnerInit@${Date.now()}`,
          displayName: 'Proprietário',
        }),
      });
      assert.equal(regOwner.status, 200);
      assert.equal(regOwner.data.user.role, 'admin', 'Cadastro inicial de duduvlnt040@gmail.com deve virar admin automaticamente');
      assert.equal(regOwner.data.access.status, 'admin_lifetime');
      ownerRow = db.prepare("SELECT id, email, role, is_suspended FROM users WHERE email = 'duduvlnt040@gmail.com'").get();
      createdOwnerInTest = true;
    }
    assert.ok(ownerRow, 'Conta duduvlnt040@gmail.com deve existir no banco');
    assert.equal(ownerRow.role, 'admin', 'duduvlnt040@gmail.com deve ter role = admin');
    assert.equal(ownerRow.is_suspended, 0);
    if (createdOwnerInTest) {
      cleanupCallbacks.push(() => db.prepare('DELETE FROM users WHERE id = ?').run(ownerRow.id));
    }

    // Ensure no hardcoded admin password exists in server source code
    const authSrc = readFileSync('server/auth.mjs', 'utf8');
    const dbSrc = readFileSync('server/db.mjs', 'utf8');
    assert.ok(!authSrc.includes('Admin@123456') && !dbSrc.includes('Admin@123456'), 'Nenhuma senha fixa no backend!');

    const adminSess = createDirectSessionForUser(ownerRow.id);
    cleanupCallbacks.push(adminSess.cleanup);
    const adminCookie = adminSess.cookie;

    const adminMe = await request('/api/auth/me', { headers: { Cookie: adminCookie } });
    assert.equal(adminMe.status, 200);
    assert.equal(adminMe.data.user.email, 'duduvlnt040@gmail.com');
    assert.equal(adminMe.data.user.isAdmin, true);
    assert.equal(adminMe.data.user.role, 'admin');
    assert.equal(adminMe.data.access.status, 'admin_lifetime');
    assert.equal(adminMe.data.access.hasAccess, true);
    console.log('  -> OK: duduvlnt040@gmail.com reconhecido no backend como ADMIN VITALÍCIO.');

    // TEST 4: Register User A & User B with 72h Trial & Anti-Privilege-Escalation
    console.log('[TEST 4] Registrando Usuário A e Usuário B com 72h de teste e anti-escalação...');
    const ts = Date.now();
    const emailA = `user_a_${ts}@teste.com`;
    const emailB = `user_b_${ts}@teste.com`;

    const regA = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: emailA,
        password: 'PasswordA@123',
        displayName: 'Streamer A',
        role: 'admin', // Malicious attempt to escalate must be ignored!
        isAdmin: true,
      }),
    });
    assert.equal(regA.status, 200);
    assert.equal(regA.data.user.role, 'user', 'Tentativa de role=admin no cadastro deve ser ignorada');
    assert.equal(regA.data.user.isAdmin, false);
    assert.equal(regA.data.access.isTrial, true);
    assert.equal(regA.data.access.trialHoursLeft, 72);
    const cookieA = regA.headers.get('set-cookie').split(';')[0];
    const userAId = regA.data.user.id;
    cleanupCallbacks.push(() => db.prepare('DELETE FROM users WHERE id = ?').run(userAId));

    const regB = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: emailB,
        password: 'PasswordB@123',
        displayName: 'Streamer B',
      }),
    });
    assert.equal(regB.status, 200);
    assert.equal(regB.data.user.role, 'user');
    const cookieB = regB.headers.get('set-cookie').split(';')[0];
    const userBId = regB.data.user.id;
    cleanupCallbacks.push(() => db.prepare('DELETE FROM users WHERE id = ?').run(userBId));
    console.log('  -> OK: Usuários comuns criados com 72h de teste e role estritamente protegida.');

    // TEST 5: Strict Admin Route Protection (403 for Common Users, 200 for Admin)
    console.log('[TEST 5] Verificando bloqueio 403 em TODAS as rotas administrativas para usuário comum...');
    const adminEndpoints = [
      '/api/admin/metrics',
      '/api/admin/users',
      '/api/admin/subscriptions',
      '/api/admin/payments',
      '/api/admin/cakto',
      '/api/admin/settings',
      '/api/admin/logs',
      '/api/admin/security',
      '/api/admin/music',
    ];
    for (const ep of adminEndpoints) {
      const userRes = await request(ep, { headers: { Cookie: cookieA } });
      assert.equal(userRes.status, 403, `Usuário comum deveria receber 403 em ${ep}`);
      const admRes = await request(ep, { headers: { Cookie: adminCookie } });
      assert.equal(admRes.status, 200, `Admin deveria receber 200 em ${ep}`);
    }
    console.log(`  -> OK: Todas as ${adminEndpoints.length} rotas administrativas retornam 403 para usuário comum e 200 para admin.`);

    // TEST 6: 72-Hour Trial Expiration Auto-Lock
    console.log('[TEST 6] Testando bloqueio automático após expiração das 72h de teste...');
    db.prepare('UPDATE trial_periods SET expires_at = ? WHERE user_id = ?').run(Date.now() - 1000, userBId);
    const expiredMe = await request('/api/auth/me', { headers: { Cookie: cookieB } });
    assert.equal(expiredMe.data.access.status, 'trial_expired');
    assert.equal(expiredMe.data.access.hasAccess, false);

    const blockedLive = await request('/api/live/connect', {
      method: 'POST',
      headers: { Cookie: cookieB },
      body: JSON.stringify({ username: 'teste_bloqueado' }),
    });
    assert.equal(blockedLive.status, 403);
    assert.equal(blockedLive.data.code, 'TRIAL_EXPIRED');

    const blockedOverlay = await request(`/overlay/casamento-da-barata-3d/${userBId}`);
    assert.equal(blockedOverlay.status, 403);
    console.log('  -> OK: Conta com teste vencido é bloqueada automaticamente na LIVE e no Overlay.');

    // TEST 7: Admin Global Game Preview, Validation, Publication & Update Preserving User Settings
    console.log('[TEST 7] Testando prévia ZIP, publicação global e atualização preservando configs do usuário...');
    const zipBuffer = buildSimpleZip([
      { name: 'index.html', content: '<!doctype html><html><body><h1>JOGO TESTE GLOBAL V1</h1></body></html>' },
    ]);

    // Common user must be blocked from uploading games
    const forbiddenFd = new FormData();
    forbiddenFd.append('zipFile', new Blob([zipBuffer], { type: 'application/zip' }), 'jogo-teste.zip');
    const forbiddenUpload = await request('/api/admin/games/preview-zip', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: forbiddenFd,
    });
    assert.equal(forbiddenUpload.status, 403, 'Usuário comum NÃO pode enviar jogos');

    // Admin validates ZIP preview first
    const prevFd = new FormData();
    prevFd.append('zipFile', new Blob([zipBuffer], { type: 'application/zip' }), 'jogo-teste.zip');
    const prevRes = await request('/api/admin/games/preview-zip', {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: prevFd,
    });
    assert.equal(prevRes.status, 200);
    assert.equal(prevRes.data.validated, true);
    assert.ok(prevRes.data.previewId);

    // Preview URL works for admin and is 403 for common user
    const prevHtmlAdmin = await request(prevRes.data.previewUrl, { headers: { Cookie: adminCookie } });
    assert.equal(prevHtmlAdmin.status, 200);
    assert.ok(prevHtmlAdmin.data.includes('JOGO TESTE GLOBAL V1'));
    const prevHtmlUser = await request(prevRes.data.previewUrl, { headers: { Cookie: cookieA } });
    assert.equal(prevHtmlUser.status, 403);

    // Publish globally using validated previewId
    const pubFd = new FormData();
    pubFd.append('name', `Jogo Teste Global ${ts}`);
    pubFd.append('description', 'Jogo criado para validação E2E');
    pubFd.append('category', 'Arcade');
    pubFd.append('version', '1.0.0');
    pubFd.append('isActive', 'true');
    pubFd.append('previewId', prevRes.data.previewId);
    const pubRes = await request('/api/admin/games/upload-zip', {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: pubFd,
    });
    assert.equal(pubRes.status, 200);
    const createdGameId = pubRes.data.game.id;
    cleanupCallbacks.push(async () => {
      await request(`/api/admin/games/${createdGameId}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
    });

    // Common user immediately sees the published game in global library
    const userGamesList = await request('/api/games', { headers: { Cookie: cookieA } });
    assert.ok(userGamesList.data.games.some((g) => g.id === createdGameId), 'Jogo publicado deve aparecer automaticamente para todos os usuários');

    // User A saves personal settings on this game
    const saveCfg = await request(`/api/games/${createdGameId}/settings`, {
      method: 'PUT',
      headers: { Cookie: cookieA },
      body: JSON.stringify({ speed: 1.7, customLabel: 'LIVE_DO_A' }),
    });
    assert.equal(saveCfg.status, 200);

    // Admin updates game ZIP to v2.0.0
    const zipV2 = buildSimpleZip([
      { name: 'index.html', content: '<!doctype html><html><body><h1>JOGO TESTE GLOBAL V2</h1></body></html>' },
    ]);
    const updFd = new FormData();
    updFd.append('version', '2.0.0');
    updFd.append('zipFile', new Blob([zipV2], { type: 'application/zip' }), 'jogo-v2.zip');
    const updRes = await request(`/api/admin/games/${createdGameId}/update-files`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: updFd,
    });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.data.game.version, '2.0.0');

    // Confirm User A settings were preserved while game HTML updated to V2
    const afterUpdGame = await request(`/api/games/${createdGameId}`, { headers: { Cookie: cookieA } });
    assert.equal(afterUpdGame.data.game.userSettings.customLabel, 'LIVE_DO_A', 'Configurações do usuário devem ser preservadas na atualização do jogo');
    const v2Html = await request(`/games/${afterUpdGame.data.game.directory}/index.html`);
    assert.ok(v2Html.data.includes('JOGO TESTE GLOBAL V2'));
    console.log('  -> OK: Prévia real, publicação global e atualização preservando configs dos usuários verificados.');

    // TEST 8: Admin Global Music Upload
    console.log('[TEST 8] Testando upload de música global pelo administrador...');
    const wavBuf = buildTinyWav();
    const gmFd = new FormData();
    gmFd.append('audioFile', new Blob([wavBuf], { type: 'audio/wav' }), 'trilha_global_teste.wav');
    gmFd.append('name', 'Trilha Global Oficial Teste');
    gmFd.append('artist', 'Admin DJ');
    gmFd.append('category', 'Festiva');
    gmFd.append('defaultVolume', '85');
    gmFd.append('gameId', 'casamento-da-barata-3d');
    const gmRes = await request('/api/admin/music/upload', {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: gmFd,
    });
    assert.equal(gmRes.status, 200);
    const globalTrackId = gmRes.data.track.id;
    cleanupCallbacks.push(async () => {
      await request(`/api/admin/music/${globalTrackId}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
    });

    const userSeesGlobal = await request('/api/music/global?gameId=casamento-da-barata-3d', { headers: { Cookie: cookieA } });
    assert.ok(userSeesGlobal.data.tracks.some((t) => t.id === globalTrackId), 'Música global deve aparecer para todos os usuários');
    console.log('  -> OK: Música global publicada pelo admin e visível para streamers.');

    // TEST 9: User Private Music Upload & Strict Privacy Isolation
    console.log('[TEST 9] Testando upload de música particular e isolamento total entre usuários...');
    const umFd = new FormData();
    umFd.append('audioFile', new Blob([wavBuf], { type: 'audio/wav' }), 'minha_faixa_secreta.wav');
    umFd.append('name', 'Música Secreta do Streamer A');
    umFd.append('artist', 'Streamer A');
    umFd.append('gameId', 'casamento-da-barata-3d');
    const umRes = await request('/api/music/my/upload', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: umFd,
    });
    assert.equal(umRes.status, 200);
    const userTrack = umRes.data.track;
    cleanupCallbacks.push(async () => {
      await request(`/api/music/my/${userTrack.id}`, { method: 'DELETE', headers: { Cookie: cookieA } });
    });

    // User A sees & downloads own track (200)
    const listA = await request('/api/music/my', { headers: { Cookie: cookieA } });
    assert.ok(listA.data.tracks.some((t) => t.id === userTrack.id));
    const audioA = await request(userTrack.file_url, { headers: { Cookie: cookieA } });
    assert.equal(audioA.status, 200);

    // User B MUST NOT see User A's track and MUST receive 403 on direct audio URL
    const listB = await request('/api/music/my', { headers: { Cookie: cookieB } });
    assert.ok(!listB.data.tracks.some((t) => t.id === userTrack.id), 'Usuário B jamais pode ver música particular de A');
    const audioB = await request(userTrack.file_url, { headers: { Cookie: cookieB } });
    assert.equal(audioB.status, 403, 'Usuário B deve receber 403 ao tentar baixar música privada de A');
    const audioAnon = await request(userTrack.file_url);
    assert.equal(audioAnon.status, 403, 'Acesso anônimo sem token deve receber 403');
    console.log('  -> OK: Músicas particulares 100% isoladas por conta (403 para outros usuários).');

    // TEST 10: Game Playlist & Overlay Signed Audio Streaming
    console.log('[TEST 10] Testando playlist por jogo e áudio assinado no Overlay do OBS...');
    const plSave = await request('/api/games/casamento-da-barata-3d/playlist', {
      method: 'PUT',
      headers: { Cookie: cookieA },
      body: JSON.stringify({
        name: 'Playlist da Festa',
        is_autoplay: true,
        is_repeat: true,
        volume: 65,
        tracks: [
          { id: userTrack.id, trackType: 'user', isPrimary: true },
          { id: globalTrackId, trackType: 'global', isPrimary: false },
        ],
      }),
    });
    assert.equal(plSave.status, 200);
    assert.equal(plSave.data.tracks.length, 2);
    assert.equal(plSave.data.tracks[0].id, userTrack.id);
    assert.equal(plSave.data.tracks[0].isPrimary, true);

    // Overlay renders signed URL for User A's private track so OBS can play without cookies
    const overlayA = await request(`/overlay/casamento-da-barata-3d/${userAId}`);
    assert.equal(overlayA.status, 200);
    assert.ok(overlayA.data.includes('overlay-audio'));
    assert.ok(overlayA.data.includes('?token='), 'Overlay deve assinar URL da faixa privada com token HMAC');

    // Extract signed URL from overlay HTML and verify it plays (200) without cookies
    const match = overlayA.data.match(/\/audio\/user\/\d+\/[^"\\]+token=[a-f0-9]+/);
    assert.ok(match, 'URL assinada da música privada deve estar presente no overlay');
    const signedAudioRes = await request(match[0]);
    assert.equal(signedAudioRes.status, 200, 'OBS Overlay deve reproduzir faixa privada usando token HMAC válido');
    console.log('  -> OK: Playlist salva e Overlay OBS reproduz faixas globais e privadas com segurança.');

    // TEST 11: User Profile & Password Change
    console.log('[TEST 11] Testando atualização de perfil e troca de senha do usuário comum...');
    const profRes = await request('/api/user/profile', {
      method: 'PUT',
      headers: { Cookie: cookieA },
      body: JSON.stringify({ displayName: 'Streamer A Pro', tiktokUsername: '@streamer_a_live' }),
    });
    assert.equal(profRes.status, 200);
    assert.equal(profRes.data.user.displayName, 'Streamer A Pro');
    assert.equal(profRes.data.user.tiktokUsername, 'streamer_a_live');

    const passRes = await request('/api/user/password', {
      method: 'PUT',
      headers: { Cookie: cookieA },
      body: JSON.stringify({ currentPassword: 'PasswordA@123', newPassword: 'NewPasswordA@456' }),
    });
    assert.equal(passRes.status, 200);
    console.log('  -> OK: Perfil e senha atualizados com segurança.');

    // TEST 12: Cakto Webhook R$ 49.99 Activation, Idempotency & Refund
    console.log('[TEST 12] Testando Webhook Cakto R$ 49,99/mês, idempotência e desbloqueio automático...');
    const orderId = `cakto_e2e_${ts}`;
    const whApprove = await request('/api/webhooks/cakto', {
      method: 'POST',
      body: JSON.stringify({
        id: orderId,
        event: 'purchase.approved',
        amount: 49.99,
        customer: { email: emailB, name: 'Streamer B' },
      }),
    });
    assert.equal(whApprove.status, 200);
    assert.equal(whApprove.data.status, 'success');
    assert.equal(whApprove.data.userMatched, true);

    // User B is now unlocked!
    const unlockedMe = await request('/api/auth/me', { headers: { Cookie: cookieB } });
    assert.equal(unlockedMe.data.access.status, 'active_subscription');
    assert.equal(unlockedMe.data.access.hasAccess, true);
    const unlockedOverlay = await request(`/overlay/casamento-da-barata-3d/${userBId}`);
    assert.equal(unlockedOverlay.status, 200, 'Overlay deve desbloquear imediatamente após assinatura Cakto');

    // Duplicate webhook must be ignored idempotently
    const whDup = await request('/api/webhooks/cakto', {
      method: 'POST',
      body: JSON.stringify({
        id: orderId,
        event: 'purchase.approved',
        amount: 49.99,
        customer: { email: emailB },
      }),
    });
    assert.equal(whDup.data.status, 'already_processed');

    // Refund revokes subscription
    const whRefund = await request('/api/webhooks/cakto', {
      method: 'POST',
      body: JSON.stringify({
        id: `${orderId}_refund`,
        event: 'purchase.refunded',
        amount: 49.99,
        customer: { email: emailB },
      }),
    });
    assert.equal(whRefund.status, 200);
    const afterRefund = await request('/api/auth/me', { headers: { Cookie: cookieB } });
    assert.equal(afterRefund.data.access.isSubscribed, false);
    console.log('  -> OK: Fluxo completo Cakto (aprovação, desbloqueio, idempotência e estorno) validado.');

    // TEST 13: Admin Dashboard Real Metrics, Logs & Security Endpoints
    console.log('[TEST 13] Validando métricas reais, assinaturas, pagamentos, logs e segurança do Admin...');
    const metricsRes = await request('/api/admin/metrics', { headers: { Cookie: adminCookie } });
    assert.equal(metricsRes.status, 200);
    assert.equal(typeof metricsRes.data.totalUsers, 'number');
    assert.equal(typeof metricsRes.data.activeTrials, 'number');
    assert.equal(typeof metricsRes.data.activeSubs, 'number');
    assert.equal(typeof metricsRes.data.expiredSubs, 'number');
    assert.equal(typeof metricsRes.data.paymentsCount, 'number');
    assert.equal(typeof metricsRes.data.monthlyRevenue, 'number');
    assert.equal(typeof metricsRes.data.publishedGames, 'number');
    assert.equal(typeof metricsRes.data.totalMusic, 'number');
    assert.ok(Array.isArray(metricsRes.data.recentActivity));

    const secRes = await request('/api/admin/security', { headers: { Cookie: adminCookie } });
    assert.equal(secRes.status, 200);
    assert.equal(secRes.data.policies.adminOwnerEmail, 'duduvlnt040@gmail.com');
    assert.equal(secRes.data.policies.privateUserAudioHmacProtection, true);
    console.log('  -> OK: Painel Administrativo retornando métricas e auditoria reais do banco.');

    // TEST 14: Live Event Simulation & Buffer
    console.log('[TEST 14] Testando simulador TikTok LIVE e histórico de eventos...');
    const simRes = await request('/api/live/simulate', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: JSON.stringify({ type: 'gift', user: '@apoiador', giftName: 'Rosa', giftValue: 10 }),
    });
    assert.equal(simRes.status, 200);
    const evRes = await request('/api/live/recent-events', { headers: { Cookie: cookieA } });
    assert.ok(evRes.data.events.length > 0);
    console.log('  -> OK: Simulação de eventos e buffer funcionando.');

    // TEST 15: Production Frontend SPA Serving & Zero Secret Key Leakage
    console.log('[TEST 15] Verificando frontend compilado (dist/index.html) e ausência de segredos...');
    const spaRes = await request('/');
    assert.equal(spaRes.status, 200);
    assert.ok(spaRes.data.includes('<!doctype html>') || spaRes.data.includes('<!DOCTYPE html>'));
    assert.ok(spaRes.data.includes('/assets/index-'), 'HTML de produção deve referenciar bundle compilado do Vite');
    const jsMatch = spaRes.data.match(/\/assets\/index-[^"']+\.js/);
    assert.ok(jsMatch, 'Bundle JS deve estar referenciado');
    const bundleRes = await request(jsMatch[0]);
    assert.equal(bundleRes.status, 200);
    assert.ok(!bundleRes.data.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Frontend nunca deve conter SUPABASE_SERVICE_ROLE_KEY');
    console.log('  -> OK: Frontend de produção servido sem nenhuma chave secreta exposta.');

    // TEST 16: Real Database Health & Supabase Integration Diagnostic
    console.log('[TEST 16] Verificando status real do banco de dados (/api/health e /api/admin/database-status)...');
    const healthRes = await request('/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.data.ok, true);
    assert.equal(healthRes.data.database.sqliteConnected, true);

    const dbUserBlocked = await request('/api/admin/database-status', { headers: { Cookie: cookieA } });
    assert.equal(dbUserBlocked.status, 403, 'Usuário comum não deve acessar diagnóstico admin do banco');

    const dbAdminRes = await request('/api/admin/database-status', { headers: { Cookie: adminCookie } });
    assert.equal(dbAdminRes.status, 200);
    assert.equal(dbAdminRes.data.sqlite.connected, true);
    assert.ok(dbAdminRes.data.sqlite.tablesCount >= 18);
    assert.equal(dbAdminRes.data.supabase.serviceRoleKey, undefined, 'Nunca expor chaves secretas no JSON');
    console.log(`  -> OK: Banco ativo (${dbAdminRes.data.activePrimary}), SQLite com ${dbAdminRes.data.sqlite.tablesCount} tabelas e integração Supabase pronta via .env.`);

    // TEST 17: Real TikTok LIVE Connection Attempt (Never Fakes Connected When Offline)
    console.log('[TEST 17] Testando tentativa de conexão REAL com TikTok LIVE (garantia de status real)...');
    const badHandle = await request('/api/live/connect', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: JSON.stringify({ username: '@@@!!!' }),
    });
    assert.equal(badHandle.status, 400);

    const realAttempt = await request('/api/live/connect', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: JSON.stringify({ username: 'perfil_offline_teste_mlg_998877' }),
    });
    // Must NEVER report connected=true for an offline/non-live profile
    assert.ok([409, 502, 400].includes(realAttempt.status), `Status HTTP esperado 409/502/400, recebido ${realAttempt.status}`);
    assert.equal(realAttempt.data.ok, false);
    assert.equal(realAttempt.data.status.connected, false, 'Nunca deve reportar connected=true sem LIVE real');
    assert.ok(
      ['offline', 'error'].includes(realAttempt.data.status.status),
      `Status deve ser offline ou error, recebido: ${realAttempt.data.status.status}`
    );

    const verifyStatus = await request('/api/live/status', { headers: { Cookie: cookieA } });
    assert.equal(verifyStatus.status, 200);
    assert.equal(verifyStatus.data.connected, false);

    // Admin must also be allowed to connect TikTok LIVE & access own overlays without trial/subscription lock
    const adminLiveAttempt = await request('/api/live/connect', {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ username: 'perfil_offline_admin_mlg_9988' }),
    });
    assert.ok([409, 502, 400].includes(adminLiveAttempt.status), 'Admin deve passar pela autorização e receber status real da tentativa');
    assert.notEqual(adminLiveAttempt.status, 403, 'Admin nunca deve ser bloqueado por trial/assinatura ao conectar TikTok LIVE');
    assert.equal(adminLiveAttempt.data.status.connected, false);
    const adminOverlay = await request(`/overlay/casamento-da-barata-3d/${ownerRow.id}`);
    assert.equal(adminOverlay.status, 200, 'Overlay do admin deve funcionar vitaliciamente');
    console.log(`  -> OK: Conexão real testada (Usuário e Admin) — status honesto="${realAttempt.data.status.status}", mensagem="${realAttempt.data.error}"`);

    console.log('===================================================================');
    console.log('  TODOS OS 17 TESTES E2E PASSARAM COM 100% DE SUCESSO!');
    console.log('===================================================================');
  } finally {
    // Cleanup temporary test data so database remains pristine
    for (const fn of cleanupCallbacks.reverse()) {
      try { await fn(); } catch {}
    }
    try {
      db.prepare("DELETE FROM webhook_events WHERE id LIKE 'cakto_e2e_%'").run();
    } catch {}
  }

  process.exit(0);
}

setTimeout(() => {
  runTests().catch((err) => {
    console.error('FALHA NO TESTE:', err);
    process.exit(1);
  });
}, 1200);
