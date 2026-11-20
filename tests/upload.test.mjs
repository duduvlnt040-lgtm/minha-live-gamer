import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { db } from '../server/db.mjs';
import { app, server } from '../server/index.mjs';

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}
const table = (() => {
  let c;
  const t = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function createMinimalZip(htmlContent) {
  const fileName = 'index.html';
  const fileBytes = Buffer.from(htmlContent, 'utf8');
  const crc = crc32(fileBytes);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(fileBytes.length, 18);
  localHeader.writeUInt32LE(fileBytes.length, 22);
  localHeader.writeUInt16LE(fileName.length, 26);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(fileBytes.length, 20);
  centralHeader.writeUInt32LE(fileBytes.length, 24);
  centralHeader.writeUInt16LE(fileName.length, 28);

  const cdSize = 46 + fileName.length;
  const cdOffset = 30 + fileName.length + fileBytes.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);

  return Buffer.concat([
    localHeader,
    Buffer.from(fileName, 'utf8'),
    fileBytes,
    centralHeader,
    Buffer.from(fileName, 'utf8'),
    eocd,
  ]);
}

async function testUpload() {
  console.log('=== TESTANDO UPLOAD DE JOGO ZIP, CAPA, PRÉVIA E SERVIÇO ===');

  let owner = db.prepare("SELECT id FROM users WHERE email = 'duduvlnt040@gmail.com'").get();
  let createdOwner = false;
  if (!owner) {
    const reg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'duduvlnt040@gmail.com',
        password: `UploadTest@${Date.now()}`,
        displayName: 'Admin Upload Test',
      }),
    });
    assert.equal(reg.status, 200);
    owner = db.prepare("SELECT id FROM users WHERE email = 'duduvlnt040@gmail.com'").get();
    createdOwner = true;
  }
  assert.ok(owner, 'Conta proprietária duduvlnt040@gmail.com deve existir');

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    tokenHash,
    owner.id,
    Date.now() + 3600 * 1000
  );
  const authHeaders = { Authorization: `Bearer ${token}` };

  try {
    const testHtml = '<!DOCTYPE html><html><body><h1>Jogo de Teste Upload ZIP + Capa</h1></body></html>';
    const zipBuffer = createMinimalZip(testHtml);
    const svgCover = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#7c3aed"/></svg>';

    // 1. Preview & validation
    const prevFd = new FormData();
    prevFd.append('zipFile', new Blob([zipBuffer], { type: 'application/zip' }), 'test-game.zip');
    const prevRes = await fetch(`${BASE_URL}/api/admin/games/preview-zip`, {
      method: 'POST',
      headers: authHeaders,
      body: prevFd,
    });
    const prevData = await prevRes.json();
    assert.equal(prevRes.status, 200, `Preview falhou: ${JSON.stringify(prevData)}`);
    assert.equal(prevData.validated, true);
    console.log('  -> OK: Prévia ZIP validada com sucesso.');

    // 2. Publish with cover + thumbnail
    const pubFd = new FormData();
    pubFd.append('previewId', prevData.previewId);
    pubFd.append('coverFile', new Blob([svgCover], { type: 'image/svg+xml' }), 'capa.svg');
    pubFd.append('thumbnailFile', new Blob([svgCover], { type: 'image/svg+xml' }), 'thumb.svg');
    pubFd.append('name', `Jogo Teste Upload ${Date.now()}`);
    pubFd.append('category', 'Casual');
    pubFd.append('version', '1.0.0');
    pubFd.append('description', 'Jogo de teste de upload completo');
    pubFd.append('isActive', 'true');

    const uploadRes = await fetch(`${BASE_URL}/api/admin/games/upload-zip`, {
      method: 'POST',
      headers: authHeaders,
      body: pubFd,
    });
    const uploadData = await uploadRes.json();
    assert.equal(uploadRes.status, 200, `Upload deve responder 200: ${JSON.stringify(uploadData)}`);
    assert.ok(uploadData.game?.cover_image?.startsWith('/covers/'));

    // 3. Verify game HTML and uploaded cover are served
    const gameHtml = await fetch(`${BASE_URL}/games/${uploadData.game.directory}/${uploadData.game.entry_path}`);
    assert.equal(gameHtml.status, 200);
    assert.ok((await gameHtml.text()).includes('Jogo de Teste Upload ZIP + Capa'));

    const coverRes = await fetch(`${BASE_URL}${uploadData.game.cover_image}`);
    assert.equal(coverRes.status, 200);
    console.log('  -> OK: Jogo ZIP e capa enviados e servidos perfeitamente.');

    // 4. Clean up test game
    await fetch(`${BASE_URL}/api/admin/games/${uploadData.game.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    console.log('  -> OK: Limpeza do jogo de teste concluída.');
    console.log('=== TESTE DE UPLOAD PASSOU 100%! ===');
  } finally {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    if (createdOwner && owner?.id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(owner.id);
    }
  }

  process.exit(0);
}

setTimeout(() => {
  testUpload().catch((err) => {
    console.error('FALHA NO TESTE DE UPLOAD:', err);
    process.exit(1);
  });
}, 1200);
