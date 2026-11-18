const { randomUUID } = require('node:crypto');
const { SecurityAuditEvent, User } = require('../models');
const emailService = require('./email.service');

const EMAIL_ALERT_EVENTS = new Set([
  'login_success', 'login_failure', 'logout', 'session_revoked', 'other_sessions_revoked',
  'password_changed', 'password_setup', 'password_reset', 'all_sessions_revoked', 'passkey_registered', 'passkey_removed'
]);

async function recordSecurityEvent({ userId, sessionId = null, type, result = 'success', request, metadata = {} }) {
  if (!userId || !type) throw new TypeError('userId and type are required to record a security event.');
  const safeMetadata = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (/password|otp|token|secret|recovery|credential|challenge/i.test(key)) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) safeMetadata[key] = typeof value === 'string' ? value.slice(0, 256) : value;
  }
  const event = await SecurityAuditEvent.create({
    id: randomUUID(),
    user_id: String(userId),
    session_id: sessionId ? String(sessionId) : null,
    event_type: String(type).slice(0, 100),
    result: ['success', 'failure', 'denied'].includes(result) ? result : 'denied',
    ip_address: String(request?.ip || request?.socket?.remoteAddress || '').slice(0, 128) || null,
    user_agent: String(request?.get?.('user-agent') || request?.headers?.['user-agent'] || '').slice(0, 1024) || null,
    metadata: safeMetadata
  });
  if (EMAIL_ALERT_EVENTS.has(String(type))) {
    const user = await User.findByPk(String(userId), { attributes: ['email', 'security_email_notifications'] }).catch(() => null);
    if (user?.security_email_notifications === true && user.email) {
      const agent = String(request?.get?.('user-agent') || request?.headers?.['user-agent'] || '').slice(0, 256) || 'Trình duyệt không xác định';
      emailService.sendSecurityAlertEmail({ to: user.email, eventType: type, browser: agent, timestamp: event.created_at || event.createdAt || new Date() }).catch(error => {
        console.warn('Security alert email could not be sent:', error.code || error.message);
      });
    }
  }
  return event;
}

async function listSecurityEvents({ userId, page = 1, pageSize = 20 }) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 20)));
  const where = { user_id: String(userId) };
  const [items, total] = await Promise.all([
    SecurityAuditEvent.findAll({ where, order: [['created_at', 'DESC']], limit: safePageSize, offset: (safePage - 1) * safePageSize }),
    SecurityAuditEvent.count({ where })
  ]);
  return { items, page: safePage, pageSize: safePageSize, total };
}

module.exports = { recordSecurityEvent, listSecurityEvents };
