import { db, logAudit } from './db.mjs';
import crypto from 'node:crypto';

function safeEqualString(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates incoming Cakto webhook signature/secret using constant-time comparison.
 * Supports:
 *  - HMAC-SHA256 signature in `x-cakto-signature` / `x-webhook-signature`
 *  - Direct secret token in `x-cakto-secret` / `x-webhook-secret` / `Authorization: Bearer`
 *  - Official Cakto JSON `payload.secret` field
 */
export function verifyCaktoWebhookAuth(req) {
  const config = getCaktoConfig();
  const configuredSecret = String(process.env.CAKTO_WEBHOOK_SECRET || config.webhook_secret || '').trim();
  if (!configuredSecret) {
    return { valid: true, mode: 'no_secret_configured' };
  }

  const payload = req.body || {};
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(payload);

  // 1. Direct secret in headers or payload.secret
  const headerSecret =
    req.headers['x-cakto-secret'] ||
    req.headers['x-webhook-secret'] ||
    (String(req.headers.authorization || '').toLowerCase().startsWith('bearer ')
      ? String(req.headers.authorization).slice(7).trim()
      : '') ||
    payload.secret ||
    '';

  if (headerSecret && safeEqualString(headerSecret, configuredSecret)) {
    return { valid: true, mode: 'secret_match' };
  }

  // 2. HMAC-SHA256 signature header
  const sigHeader = String(
    req.headers['x-cakto-signature'] ||
      req.headers['x-webhook-signature'] ||
      req.headers['x-hub-signature-256'] ||
      ''
  )
    .trim()
    .replace(/^sha256=/i, '');

  if (sigHeader) {
    const expectedHmac = crypto
      .createHmac('sha256', configuredSecret)
      .update(rawBody)
      .digest('hex');
    if (safeEqualString(sigHeader.toLowerCase(), expectedHmac.toLowerCase())) {
      return { valid: true, mode: 'hmac_sha256' };
    }
  }

  return { valid: false, mode: 'rejected' };
}

export function getCaktoConfig() {
  const rows = db.prepare('SELECT key, value FROM cakto_config').all();
  const config = {
    offer_url: 'https://cakto.com.br/checkout/minha-live-game-premium',
    product_id: 'prod_minha_live_game_premium',
    offer_id: 'off_mensal_4990',
    webhook_secret: '',
  };
  for (const r of rows) {
    config[r.key] = r.value;
  }
  return config;
}

export function updateCaktoConfig(updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'string') {
      db.prepare(`
        INSERT INTO cakto_config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, value.trim());
    }
  }
  return getCaktoConfig();
}

/**
 * Extracts normalized email and customer identifier from Cakto payload
 */
function extractCustomerEmail(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [
    payload.customer?.email,
    payload.buyer?.email,
    payload.data?.customer?.email,
    payload.data?.buyer?.email,
    payload.client?.email,
    payload.payer?.email,
    payload.email,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('@')) {
      return c.trim().toLowerCase();
    }
  }
  return null;
}

/**
 * Extracts event type from Cakto payload
 */
function extractEventType(payload) {
  if (!payload || typeof payload !== 'object') return 'unknown';

  const raw =
    payload.event ||
    payload.event_type ||
    payload.type ||
    payload.status ||
    payload.data?.status ||
    payload.data?.event;

  return String(raw || 'unknown').toLowerCase().trim();
}

/**
 * Extracts order or transaction ID
 */
function extractTransactionId(payload) {
  if (!payload || typeof payload !== 'object') return crypto.randomUUID();

  return String(
    payload.id ||
    payload.order_id ||
    payload.transaction_id ||
    payload.data?.id ||
    payload.data?.order_id ||
    crypto.randomUUID()
  );
}

/**
 * Process Cakto Webhook Event with full idempotency
 */
export async function processCaktoWebhook(req) {
  const auth = verifyCaktoWebhookAuth(req);
  if (!auth.valid) {
    logAudit(null, 'CAKTO_WEBHOOK_REJECTED', {
      ip: req.ip,
      reason: 'invalid_signature_or_secret',
    });
    const err = new Error('Assinatura ou segredo do webhook Cakto inválido.');
    err.statusCode = 401;
    throw err;
  }

  const payload = req.body || {};
  const eventId = String(
    req.headers['x-cakto-event-id'] ||
    payload.id ||
    payload.event_id ||
    payload.order_id ||
    crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  );

  const eventType = extractEventType(payload);
  const now = Date.now();

  // 1. Idempotency Check: if event already processed, ignore safely
  const existing = db.prepare('SELECT id, processed FROM webhook_events WHERE id = ?').get(eventId);
  if (existing && existing.processed) {
    return { status: 'already_processed', eventId };
  }

  // Record received event
  db.prepare(`
    INSERT INTO webhook_events (id, event_type, payload, processed, received_at)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET received_at = excluded.received_at
  `).run(eventId, eventType, JSON.stringify(payload), now);

  const customerEmail = extractCustomerEmail(payload);
  const transactionId = extractTransactionId(payload);
  const amount = Number(payload.amount || payload.data?.amount || 49.99);

  let affectedUser = null;
  if (customerEmail) {
    affectedUser = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(customerEmail);
  }

  // Handle various event statuses
  const isApproved =
    eventType.includes('approved') ||
    eventType.includes('paid') ||
    eventType.includes('active') ||
    eventType === 'purchase.approved' ||
    eventType === 'subscription.active';

  const isCanceledOrRefunded =
    eventType.includes('refund') ||
    eventType.includes('cancel') ||
    eventType.includes('chargeback') ||
    eventType.includes('dispute');

  if (affectedUser) {
    if (isApproved) {
      // Activate or renew 30-day subscription
      const durationDays = 30;
      const startedAt = now;
      const expiresAt = now + durationDays * 86400 * 1000;
      const subId = `sub_${affectedUser.id}_${now}`;

      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_name, amount, status, started_at, expires_at, cakto_transaction_id, created_at, updated_at)
        VALUES (?, ?, 'MINHA LIVE GAME PREMIUM', ?, 'active', ?, ?, ?, ?, ?)
      `).run(subId, affectedUser.id, amount, startedAt, expiresAt, transactionId, now, now);

      db.prepare(`
        INSERT INTO payments (id, user_id, cakto_order_id, amount, status, payload, created_at)
        VALUES (?, ?, ?, ?, 'approved', ?, ?)
      `).run(`pay_${transactionId}_${now}`, affectedUser.id, transactionId, amount, JSON.stringify(payload), now);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, details, created_at)
        VALUES (?, 'SUBSCRIPTION_ACTIVATED', ?, ?)
      `).run(affectedUser.id, JSON.stringify({ amount, transactionId, eventId }), now);
    } else if (isCanceledOrRefunded) {
      const newStatus = eventType.includes('refund') ? 'refunded' : eventType.includes('chargeback') ? 'chargeback' : 'canceled';
      db.prepare(`
        UPDATE subscriptions SET status = ?, updated_at = ?
        WHERE user_id = ? AND status = 'active'
      `).run(newStatus, now, affectedUser.id);

      db.prepare(`
        INSERT INTO payments (id, user_id, cakto_order_id, amount, status, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`pay_${transactionId}_${now}`, affectedUser.id, transactionId, amount, newStatus, JSON.stringify(payload), now);

      db.prepare(`
        INSERT INTO audit_logs (user_id, action, details, created_at)
        VALUES (?, 'SUBSCRIPTION_CANCELLED_OR_REFUNDED', ?, ?)
      `).run(affectedUser.id, JSON.stringify({ newStatus, transactionId, eventId }), now);
    }
  }

  // Mark event as processed
  db.prepare('UPDATE webhook_events SET processed = 1 WHERE id = ?').run(eventId);

  return {
    status: 'success',
    eventId,
    eventType,
    userMatched: Boolean(affectedUser),
    email: customerEmail,
  };
}

export function listWebhookEvents(limit = 50) {
  return db.prepare(`
    SELECT id, event_type AS eventType, payload, processed, received_at AS receivedAt
    FROM webhook_events
    ORDER BY received_at DESC LIMIT ?
  `).all(limit);
}

export function listPayments(limit = 50) {
  return db.prepare(`
    SELECT p.id, p.amount, p.status, p.cakto_order_id AS orderId, p.created_at AS createdAt, u.email, u.display_name AS displayName
    FROM payments p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT ?
  `).all(limit);
}
