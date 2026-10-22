const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, AuthSession } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'greensteps-jwt-secret-key-2026';

// 1. Đăng ký tài khoản
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
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
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng ký.' });
  }
});

// 2. Đăng nhập (Hỗ trợ Cookie, Session và JWT Token theo Chương VII & VIII)
router.post('/login', async (req, res) => {
  try {
    const { identifier, username, password } = req.body;
    const loginId = identifier || username;

    if (!loginId || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập/email và mật khẩu.' });
    }

    const user = await User.findOne({
      $or: [{ username: loginId }, { email: loginId.toLowerCase() }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại trong hệ thống.' });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Lý do: ${user.banned_reason || 'Vi phạm điều khoản'}` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác.' });
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
      secure: false, // true nếu chạy https
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
router.get('/me', async (req, res) => {
  try {
    let userId = null;

    // Kiểm tra Session hoặc JWT Header
    if (req.session && req.session.user) {
      userId = req.session.user.id;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    }

    const user = await User.findById(userId).select('-password_hash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin tài khoản.' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
  }
});

// 5. Cập nhật hồ sơ cá nhân
router.put('/profile', async (req, res) => {
  try {
    const { id, fullname, phone, dob, gender, address, job, avatarUrl } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    if (fullname !== undefined) user.profile.fullname = fullname;
    if (phone !== undefined) user.profile.phone = phone;
    if (dob !== undefined) user.profile.dob = dob;
    if (gender !== undefined) user.profile.gender = gender;
    if (address !== undefined) user.profile.address = address;
    if (job !== undefined) user.profile.job = job;
    if (avatarUrl !== undefined) user.profile.avatarUrl = avatarUrl;

    await user.save();
    return res.json({ success: true, message: 'Cập nhật thông tin thành công!', user });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật hồ sơ.' });
  }
});

// 6. Đăng nhập Google giả lập hoặc thật
router.post('/google', async (req, res) => {
  try {
    const { email, fullname } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Thiếu thông tin Google.' });

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        username: email.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
        email: email.toLowerCase(),
        password_hash: await bcrypt.hash('google_oauth_default_pwd', 10),
        auth_provider: 'google',
        profile: { fullname: fullname || email.split('@')[0] },
        roles: ['traveler'],
        verified: true
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, roles: user.roles },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        fullname: user.profile.fullname,
        email: user.email,
        role: user.roles.includes('admin') ? 'admin' : (user.roles.includes('provider') ? 'provider' : 'traveler'),
        roles: user.roles
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực Google.' });
  }
});

module.exports = router;
