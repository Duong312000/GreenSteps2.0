const { facebookConfig, verifyFacebookAccessToken } = require('../utils/facebook-auth');
const { verifyGoogleAccessToken } = require('../utils/google-auth');
const { randomBytes } = require('node:crypto');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { isValidPassword, PASSWORD_MESSAGE } = require('../utils/password.validation');
const jwt = require('jsonwebtoken');
const { User, AuthSession } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'greensteps-jwt-secret-key-2026';

function publicUser(user) {
  const role = user.roles.includes('admin') ? 'admin' : user.roles.includes('provider') ? 'provider' : 'traveler';
  return { id: user._id, username: user.username, email: user.email, role,
    ...(user.profile.toObject?.() || user.profile), is_verified: user.verified };
}
async function requireAccount(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
    if (!token) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') return res.status(403).json({ success: false, message: 'Tài khoản không hoạt động.' });
    req.account = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
  }
}

// 1. Đăng ký tài khoản
router.post('/register', async (req, res) => {
  try {
    const { password } = req.body;
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (username.length < 3 || username.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập phải có 3–100 ký tự và email phải hợp lệ.' });
    }
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_MESSAGE });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc email đã tồn tại.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email: email.toLowerCase(),
      password_hash,
      profile: { fullname: username },
      roles: ['traveler'],
      verified: true // Demo mode: auto-verified
    });

    await user.save();
    return res.json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay.',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles
      }
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Tên đăng nhập hoặc email đã tồn tại.' });
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng ký.' });
  }
});

// 2. Đăng nhập (Hỗ trợ Cookie, Session và JWT Token theo Chương VII & VIII)
router.post('/login', async (req, res) => {
  try {
    const { identifier, username, password } = req.body;
    const loginId = typeof (identifier || username) === 'string' ? (identifier || username).trim() : '';

    if (!loginId || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập/email và mật khẩu.' });
    }

    const user = await User.findOne({
      $or: [{ username: loginId }, { email: loginId.toLowerCase() }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email/tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Lý do: ${user.banned_reason || 'Vi phạm điều khoản'}` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email/tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    // Tạo JWT Token
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, roles: user.roles },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Ghi Cookie (Chương VIII - Slide 10-15)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Ghi Session (Chương VIII - Slide 35-45)
    if (req.session) {
      req.session.user = {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles
      };
    }

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        fullname: user.profile.fullname || user.username,
        email: user.email,
        phone: user.profile.phone,
        role: user.roles.includes('admin') ? 'admin' : (user.roles.includes('provider') ? 'provider' : 'traveler'),
        roles: user.roles,
        avatarUrl: user.profile.avatarUrl,
        wallet: user.wallet
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

// 3. Đăng xuất (Xóa Cookie & Hủy Session)
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  if (req.session) {
    req.session.destroy(err => {
      if (err) console.error('Error destroying session:', err);
    });
  }
  return res.json({ success: true, message: 'Đã đăng xuất tài khoản!' });
});

// 4. Lấy thông tin tài khoản hiện tại (Profile)
router.get(['/me', '/profile', '/profile/:userId'], requireAccount, (req, res) => {
  return res.json({ success: true, user: publicUser(req.account) });
});

router.put(['/profile', '/profile/:userId'], requireAccount, async (req, res) => {
  try {
    const user = req.account;
    for (const key of ['fullname', 'phone', 'dob', 'gender', 'address', 'job', 'avatarUrl']) {
      if (req.body[key] !== undefined) user.profile[key] = req.body[key];
    }
    await user.save();
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Thông tin hồ sơ không hợp lệ.' });
  }
});

// 6. Đăng nhập Google giả lập hoặc thật
router.get('/google/config', (req, res) => res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' }));
router.post(['/google', '/google-login'], async (req, res) => {
  try {
    const { email, fullname, avatarUrl } = await verifyGoogleAccessToken(req.body.accessToken);
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        username: 'google_' + randomBytes(12).toString('hex'),
        email,
        password_hash: await bcrypt.hash(randomBytes(48).toString('base64url'), 10),
        auth_provider: 'google',
        profile: { fullname, avatarUrl },
        roles: ['traveler'], verified: true
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Tài khoản chưa hoạt động hoặc đã bị khóa.' });
    }
    const role = user.roles.includes('admin') ? 'admin' : user.roles.includes('provider') ? 'provider' : 'traveler';
    const token = jwt.sign({ id: user._id, username: user.username, email, role, roles: user.roles }, JWT_SECRET, { expiresIn: '7d' });
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('token', token, { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', maxAge: 7 * 86400000 });
    if (req.session) req.session.user = { id: user._id, username: user.username, email, roles: user.roles };
    return res.json({ success: true, token, user: {
      id: user._id, username: user.username, email: user.email, role,
      fullname: user.profile.fullname, avatarUrl: user.profile.avatarUrl, is_verified: user.verified
    } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Không thể đăng nhập Google. Vui lòng thử lại.' });
  }
});

router.get('/facebook/config', (req, res) => res.json(facebookConfig()));
router.post('/facebook-login', async (req, res) => {
  try {
    const { email, fullname, avatarUrl, facebookId } = await verifyFacebookAccessToken(req.body.accessToken);
    let user = await User.findOne({ facebook_id: facebookId });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        if (user.status !== 'active') {
          return res.status(403).json({ success: false, message: 'Tài khoản chưa hoạt động hoặc đã bị khóa.' });
        }
        if (user.facebook_id && user.facebook_id !== facebookId) {
          return res.status(409).json({ success: false, message: 'Tài khoản đã liên kết với một Facebook khác.' });
        }
        const linked = await User.findOneAndUpdate(
          { _id: user._id, $or: [{ facebook_id: { $exists: false } }, { facebook_id: null }, { facebook_id: facebookId }] },
          { $set: { facebook_id: facebookId } },
          { new: true, runValidators: true }
        );
        if (!linked) return res.status(409).json({ success: false, message: 'Liên kết tài khoản đã thay đổi. Vui lòng thử lại.' });
        user = linked;
      }
    }
    if (!user) {
      user = await User.create({
        facebook_id: facebookId,
        username: 'facebook_' + randomBytes(12).toString('hex'),
        email,
        password_hash: await bcrypt.hash(randomBytes(48).toString('base64url'), 10),
        auth_provider: 'facebook',
        profile: { fullname, avatarUrl },
        roles: ['traveler'], verified: true
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Tài khoản chưa hoạt động hoặc đã bị khóa.' });
    }
    const role = user.roles.includes('admin') ? 'admin' : user.roles.includes('provider') ? 'provider' : 'traveler';
    const token = jwt.sign({ id: user._id, username: user.username, email, role, roles: user.roles }, JWT_SECRET, { expiresIn: '7d' });
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('token', token, { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', maxAge: 7 * 86400000 });
    if (req.session) req.session.user = { id: user._id, username: user.username, email, roles: user.roles };
    return res.json({ success: true, token, user: {
      id: user._id, username: user.username, email: user.email, role,
      fullname: user.profile.fullname, avatarUrl: user.profile.avatarUrl, is_verified: user.verified
    } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Không thể đăng nhập Facebook. Vui lòng thử lại.' });
  }
});

module.exports = router;
