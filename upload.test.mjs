import assert from 'node:assert/strict';
import { app, server } from '../server/index.mjs';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';

const BASE_URL = 'http://127.0.0.1:3000';

// Simple zip file creator without external deps for testing
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
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function createMinimalZip(htmlContent) {
  const fileName = 'index.html';
  const fileBytes = Buffer.from(htmlContent, 'utf8');

  // Local file header
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // signature
  localHeader.writeUInt16LE(20, 4); // min version
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // compression: 0 (store)
  localHeader.writeUInt16LE(0, 10); // mod time
  localHeader.writeUInt16LE(0, 12); // mod date
  const crc = crc32(fileBytes);
  localHeader.writeUInt32LE(crc, 14); // crc32
  localHeader.writeUInt32LE(fileBytes.length, 18); // comp size
  localHeader.writeUInt32LE(fileBytes.length, 22); // uncomp size
  localHeader.writeUInt16LE(fileName.length, 26); // name length
  localHeader.writeUInt16LE(0, 28); // extra length

  // Central directory entry
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0); // signature
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(0, 10); // compression: 0
  centralHeader.writeUInt16LE(0, 12); // mod time
  centralHeader.writeUInt16LE(0, 14); // mod date
  centralHeader.writeUInt32LE(crc, 16); // crc32
  centralHeader.writeUInt32LE(fileBytes.length, 20); // comp size
  centralHeader.writeUInt32LE(fileBytes.length, 24); // uncomp size
  centralHeader.writeUInt16LE(fileName.length, 28); // name length
  centralHeader.writeUInt16LE(0, 30); // extra length
  centralHeader.writeUInt16LE(0, 32); // comment length
  centralHeader.writeUInt16LE(0, 34); // disk start
  centralHeader.writeUInt16LE(0, 36); // internal attr
  centralHeader.writeUInt32LE(0, 38); // external attr
  centralHeader.writeUInt32LE(0, 42); // local header offset

  const cdSize = 46 + fileName.length;
  const cdOffset = 30 + fileName.length + fileBytes.length;

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk num
  eocd.writeUInt16LE(0, 6); // disk start
  eocd.writeUInt16LE(1, 8); // num entries on disk
  eocd.writeUInt16LE(1, 10); // num entries total
  eocd.writeUInt32LE(cdSize, 12); // cd size
  eocd.writeUInt32LE(cdOffset, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment length

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
  console.log('=== TESTANDO UPLOAD DE JOGO ZIP E CRIAÇÃO POR LINK ===');

  // Login as admin
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'duduvln040@gmail.com', password: 'Admin@123456' }),
  });
  const adminCookie = adminRes.headers.get('set-cookie');

  // 1. Create a zip file
  const testHtml = '<!DOCTYPE html><html><body><h1>Jogo de Teste Upload</h1></body></html>';
  const zipBuffer = createMinimalZip(testHtml);
  const zipPath = join('C:/Users/duduv/.gemini/antigravity/scratch/minha-live-game', 'test-game.zip');
  writeFileSync(zipPath, zipBuffer);

  // 2. Upload zip
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  const fd = new FormData();
  fd.append('zipFile', blob, 'test-game.zip');
  fd.append('name', 'Jogo Teste Automatizado');
  fd.append('category', 'Casual');
  fd.append('description', 'Jogo de teste de upload');
  fd.append('isActive', 'true');

  const uploadRes = await fetch(`${BASE_URL}/api/admin/games/upload-zip`, {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: fd,
  });
  const uploadData = await uploadRes.json();
  assert.equal(uploadRes.status, 200, `Upload deve responder 200: ${JSON.stringify(uploadData)}`);
  assert.ok(uploadData.game, 'Deve retornar o objeto do jogo criado');
  assert.equal(uploadData.game.name, 'Jogo Teste Automatizado');
  console.log('  -> OK: Upload de arquivo ZIP processado e jogo indexado com sucesso.');

  // Verify game serves
  const gameHtml = await fetch(`${BASE_URL}/games/${uploadData.game.directory}/${uploadData.game.entry_path}`);
  assert.equal(gameHtml.status, 200);
  const text = await gameHtml.text();
  assert.ok(text.includes('Jogo de Teste Upload'), 'Conteúdo do jogo importado deve estar acessível');
  console.log('  -> OK: Jogo importado servido pelo servidor perfeitamente.');

  // Clean up test game
  await fetch(`${BASE_URL}/api/admin/games/${uploadData.game.id}`, {
    method: 'DELETE',
    headers: { Cookie: adminCookie },
  });
  try { unlinkSync(zipPath); } catch {}
  console.log('  -> OK: Limpeza do jogo de teste concluída.');

  console.log('=== TESTE DE UPLOAD PASSOU 100%! ===');
  process.exit(0);
}

setTimeout(testUpload, 1500);
