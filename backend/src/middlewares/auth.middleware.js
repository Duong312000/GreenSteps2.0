const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'greensteps-super-secret-key-2026';

const authMiddleware = (req, res, next) => {
  let token = null;

  // 1. Get token from Authorization header or Cookies
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Mã xác thực không tìm thấy, vui lòng đăng nhập!' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, fullname }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Mã xác thực đã hết hạn hoặc không hợp lệ!' });
  }
};

const softAuth = (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Ignore verification errors for optional auth
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
