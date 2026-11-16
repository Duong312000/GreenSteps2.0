const models = require('../models');

const SECRET_FIELD = /password|passwd|token|secret|cookie|authorization|api[_-]?key|credential/i;
const ALLOWED_EVENT_KINDS = new Set(['security', 'error']);
const RETENTION_DAYS = 90;

function redactText(value) {
  return String(value || '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(mongodb(?:\+srv)?:\/\/)[^\s@]+@/gi, '$1[REDACTED]@')
    .replace(/\b(password|passwd|token|secret|cookie|authorization|api[_-]?key)\b\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '$1=[REDACTED]');
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return undefined;
  if (typeof value === 'string') return redactText(value).slice(0, 300);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeMetadata(item, depth + 1)).filter(item => item !== undefined);
  if (typeof value !== 'object') return undefined;
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    if (SECRET_FIELD.test(key)) continue;
    const sanitized = sanitizeMetadata(item, depth + 1);
    if (sanitized !== undefined) result[key.slice(0, 80)] = sanitized;
  }
  return result;
}

function normalizeEndpoint(req = {}) {
  const routePath = req.route?.path;
  const raw = routePath
    ? `${req.baseUrl || ''}${Array.isArray(routePath) ? routePath[0] : routePath}`
    : String(req.path || req.originalUrl || '/').split('?')[0];
  return raw
    .replace(/\/[0-9a-f]{24,}/gi, '/:id')
    .replace(/\/[A-Za-z0-9_-]{28,}/g, '/:id')
    .slice(0, 200) || '/';
}

function safeRecord(value, max = 160) {
  if (value === undefined || value === null || value === '') return null;
  return redactText(value).slice(0, max);
}

function createSecurityOperationsService({
  SystemEventLog = models.SystemEventLog,
  AdminAuditLog = models.AdminAuditLog,
  now = () => new Date()
} = {}) {
  async function recordSystemEvent(event = {}) {
    const kind = ALLOWED_EVENT_KINDS.has(event.kind) ? event.kind : 'error';
    const timestamp = now();
    return SystemEventLog.create({
      kind,
      action: safeRecord(event.action || 'system.event', 100),
      actor_id: safeRecord(event.actorId, 120),
      target_type: safeRecord(event.targetType, 100),
      target_id: safeRecord(event.targetId, 160),
      request_id: safeRecord(event.requestId, 100),
      endpoint: safeRecord(event.endpoint, 200),
      method: safeRecord(event.method, 12)?.toUpperCase() || null,
      status: Number.isInteger(event.status) ? event.status : null,
      error_type: safeRecord(event.errorType, 100),
      message: safeRecord(event.message, 500),
      result: ['success', 'failure'].includes(event.result) ? event.result : null,
      metadata: sanitizeMetadata(event.metadata) || {},
      expires_at: new Date(timestamp.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  async function recordAdminAudit({ actorId, targetId = '*', targetType = 'system', action, reason = '', result = 'success', metadata = {}, requestId, previousState = null, newState = null } = {}) {
    const timestamp = now();
    return AdminAuditLog.create({
      actor_id: safeRecord(actorId, 120) || 'unknown',
      target_user_id: safeRecord(targetId, 160) || '*',
      target_type: safeRecord(targetType, 100),
      target_id: safeRecord(targetId, 160),
      action: safeRecord(action || 'admin.action', 100),
      reason: safeRecord(reason, 500) || '',
      previous_state: sanitizeMetadata(previousState) || null,
      new_state: sanitizeMetadata(newState) || null,
      metadata: sanitizeMetadata(metadata) || {},
      request_id: safeRecord(requestId, 100),
      result: result === 'failure' ? 'failure' : 'success',
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  return { recordSystemEvent, recordAdminAudit };
}

module.exports = { createSecurityOperationsService, sanitizeMetadata, redactText, normalizeEndpoint, RETENTION_DAYS };
