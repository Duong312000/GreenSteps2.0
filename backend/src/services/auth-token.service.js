const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/auth.middleware');
const authSessionService = require('./auth-session.service');
const { recordSecurityEvent } = require('./security-audit.service');

async function issueAuthenticatedSession(user, req, method) {
  const accountStatus = user.account_status || 'active';
  if (accountStatus !== 'active') {
    const error = new Error(accountStatus === 'suspended' ? 'Tài khoản đang tạm khóa.' : 'Tài khoản đã bị vô hiệu hóa.');
    error.statusCode = 403;
    error.code = 'ACCOUNT_DISABLED';
    throw error;
  }
  const methods = Array.isArray(user.auth_methods) ? user.auth_methods : [];
  if (method && !methods.includes(method)) user.auth_methods = [...methods, method];
  user.last_login_at = new Date();
  await user.save();
  const session = await authSessionService.createSession({
    userId: user.id,
    userAgent: req?.headers?.['user-agent'],
    ip: req?.ip || req?.socket?.remoteAddress
  });
  const token = jwt.sign(
    { id: user.id, sid: session.id, username: user.username, role: user.role, fullname: user.fullname },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  recordSecurityEvent({ userId: user.id, sessionId: session.id, type: 'login_success', result: 'success', request: req }).catch(() => {});
  return token;
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

module.exports = { issueAuthenticatedSession, setAuthCookie };
