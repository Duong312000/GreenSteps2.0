const MAINTENANCE_HEADER = 'X-Maintenance-Mode';
const jwt = require('jsonwebtoken');
require('../config/env');
const { JWT_SECRET } = require('./auth.middleware');
const { User } = require('../models');
const authSessionService = require('../services/auth-session.service');

function readConfig() {
  return {
    enabled: /^(1|true|yes|on)$/i.test(process.env.MAINTENANCE_MODE || ''),
    startsAt: process.env.MAINTENANCE_STARTS_AT || null,
    expectedEndAt: process.env.MAINTENANCE_EXPECTED_END_AT || null,
    retryAfterSeconds: Math.max(30, Number.parseInt(process.env.MAINTENANCE_RETRY_AFTER_SECONDS || '45', 10) || 45),
    adminBypass: !/^(0|false|no|off)$/i.test(process.env.MAINTENANCE_ADMIN_BYPASS || 'true'),
    ipAllowlist: (process.env.MAINTENANCE_IP_ALLOWLIST || '').split(',').map(value => value.trim()).filter(Boolean),
  };
}

function normalizeIp(value = '') {
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function isIpAllowed(req, config = readConfig()) {
  if (!config.ipAllowlist.length) return false;
  const candidates = [req.ip, req.socket?.remoteAddress].filter(Boolean).map(normalizeIp);
  return candidates.some(ip => config.ipAllowlist.some(allowed => normalizeIp(allowed) === ip));
}

async function isAdminAllowed(req, config = readConfig()) {
  if (!config.adminBypass) return false;
  const authorization = req.headers?.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : req.cookies?.token;
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.id || !decoded.sid) return false;
    const session = await authSessionService.getActiveSession({ sessionId: decoded.sid, userId: decoded.id });
    if (!session) return false;
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'role', 'account_status'] });
    return user?.role === 'admin' && (user.account_status || 'active') === 'active';
  } catch {
    return false;
  }
}

function isExemptPath(pathname, config = readConfig()) {
  const path = pathname.replace(/^\/api\/v1(?=\/|$)/, '/api');
  if (path === '/api' || path === '/api/' || path === '/api/health') return true;
  if (path === '/api/maintenance-status') return true;
  if (path === '/uploads' || path.startsWith('/uploads/')) return true;
  if (path === '/images' || path.startsWith('/images/')) return true;
  return false;
}

async function getMaintenanceStatus(req) {
  const config = readConfig();
  const bypassed = isIpAllowed(req, config) || await isAdminAllowed(req, config);
  return {
    maintenanceMode: config.enabled && !bypassed,
    startsAt: config.startsAt,
    expectedEndAt: config.expectedEndAt,
    retryAfterSeconds: config.retryAfterSeconds,
  };
}

async function maintenanceStatusHandler(req, res) {
  const status = await getMaintenanceStatus(req);
  if (status.maintenanceMode) res.set(MAINTENANCE_HEADER, 'true');
  return res.json(status);
}

async function maintenanceMiddleware(req, res, next) {
  const config = readConfig();
  if (!config.enabled || isExemptPath(req.path, config) || isIpAllowed(req, config) || await isAdminAllowed(req, config)) return next();

  res.set(MAINTENANCE_HEADER, 'true');
  res.set('Retry-After', String(config.retryAfterSeconds));
  return res.status(503).json({
    success: false,
    maintenance: true,
    message: 'Maintenance is in progress. Please try again later.',
    startsAt: config.startsAt,
    expectedEndAt: config.expectedEndAt,
    retryAfterSeconds: config.retryAfterSeconds,
  });
}

module.exports = { maintenanceMiddleware, maintenanceStatusHandler, readConfig, getMaintenanceStatus, isAdminAllowed };
