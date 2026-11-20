import { db, hashPassword, verifyPassword, isAdminEmail, logAudit } from './db.mjs';
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'minha_live_session';
const SESSION_DAYS = 30;

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx >= 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

function extractSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) {
    return cookies[SESSION_COOKIE];
  }
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return null;
}

function getCookieFlags(req) {
  const isCrossOriginHttps =
    process.env.COOKIE_SAME_SITE?.toLowerCase() === 'none' ||
    process.env.COOKIE_SECURE === 'true' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('https://')) ||
    req?.headers?.['x-forwarded-proto'] === 'https';

  if (isCrossOriginHttps) {
    return 'HttpOnly; SameSite=None; Secure';
  }
  return 'HttpOnly; SameSite=Lax';
}

export function getUserFromRequest(req) {
  const token = extractSessionToken(req);
  if (!token) return null;

  const row = db.prepare(`
    SELECT u.id, u.email, u.display_name AS displayName, u.role, u.is_suspended AS isSuspended, u.created_at AS createdAt, COALESCE(u.tiktok_username, '') AS tiktokUsername
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), Date.now());

  if (!row || row.isSuspended) return null;

  // Strict backend admin check: matches verified admin emails or stored admin role
  const isAdmin = isAdminEmail(row.email) || row.role === 'admin';
  return {
    ...row,
    isAdmin,
    role: isAdmin ? 'admin' : 'user',
  };
}

export function createSession(res, userId, req = null) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_DAYS * 86400 * 1000;
  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(tokenHash(token), userId, expiresAt);

  const flags = getCookieFlags(req);
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; ${flags}; Max-Age=${SESSION_DAYS * 86400}`;
  res.setHeader('Set-Cookie', cookie);
  return token;
}

export function clearSession(req, res) {
  const token = extractSessionToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  }
  const flags = getCookieFlags(req);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; ${flags}; Max-Age=0`);
}

export function registerUser(email, password, displayName) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(displayName || '').trim() || cleanEmail.split('@')[0];
  
  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw new Error('E-mail inválido.');
  }
  if (!password || password.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    throw new Error('Este e-mail já está cadastrado.');
  }

  const isAdmin = isAdminEmail(cleanEmail);
  const role = isAdmin ? 'admin' : 'user';
  const { salt, hash } = hashPassword(password);
  const now = Date.now();

  const insertUser = db.prepare(`
    INSERT INTO users (email, display_name, password_salt, password_hash, role, is_suspended, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(cleanEmail, cleanName, salt, hash, role, now);

  const userId = Number(insertUser.lastInsertRowid);

  // Initialize 3-day (72h) trial for non-admin users, or lifetime for admin
  const trialExpiresAt = isAdmin ? now + 36500 * 86400 * 1000 : now + 72 * 3600 * 1000;
  db.prepare(`
    INSERT INTO trial_periods (user_id, started_at, expires_at, is_active)
    VALUES (?, ?, ?, 1)
  `).run(userId, now, trialExpiresAt);

  logAudit(userId, isAdmin ? 'ADMIN_REGISTERED' : 'USER_REGISTERED', { email: cleanEmail, role });

  return { id: userId, email: cleanEmail, displayName: cleanName, role, isAdmin, tiktokUsername: '', createdAt: now };
}

export function loginUser(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const user = db.prepare(`
    SELECT id, email, display_name AS displayName, password_salt AS salt, password_hash AS hash, role, is_suspended AS isSuspended, created_at AS createdAt, COALESCE(tiktok_username, '') AS tiktokUsername
    FROM users WHERE email = ?
  `).get(cleanEmail);

  if (!user) {
    throw new Error('Credenciais inválidas: Email ou senha incorretos.');
  }

  if (user.isSuspended && !isAdminEmail(user.email)) {
    throw new Error('Esta conta está suspensa por motivos administrativos. Entre em contato com o suporte.');
  }

  const valid = verifyPassword(password, user.salt, user.hash);
  if (!valid) {
    throw new Error('Credenciais inválidas: Email ou senha incorretos.');
  }

  const isAdmin = isAdminEmail(user.email) || user.role === 'admin';
  if (isAdmin && (user.role !== 'admin' || user.isSuspended)) {
    db.prepare("UPDATE users SET role = 'admin', is_suspended = 0 WHERE id = ?").run(user.id);
  }

  logAudit(user.id, isAdmin ? 'ADMIN_LOGIN' : 'USER_LOGIN', { email: user.email });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: isAdmin ? 'admin' : 'user',
    isAdmin,
    tiktokUsername: user.tiktokUsername || '',
    createdAt: user.createdAt,
  };
}

export function updateUserProfile(userId, { displayName, tiktokUsername }) {
  const cleanName = String(displayName || '').trim();
  const cleanTiktok = String(tiktokUsername || '').trim().replace(/^@+/, '');

  if (cleanName && cleanName.length < 2) {
    throw new Error('O nome de exibição deve ter pelo menos 2 caracteres.');
  }

  if (cleanName) {
    db.prepare('UPDATE users SET display_name = ?, tiktok_username = ? WHERE id = ?')
      .run(cleanName, cleanTiktok, userId);
  } else {
    db.prepare('UPDATE users SET tiktok_username = ? WHERE id = ?')
      .run(cleanTiktok, userId);
  }

  logAudit(userId, 'USER_PROFILE_UPDATED', { displayName: cleanName, tiktokUsername: cleanTiktok });

  const row = db.prepare(`
    SELECT id, email, display_name AS displayName, role, is_suspended AS isSuspended, created_at AS createdAt, COALESCE(tiktok_username, '') AS tiktokUsername
    FROM users WHERE id = ?
  `).get(userId);
  const isAdmin = isAdminEmail(row.email) || row.role === 'admin';
  return { ...row, isAdmin, role: isAdmin ? 'admin' : 'user' };
}

export function changeUserPassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
  }
  const user = db.prepare('SELECT password_salt AS salt, password_hash AS hash FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('Usuário não encontrado.');

  const valid = verifyPassword(currentPassword || '', user.salt, user.hash);
  if (!valid) {
    throw new Error('Senha atual incorreta.');
  }

  const { salt, hash } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?').run(salt, hash, userId);
  logAudit(userId, 'USER_PASSWORD_CHANGED', {});
  return { ok: true };
}

export function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado. Por favor, entre na sua conta.' });
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Acesso negado. Esta rota é restrita ao administrador.' });
  }
  req.user = user;
  next();
}
