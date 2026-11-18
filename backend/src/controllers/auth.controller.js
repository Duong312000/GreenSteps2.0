const facebookAuthService = require('../services/facebook-auth.service');
const googleAuthService = require('../services/google-auth.service');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('../db/mongo-store');
const { User, AuthOtp, PendingRegistration } = require('../models/index');
const { JWT_SECRET } = require('../middlewares/auth.middleware');
const authSessionService = require('../services/auth-session.service');
const { recordSecurityEvent } = require('../services/security-audit.service');
const authTokenService = require('../services/auth-token.service');
const passkeyService = require('../services/passkey.service');
const {
  PASSWORD_MESSAGE,
  normalizeEmail,
  normalizeText,
  isValidEmail,
  isValidPassword,
  isValidOtp
} = require('../utils/auth.validation');
const {
  createAndSendOtp,
  createAndSendPendingRegistrationOtp,
  resendPendingRegistrationOtp,
  verifyPendingRegistrationOtp,
  verifyOtp,
  createPasswordResetLink,
  createResetToken,
  consumeResetToken
} = require('../services/otp.service');

const PRIVATE_USER_FIELDS = [
  'password_hash', 'totp_enabled_at', 'totp_secret_encrypted',
  'totp_last_verified_step', 'recovery_code_hashes'
];

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullname: user.fullname,
    phone: user.phone,
    dob: user.dob,
    gender: user.gender,
    address: user.address,
    company_name: user.company_name,
    avatarUrl: user.avatarUrl,
    avatar: user.avatarUrl,
    is_verified: user.is_verified
  };
}

function createUserId() {
  return 'UG' + Math.floor(10000000 + Math.random() * 90000000);
}

async function signAuthToken(user, req, method) {
  return authTokenService.issueAuthenticatedSession(user, req, method);
}

function setAuthCookie(res, token) {
  authTokenService.setAuthCookie(res, token);
}

async function findUserByIdentifier(identifier) {
  const normalized = normalizeText(identifier);
  const email = normalizeEmail(normalized);
  return User.findOne({
    where: {
      [Op.or]: [
        { username: normalized },
        { email }
      ]
    }
  });
}

exports.register = async (req, res, next) => {
  try {
    const username = normalizeText(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!username) return res.status(400).json({ success: false, message: 'Tên đăng nhập không được để trống.' });
    if (username.length < 3) return res.status(400).json({ success: false, message: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
    if (!email) return res.status(400).json({ success: false, message: 'Email không được để trống.' });
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    if (!password) return res.status(400).json({ success: false, message: 'Mật khẩu không được để trống.' });
    if (!isValidPassword(password)) return res.status(400).json({ success: false, message: PASSWORD_MESSAGE });

    // Run database query and bcrypt hashing in parallel to minimize latency
    const [existingUser, password_hash] = await Promise.all([
      User.findOne({
        where: {
          [Op.or]: [
            { username },
            { email }
          ]
        }
      }),
      bcrypt.hash(password, 10)
    ]);

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ success: false, message: 'Tên tài khoản này đã được sử dụng!' });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ success: false, message: 'Email này đã được sử dụng!' });
      }
    }

    await User.store.transaction(async (transaction) => {
      await createAndSendPendingRegistrationOtp({
        username,
        email,
        passwordHash: password_hash
      }, transaction);
    });

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      requiresVerification: true,
      user: {
        username,
        email,
        is_verified: false
      }
    });
  } catch (error) {
    if (error.code === 'OTP_RESEND_TOO_SOON') {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds
      });
    }
    next(error);
  }
};

exports.verifyRegisterOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    if (!isValidOtp(otp)) return res.status(400).json({ success: false, message: 'Mã OTP phải gồm đúng 6 chữ số.' });

    const pending = await verifyPendingRegistrationOtp({ email, otp });
    const createdAccount = await User.store.transaction(async (transaction) => {
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { username: pending.username },
            { email: pending.email }
          ]
        },
        transaction
      });

      if (existingUser) {
        const error = new Error('Email hoặc tên đăng nhập đã được sử dụng.');
        error.statusCode = 400;
        error.code = 'ACCOUNT_ALREADY_EXISTS';
        throw error;
      }

      const createdUser = await User.create({
        id: createUserId(),
        role: 'traveler',
        username: pending.username,
        password_hash: pending.password_hash,
        auth_methods: ['password'],
        password_policy_checked_at: new Date(),
        password_changed_at: new Date(),
        email: pending.email,
        fullname: pending.username,
        phone: null,
        dob: null,
        gender: 'Khác',
        address: '',
        job: '',
        is_verified: true
      }, { transaction });

      pending.consumed_at = new Date();
      await pending.save({ transaction });
      return createdUser;
    });

    const token = await signAuthToken(createdAccount, req, 'password');
    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: 'Xác thực tài khoản thành công.',
      token,
      user: publicUser(createdAccount)
    });
  } catch (error) {
    next(error);
  }
};

exports.resendRegisterOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });

    await resendPendingRegistrationOtp(email);
    res.json({ success: true, message: 'Mã xác thực mới đã được gửi.' });
  } catch (error) {
    if (error.code === 'OTP_RESEND_TOO_SOON') {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds
      });
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const identifier = normalizeText(req.body.identifier || req.body.username);
    const password = String(req.body.password || '');
    if (!identifier) return res.status(400).json({ success: false, message: 'Vui lòng nhập email hoặc tên đăng nhập.' });
    if (!password) return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu.' });

    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(401).json({ success: false, message: 'Email/tên đăng nhập hoặc mật khẩu không chính xác!' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      recordSecurityEvent({ userId: user.id, type: 'login_failure', result: 'failure', request: req }).catch(() => {});
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const accountStatus = user.account_status || 'active';
    if (accountStatus !== 'active') {
      return res.status(403).json({ success: false, code: 'ACCOUNT_DISABLED', message: accountStatus === 'suspended' ? 'Tài khoản đang tạm khóa.' : 'Tài khoản đã bị vô hiệu hóa.' });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Tài khoản chưa được xác thực.',
        email: user.email
      });
    }

    const token = await signAuthToken(user, req, 'password');
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: 'Đăng nhập hệ thống thành công!',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

exports.requestForgotPasswordOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });

    const user = await User.findOne({ where: { email } });
    if (user) await createAndSendOtp(user, 'RESET_PASSWORD');

    res.json({
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, mã xác thực đã được gửi.'
    });
  } catch (error) {
    if (error.code === 'OTP_RESEND_TOO_SOON') {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds
      });
    }
    next(error);
  }
};

exports.requestPasswordResetLink = async (req, res, next) => {
  const genericResponse = { success: true, message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.' };
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.json(genericResponse);

    const reset = await createPasswordResetLink(user);
    const resetUrl = new URL('/reset-password', process.env.CLIENT_URL || 'http://localhost:4200');
    resetUrl.searchParams.set('token', reset.token);
    try {
      await require('../services/email.service').sendPasswordResetEmail({ to: user.email, resetUrl: resetUrl.toString() });
    } catch (error) {
      reset.record.reset_token_consumed_at = new Date();
      reset.record.consumed_at = new Date();
      await reset.record.save().catch(() => {});
      console.warn('Password reset link delivery failed:', error?.code || error?.name || 'unknown');
    }
    return res.json(genericResponse);
  } catch (error) {
    if (error.code === 'OTP_RESEND_TOO_SOON') return res.json(genericResponse);
    return next(error);
  }
};

exports.verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    if (!isValidOtp(otp)) return res.status(400).json({ success: false, message: 'Mã OTP phải gồm đúng 6 chữ số.' });

    const { user, otpRecord } = await verifyOtp({ email, otp, purpose: 'RESET_PASSWORD' });
    const resetToken = await createResetToken(user, otpRecord);
    res.json({ success: true, message: 'Xác thực OTP thành công.', resetToken });
  } catch (error) {
    next(error);
  }
};

exports.resetForgotPassword = async (req, res, next) => {
  try {
    const resetToken = String(req.body.resetToken || '');
    const newPassword = String(req.body.newPassword || '');
    if (!resetToken) return res.status(400).json({ success: false, message: 'Thiếu reset token.' });
    if (!isValidPassword(newPassword)) return res.status(400).json({ success: false, message: PASSWORD_MESSAGE });

    const user = await consumeResetToken(resetToken);
    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.auth_methods = [...new Set([...(Array.isArray(user.auth_methods) ? user.auth_methods : []), 'password'])];
    user.password_changed_at = new Date();
    user.password_policy_checked_at = new Date();
    await user.save();
    const revokedCount = await authSessionService.revokeAllSessions({ userId: user.id, reason: 'password_reset' });
    await recordSecurityEvent({ userId: user.id, type: 'password_reset', result: 'success', request: req, metadata: { sessionsRevoked: revokedCount } }).catch(() => {});

    res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Vui l?ng ??ng nh?p.' });
    if (req.params.userId && String(req.params.userId) !== String(userId)) return res.status(403).json({ success: false, message: 'B?n kh?ng c? quy?n xem t?i kho?n n?y.' });
    const user = await User.findByPk(userId, { attributes: { exclude: PRIVATE_USER_FIELDS } });
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin tài khoản!' });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

function promptTerminalApproval(message) {
  return new Promise((resolve) => {
    console.log('\n========================================');
    console.log('!!! YÊU CẦU PHÊ DUYỆT TỪ TERMINAL !!!');
    console.log(message);
    console.log('========================================\n');

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Phê duyệt yêu cầu này? (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'y');
    });
  });
}

exports.updateProfile = async (req, res, next) => {
  try {
    const { fullname, phone, dob, gender, address, job, role, company_name, companyName, avatarUrl, avatar_url } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Vui l?ng ??ng nh?p.' });
    if (req.params.userId && String(req.params.userId) !== String(userId)) return res.status(403).json({ success: false, message: 'B?n kh?ng c? quy?n ch?nh s?a t?i kho?n n?y.' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });

    let pendingApproval = false;
    if (role === 'provider' && user.role !== 'provider') {
      pendingApproval = true;
      const displayCompanyName = company_name || companyName || 'Chưa đặt tên doanh nghiệp';

      const { Vender, Provider, VenderContract } = require('../models/index');

      let vender = await Vender.findOne({ where: { user_id: userId } });
      if (!vender) {
        vender = await Vender.create({
          id: `provider_${userId}`,
          user_id: userId,
          registration_date: new Date()
        });
      }

      // Check or create Provider record
      const providerId = 'PROV-' + Date.now().toString().slice(-6);
      const existingProvider = await Provider.findOne({ where: { user_id: userId } });
      if (!existingProvider) await Provider.create({
        id: providerId,
        user_id: userId,
        contract_id: 'CON0001',
        name_provider: displayCompanyName,
        field: 'Dịch vụ sinh thái',
        destination: address || user.address || 'Việt Nam',
        image_url: 'image/Viet Nam.png',
        provider_status: 'pending'
      });

      // Create VenderContract record to show up in Admin Dashboard pending list
      let venderContract = await VenderContract.findOne({ where: { user_id: userId } });
      if (!venderContract) {
        await VenderContract.create({
          id: 'VC-' + Date.now().toString().slice(-6),
          user_id: userId,
          name_contract: 'Hợp đồng đăng ký Nhà cung cấp',
          text: `Tài khoản #${userId} (${fullname || user.fullname || user.username}) yêu cầu đăng ký làm nhà cung cấp cho doanh nghiệp: "${displayCompanyName}"`
        });
      }
    }

    await User.update({
      fullname,
      phone,
      dob: dob || null,
      gender,
      address,
      job,
      role: user.role,
      company_name: company_name || companyName || user.company_name,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : (avatar_url !== undefined ? avatar_url : user.avatarUrl)
    }, { where: { id: userId } });

    const updatedUser = await User.findByPk(userId, { attributes: { exclude: PRIVATE_USER_FIELDS } });
    if (pendingApproval) {
      res.json({
        success: true,
        pending: true,
        message: 'Yêu cầu đăng ký làm nhà cung cấp đã được gửi và đang chờ Admin phê duyệt!',
        user: updatedUser
      });
    } else {
      res.json({ success: true, message: 'Cập nhật hồ sơ cá nhân thành công!', user: updatedUser });
    }
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    if (!isValidPassword(String(newPassword || ''))) {
      return res.status(400).json({ success: false, message: PASSWORD_MESSAGE });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Kh?ng t?m th?y t?i kho?n.' });
    const methods = Array.isArray(user.auth_methods) ? user.auth_methods : [];
    if (!methods.includes('password')) return res.status(409).json({ success: false, code: 'PASSWORD_SETUP_REQUIRES_VERIFICATION', message: 'T?i kho?n ??ng nh?p qua nh? cung c?p c?n x?c minh email tr??c khi ??t m?t kh?u.' });
    const isMatch = await bcrypt.compare(String(oldPassword || ''), user.password_hash);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác!' });

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.password_changed_at = new Date();
    user.password_policy_checked_at = new Date();
    await user.save();
    const revokedCount = await authSessionService.revokeOtherSessions({ userId, currentSessionId: req.authSession?.id, reason: 'password_changed' });
    await recordSecurityEvent({ userId, sessionId: req.authSession?.id, type: 'password_changed', result: 'success', request: req, metadata: { otherSessionsRevoked: revokedCount } }).catch(() => {});
    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    next(error);
  }
};

exports.trackInterest = async (req, res, next) => {
  try {
    const { destination } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!destination) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp điểm đến quan tâm!' });
    await User.update({ last_interest: destination }, { where: { id: userId } });
    res.json({ success: true, message: 'Ghi nhận địa điểm quan tâm thành công.' });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const session = req.authSession;
    if (session) {
      const revoked = await authSessionService.revokeSession({ sessionId: session.id, userId: req.user.id, reason: 'logout' });
      if (revoked) await recordSecurityEvent({ userId: req.user.id, sessionId: session.id, type: 'logout', result: 'success', request: req }).catch(() => {});
    }
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });
    res.json({ success: true, message: 'Đăng xuất thành công!' });
  } catch (error) {
    next(error);
  }
};

exports.getPasskeyAuthenticationOptions = async (req, res, next) => {
  try {
    const result = await passkeyService.beginAuthentication();
    return res.json({ success: true, ...result });
  } catch (error) { return next(error); }
};

exports.verifyPasskeyAuthentication = async (req, res, next) => {
  try {
    const result = await passkeyService.finishAuthentication({ challengeId: req.body?.challengeId, response: req.body?.response });
    if (!result.ok) return res.status(401).json({ success: false, message: 'Không thể xác thực passkey.' });
    const token = await signAuthToken(result.user, req, 'passkey');
    setAuthCookie(res, token);
    await recordSecurityEvent({ userId: result.user.id, type: 'passkey_login', result: 'success', request: req }).catch(() => {});
    return res.json({ success: true, token, user: publicUser(result.user) });
  } catch (error) { return next(error); }
};

exports.googleLogin = async (req, res, next) => {
  try {
    const { email, fullname, avatarUrl } = await googleAuthService.verifyGoogleAccessToken(req.body.accessToken);
    const normalizedEmail = normalizeEmail(email);
    let user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      // Auto create new user
      const newUserId = createUserId();
      const generatedUsername = (fullname || email.split('@')[0])
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      let finalUsername = generatedUsername || 'google_user';
      let count = 1;
      while (await User.findOne({ where: { username: finalUsername } })) {
        finalUsername = (generatedUsername || 'google_user') + count;
        count++;
      }

      const defaultPassword = randomBytes(48).toString('base64url');
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      user = await User.create({
        id: newUserId,
        role: 'traveler',
        username: finalUsername,
        password_hash: passwordHash,
        email: normalizedEmail,
        fullname: fullname || email.split('@')[0],
        avatarUrl,
        gender: 'Khác',
        address: '',
        job: '',
        is_verified: true
      });
    }

    const token = await signAuthToken(user, req, 'google');
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: 'Đăng nhập Google thành công!',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

exports.facebookLogin = async (req, res, next) => {
  try {
    const { email, fullname, avatarUrl, facebookId } = await facebookAuthService.verifyFacebookAccessToken(req.body.accessToken);
    const normalizedEmail = normalizeEmail(email);
    let user = await User.findOne({ where: { facebook_id: facebookId } });
    if (!user) {
      user = await User.findOne({ where: { email: normalizedEmail } });
      if (user) {
        if (user.facebook_id && user.facebook_id !== facebookId) {
          return res.status(409).json({ success: false, message: 'Tài khoản đã liên kết với một Facebook khác.' });
        }
        const [updated] = await User.update({ facebook_id: facebookId }, {
          where: { id: user.id, [Op.or]: [{ facebook_id: null }, { facebook_id: facebookId }] }
        });
        if (!updated) return res.status(409).json({ success: false, message: 'Liên kết tài khoản đã thay đổi. Vui lòng thử lại.' });
        // User.update increments the document revision; reload before saving last_login_at.
        user = await User.findByPk(user.id);
      }
    }
    if (!user) {
      // Auto create new user
      const newUserId = createUserId();
      const generatedUsername = (fullname || email.split('@')[0])
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      let finalUsername = generatedUsername || 'facebook_user';
      let count = 1;
      while (await User.findOne({ where: { username: finalUsername } })) {
        finalUsername = (generatedUsername || 'facebook_user') + count;
        count++;
      }

      const defaultPassword = randomBytes(48).toString('base64url');
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      user = await User.create({
        id: newUserId,
        facebook_id: facebookId,
        role: 'traveler',
        username: finalUsername,
        password_hash: passwordHash,
        email: normalizedEmail,
        fullname: fullname || email.split('@')[0],
        avatarUrl,
        gender: 'Khác',
        address: '',
        job: '',
        is_verified: true
      });
    }

    const token = await signAuthToken(user, req, 'facebook');
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: 'Đăng nhập Facebook thành công!',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

exports.requestCheckoutOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const fullname = req.body.fullname || 'Khách hàng';

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email không được để trống.' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      // 1. Existing user: Send a login/auth OTP using AuthOtp
      const latest = await AuthOtp.findOne({
        where: { user_id: existingUser.id, purpose: 'RESET_PASSWORD', consumed_at: null },
        order: [['created_at', 'DESC']]
      });

      if (latest && latest.resend_available_at && latest.resend_available_at > new Date()) {
        const retryAfterSeconds = Math.ceil((latest.resend_available_at.getTime() - Date.now()) / 1000);
        return res.status(429).json({ success: false, message: 'Vui lòng chờ trước khi gửi lại mã.', retryAfterSeconds });
      }

      await AuthOtp.update(
        { consumed_at: new Date() },
        { where: { user_id: existingUser.id, purpose: 'RESET_PASSWORD', consumed_at: null } }
      );

      const crypto = require('crypto');
      const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
      const otpHash = crypto.createHmac('sha256', JWT_SECRET).update(otp).digest('hex');
      const hashFormat = `sha256:${otpHash}`;

      await AuthOtp.create({
        user_id: existingUser.id,
        purpose: 'RESET_PASSWORD',
        otp_hash: hashFormat,
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        resend_available_at: new Date(Date.now() + 60 * 1000)
      });

      const { sendOtpEmail } = require('../services/email.service');
      await sendOtpEmail({ to: email, otp, purpose: 'RESET_PASSWORD' }).catch(err => console.error(err));

      return res.json({ success: true, message: 'Mã xác thực đăng nhập đã được gửi tới email của bạn.', exists: true });
    } else {
      // 2. New user: Send registration OTP using PendingRegistration
      const generatedUsername = fullname
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      let finalUsername = generatedUsername || 'traveler';
      let count = 1;
      while (await User.findOne({ where: { username: finalUsername } })) {
        finalUsername = (generatedUsername || 'traveler') + count;
        count++;
      }

      const defaultPassword = finalUsername + '123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      const { createAndSendPendingRegistrationOtp } = require('../services/otp.service');
      try {
        await createAndSendPendingRegistrationOtp({
          username: finalUsername,
          email,
          passwordHash
        });
        return res.json({ success: true, message: 'Mã xác thực đăng ký tài khoản mới đã được gửi tới email của bạn.', exists: false });
      } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message, retryAfterSeconds: err.retryAfterSeconds });
      }
    }
  } catch (error) {
    next(error);
  }
};

exports.verifyCheckoutOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = req.body.otp;
    const fullname = req.body.fullname || 'Khách hàng';
    const phone = req.body.phone || null;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ email và mã OTP.' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      // Verify login OTP using AuthOtp
      const latest = await AuthOtp.findOne({
        where: { user_id: existingUser.id, purpose: 'RESET_PASSWORD', consumed_at: null },
        order: [['created_at', 'DESC']]
      });

      if (!latest || latest.expires_at < new Date()) {
        return res.status(400).json({ success: false, message: 'Mã xác thực đã hết hạn hoặc không tồn tại.' });
      }

      const crypto = require('crypto');
      const otpHash = crypto.createHmac('sha256', JWT_SECRET).update(otp).digest('hex');
      const expectedHash = `sha256:${otpHash}`;

      if (latest.otp_hash !== expectedHash) {
        latest.attempt_count += 1;
        await latest.save();
        if (latest.attempt_count >= 5) {
          latest.consumed_at = new Date();
          await latest.save();
        }
        return res.status(400).json({ success: false, message: 'Mã xác thực không chính xác.' });
      }

      latest.consumed_at = new Date();
      await latest.save();

      // Log the existing user in!
      const token = await signAuthToken(existingUser, req, 'email_otp');
      setAuthCookie(res, token);

      return res.json({
        success: true,
        message: 'Xác thực thành công và đã đăng nhập!',
        token,
        user: publicUser(existingUser)
      });
    } else {
      // Verify registration OTP using PendingRegistration
      const pending = await PendingRegistration.findOne({
        where: { email, consumed_at: null },
        order: [['created_at', 'DESC']]
      });

      if (!pending || pending.expires_at < new Date()) {
        return res.status(400).json({ success: false, message: 'Mã xác thực đã hết hạn hoặc không tồn tại.' });
      }

      const crypto = require('crypto');
      const otpHash = crypto.createHmac('sha256', JWT_SECRET).update(otp).digest('hex');
      const expectedHash = `sha256:${otpHash}`;

      if (pending.otp_hash !== expectedHash) {
        pending.attempt_count += 1;
        await pending.save();
        if (pending.attempt_count >= 5) {
          pending.consumed_at = new Date();
          await pending.save();
        }
        return res.status(400).json({ success: false, message: 'Mã xác thực không chính xác.' });
      }

      pending.consumed_at = new Date();
      await pending.save();

      // Create new user since OTP is correct!
      const newUserId = createUserId();
      const user = await User.create({
        id: newUserId,
        role: 'traveler',
        username: pending.username,
        password_hash: pending.password_hash,
        email: pending.email,
        fullname: fullname,
        phone: phone,
        gender: 'Khác',
        address: '',
        job: '',
        is_verified: true
      });

      const token = await signAuthToken(user, req, 'email_otp');
      setAuthCookie(res, token);

      return res.json({
        success: true,
        message: 'Đăng ký tài khoản mới thành công và đã đăng nhập!',
        token,
        user: publicUser(user)
      });
    }
  } catch (error) {
    next(error);
  }
};
