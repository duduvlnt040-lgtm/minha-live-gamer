import { db, isAdminEmail } from './db.mjs';

/**
 * Calculates current access status for a given user:
 * Admin: Lifetime permanent access (never expires, never blocked).
 * Subscribed: Active subscription confirmed via Cakto webhook.
 * Trial: Within 72 hours of initial account registration.
 * Expired: Trial ended and no active subscription -> paid features blocked.
 */
export function getUserAccessStatus(user) {
  if (!user) {
    return {
      hasAccess: false,
      isAdmin: false,
      isSubscribed: false,
      isTrial: false,
      trialHoursLeft: 0,
      trialDaysLeft: 0,
      status: 'unauthenticated',
      message: 'Usuário não autenticado.',
    };
  }

  // Admin guarantee (strict backend check)
  if (isAdminEmail(user.email) || user.role === 'admin' || user.isAdmin) {
    return {
      hasAccess: true,
      isAdmin: true,
      isSubscribed: true,
      isTrial: false,
      trialHoursLeft: 999999,
      trialDaysLeft: 99999,
      status: 'admin_lifetime',
      message: 'Acesso Vitalício de Administrador.',
    };
  }

  const now = Date.now();

  // 1. Check for active paid subscription
  const sub = db.prepare(`
    SELECT id, plan_name, amount, status, started_at, expires_at
    FROM subscriptions
    WHERE user_id = ? AND status = 'active'
    ORDER BY expires_at DESC LIMIT 1
  `).get(user.id);

  if (sub && (!sub.expires_at || sub.expires_at > now)) {
    return {
      hasAccess: true,
      isAdmin: false,
      isSubscribed: true,
      isTrial: false,
      trialHoursLeft: 0,
      trialDaysLeft: 0,
      subscription: sub,
      status: 'active_subscription',
      message: 'Assinatura Minha Live Game Premium ativa.',
    };
  }

  // 2. Check 3-day (72-hour) trial period
  const trial = db.prepare(`
    SELECT started_at, expires_at, is_active
    FROM trial_periods
    WHERE user_id = ?
  `).get(user.id);

  if (trial && trial.is_active && trial.expires_at > now) {
    const diffMs = trial.expires_at - now;
    const hoursLeft = Math.max(1, Math.ceil(diffMs / (3600 * 1000)));
    const daysLeft = Math.ceil(hoursLeft / 24);

    return {
      hasAccess: true,
      isAdmin: false,
      isSubscribed: false,
      isTrial: true,
      trialHoursLeft: hoursLeft,
      trialDaysLeft: daysLeft,
      trialExpiresAt: trial.expires_at,
      status: 'trial_active',
      message: `Período de teste ativo (${hoursLeft}h restantes).`,
    };
  }

  // 3. Trial expired, no active subscription
  return {
    hasAccess: false,
    isAdmin: false,
    isSubscribed: false,
    isTrial: false,
    trialHoursLeft: 0,
    trialDaysLeft: 0,
    trialExpiresAt: trial?.expires_at || now,
    status: 'trial_expired',
    message: 'Período de teste de 3 dias expirado. Assine para continuar utilizando os jogos e conectando sua LIVE.',
  };
}

/**
 * Middleware that strictly protects paid features:
 * - TikTok LIVE connection
 * - Game overlays (OBS / TikTok Live Studio)
 * - Custom trigger & event configuration
 */
export function requireActiveAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const access = getUserAccessStatus(req.user);
  if (!access.hasAccess) {
    return res.status(403).json({
      error: 'Seu período de teste de 3 dias expirou. Ative sua assinatura para continuar.',
      code: 'TRIAL_EXPIRED',
      requiresSubscription: true,
      planName: 'MINHA LIVE GAME PREMIUM',
      price: 'R$ 49,99/mês',
    });
  }

  req.access = access;
  next();
}
