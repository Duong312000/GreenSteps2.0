const { randomUUID } = require('node:crypto');
const { AuthSession } = require('../models');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;

function classifyDevice(userAgent = '') {
  const ua = String(userAgent).slice(0, 1024);
  let browser = 'Trình duyệt không xác định';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium|Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  let platform = 'Thiết bị không xác định';
  if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
  else if (/Android/i.test(ua)) platform = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) platform = 'macOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  return { browser, platform, userAgent: ua || null };
}

async function createSession({ userId, userAgent, ip, now = new Date() }) {
  if (!userId) throw new TypeError('userId is required to create an authentication session.');
  const device = classifyDevice(userAgent);
  return AuthSession.create({
    id: randomUUID(),
    user_id: String(userId),
    expires_at: new Date(now.getTime() + SESSION_TTL_MS),
    last_active_at: now,
    revoked_at: null,
    user_agent: device.userAgent,
    browser: device.browser,
    platform: device.platform,
    ip_address: String(ip || '').slice(0, 128) || null,
    revoke_reason: null
  });
}

async function getActiveSession({ sessionId, userId, now = new Date() }) {
  if (!sessionId || !userId) return null;
  const session = await AuthSession.findByPk(String(sessionId));
  if (!session || String(session.user_id) !== String(userId)) return null;
  if (session.revoked_at || !session.expires_at || new Date(session.expires_at).getTime() <= now.getTime()) return null;
  return session;
}

async function touchSession({ sessionId, now = new Date() }) {
  const session = await AuthSession.findByPk(String(sessionId));
  if (!session || session.revoked_at || !session.last_active_at) return false;
  if (now.getTime() - new Date(session.last_active_at).getTime() < TOUCH_INTERVAL_MS) return true;
  session.last_active_at = now;
  await session.save();
  return true;
}

async function revokeSession({ sessionId, userId, now = new Date(), reason = 'user_logout' }) {
  const session = await AuthSession.findByPk(String(sessionId));
  if (!session || String(session.user_id) !== String(userId) || session.revoked_at) return false;
  session.revoked_at = now;
  session.revoke_reason = reason;
  await session.save();
  return true;
}

async function revokeOtherSessions({ userId, currentSessionId, now = new Date(), reason = 'user_revoked_others' }) {
  const sessions = await AuthSession.findAll({ where: { user_id: String(userId), revoked_at: null } });
  let count = 0;
  for (const session of sessions) {
    if (String(session.user_id) !== String(userId)) continue;
    if (session.id === currentSessionId || new Date(session.expires_at).getTime() <= now.getTime()) continue;
    session.revoked_at = now;
    session.revoke_reason = reason;
    await session.save();
    count += 1;
  }
  return count;
}

async function revokeAllSessions({ userId, now = new Date(), reason = 'security_reset' }) {
  if (!userId) return 0;
  const sessions = await AuthSession.findAll({ where: { user_id: String(userId), revoked_at: null } });
  let count = 0;
  for (const session of sessions) {
    if (String(session.user_id) !== String(userId) || session.revoked_at) continue;
    session.revoked_at = now;
    session.revoke_reason = reason;
    await session.save();
    count += 1;
  }
  return count;
}

async function listUserSessions({ userId, currentSessionId, now = new Date() }) {
  if (!userId) return [];
  const rows = await AuthSession.findAll({ where: { user_id: String(userId), revoked_at: null } });
  return rows
    .filter(session => String(session.user_id) === String(userId)
      && !session.revoked_at
      && new Date(session.expires_at).getTime() > now.getTime())
    .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0))
    .map(session => ({
      id: session.id,
      isCurrent: session.id === currentSessionId,
      browser: session.browser || 'Trình duyệt không xác định',
      platform: session.platform || 'Thiết bị không xác định',
      createdAt: session.created_at || session.createdAt || null,
      lastActiveAt: session.last_active_at || null,
      expiresAt: session.expires_at,
      ipAddress: session.ip_address || null
    }));
}

module.exports = {
  SESSION_TTL_MS,
  classifyDevice,
  createSession,
  getActiveSession,
  touchSession,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
  listUserSessions
};
