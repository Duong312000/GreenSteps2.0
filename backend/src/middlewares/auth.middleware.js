const jwt = require('jsonwebtoken');
require('../config/env');
const { User } = require('../models');
const authSessionService = require('../services/auth-session.service');

const JWT_SECRET = process.env.JWT_SECRET || 'greensteps-super-secret-key-2026';

function getRequestToken(req) {
  const authorization = req.headers?.authorization;
  if (authorization && authorization.startsWith('Bearer ')) return authorization.slice(7);
  return req.cookies?.token || null;
}

async function authenticateRequest(req, res, next, { soft = false } = {}) {
  const unauthorized = () => res.status(401).json({ success: false, error: 'Unauthorized' });
  const token = getRequestToken(req);
  if (!token) return soft ? next() : unauthorized();

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') return next(error);
    return soft ? next() : unauthorized();
  }

  if (!decoded?.id || !decoded?.sid) return soft ? next() : unauthorized();
  try {
    const session = await authSessionService.getActiveSession({ sessionId: decoded.sid, userId: decoded.id });
    if (!session) return soft ? next() : unauthorized();
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'username', 'fullname', 'role', 'account_status'] });
    if (!user) return soft ? next() : unauthorized();
    const status = user.account_status || 'active';
    if (status !== 'active') {
      if (soft) return res.status(403).json({ success: false, error: 'AccountDisabled' });
      return res.status(403).json({ success: false, error: 'AccountDisabled', message: status === 'suspended' ? 'Tài khoản đang tạm khóa.' : 'Tài khoản đã bị vô hiệu hóa.' });
    }
    await authSessionService.touchSession({ sessionId: session.id });
    req.authSession = session;
    req.user = { ...decoded, id: user.id, username: user.username, fullname: user.fullname, role: user.role };
    return next();
  } catch (error) { return next(error); }
}

const authMiddleware = (req, res, next) => authenticateRequest(req, res, next);
const strictAuthMiddleware = (req, res, next) => authenticateRequest(req, res, next);
const softAuth = (req, res, next) => authenticateRequest(req, res, next, { soft: true });

const checkRole = (roles = []) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden', message: 'Bạn không có quyền truy cập vào chức năng này!' });
  }
  next();
};

module.exports = { authMiddleware, strictAuthMiddleware, softAuth, checkRole, JWT_SECRET };
