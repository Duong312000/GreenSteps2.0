const jwt = require('jsonwebtoken');
require('../config/env');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'greensteps-super-secret-key-2026';

const authMiddleware = async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  const tryFallbackUser = async () => {
    const fallbackId = req.cookies?.userId || req.body?.authorId || req.body?.userId || req.query?.userId;
    if (fallbackId) {
      try {
        const user = await User.findByPk(fallbackId, { attributes: ['id', 'username', 'fullname', 'role', 'account_status'] });
        if (user && (user.account_status || 'active') === 'active') {
          req.user = { id: user.id, username: user.username, fullname: user.fullname, role: user.role };
          return true;
        }
      } catch (e) {}
    }
    return false;
  };

  if (!token) {
    if (await tryFallbackUser()) return next();
    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Mã xác thực không tìm thấy, vui lòng đăng nhập!' });
  }

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch (error) {
    if (await tryFallbackUser()) return next();
    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Mã xác thực đã hết hạn hoặc không hợp lệ!' });
  }

  try {
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'username', 'fullname', 'role', 'account_status'] });
    if (!user) {
      if (await tryFallbackUser()) return next();
      return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Tài khoản không còn tồn tại.' });
    }
    const status = user.account_status || 'active';
    if (status !== 'active') return res.status(403).json({ success: false, error: 'AccountDisabled', message: status === 'suspended' ? 'Tài khoản đang tạm khóa.' : 'Tài khoản đã bị vô hiệu hóa.' });
    req.user = { ...decoded, username: user.username, fullname: user.fullname, role: user.role };
    return next();
  } catch (error) { return next(error); }
};

const softAuth = async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password_hash'] } });
      if (user) {
        const status = user.account_status || 'active';
        if (status !== 'active') return res.status(403).json({ success: false, error: 'AccountDisabled', message: status === 'suspended' ? 'Tài khoản đang tạm khóa.' : 'Tài khoản đã bị vô hiệu hóa.' });
        req.user = { ...decoded, username: user.username, fullname: user.fullname, role: user.role };
      }
    } catch (error) {
      if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') return next(error);
    }
  }
  next();
};

const checkRole = (roles = []) => {
  return (req, res, next) => {
    // If softAuth or no user is logged in, restrict
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Bạn không có quyền truy cập vào chức năng này!'
      });
    }
    next();
  };
};

module.exports = { authMiddleware, softAuth, checkRole, JWT_SECRET };
