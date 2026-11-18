const authSessionService = require('../services/auth-session.service');
const securityAuditService = require('../services/security-audit.service');
const accountSecurityService = require('../services/account-security.service');
const passkeyService = require('../services/passkey.service');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { PASSWORD_MESSAGE, isValidPassword } = require('../utils/auth.validation');

function hashEmailCode(code) { return crypto.createHash('sha256').update(String(code)).digest('hex'); }
function matchesEmailCode(code, hash) {
  const supplied = Buffer.from(hashEmailCode(code), 'hex');
  const expected = Buffer.from(String(hash || ''), 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

async function verifyStepUp(req, { currentPassword } = {}) {
  const { User } = require('../models');
  const user = await User.findByPk(req.user.id);
  if (!user) return false;
  if (Array.isArray(user.auth_methods) && user.auth_methods.includes('password')) {
    const bcrypt = require('bcrypt');
    return bcrypt.compare(String(currentPassword || ''), user.password_hash);
  }
  const createdAt = req.authSession?.created_at || req.authSession?.createdAt;
  return Boolean(createdAt && Date.now() - new Date(createdAt).getTime() <= 5 * 60 * 1000);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  };
}

exports.getOverview = async (req, res, next) => {
  try {
    const overview = await accountSecurityService.getSecurityOverview({ userId: req.user.id, currentSessionId: req.authSession?.id });
    return res.json({ success: true, overview });
  } catch (error) { return next(error); }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const enabled = await accountSecurityService.updateSecurityEmailPreference({ userId: req.user.id, enabled: req.body?.securityEmailNotifications });
    await securityAuditService.recordSecurityEvent({
      userId: req.user.id,
      sessionId: req.authSession?.id,
      type: 'security_email_preference_updated',
      result: 'success',
      request: req,
      metadata: { enabled }
    }).catch(() => {});
    return res.json({ success: true, securityEmailNotifications: enabled });
  } catch (error) { return next(error); }
};

exports.listSessions = async (req, res, next) => {
  try {
    const sessions = await authSessionService.listUserSessions({ userId: req.user.id, currentSessionId: req.authSession?.id });
    return res.json({ success: true, sessions });
  } catch (error) { return next(error); }
};

exports.revokeSession = async (req, res, next) => {
  try {
    const sessionId = String(req.params.sessionId || '');
    const revoked = await authSessionService.revokeSession({ sessionId, userId: req.user.id, reason: 'user_revoked_session' });
    if (!revoked) return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND' });
    await securityAuditService.recordSecurityEvent({ userId: req.user.id, sessionId, type: 'session_revoked', result: 'success', request: req }).catch(() => {});
    const current = sessionId === req.authSession?.id;
    if (current) res.clearCookie('token', cookieOptions());
    return res.json({ success: true, currentSessionRevoked: current });
  } catch (error) { return next(error); }
};

exports.revokeOtherSessions = async (req, res, next) => {
  try {
    const currentSessionId = req.authSession?.id;
    const revokedCount = await authSessionService.revokeOtherSessions({ userId: req.user.id, currentSessionId });
    if (revokedCount > 0) {
      await securityAuditService.recordSecurityEvent({ userId: req.user.id, sessionId: currentSessionId, type: 'other_sessions_revoked', result: 'success', request: req, metadata: { count: revokedCount } }).catch(() => {});
    }
    return res.json({ success: true, revokedCount });
  } catch (error) { return next(error); }
};

exports.revokeAllSessions = async (req, res, next) => {
  try {
    const revokedCount = await authSessionService.revokeAllSessions({ userId: req.user.id, reason: 'user_revoked_all_sessions' });
    await securityAuditService.recordSecurityEvent({ userId: req.user.id, sessionId: req.authSession?.id, type: 'all_sessions_revoked', result: 'success', request: req, metadata: { count: revokedCount } }).catch(() => {});
    res.clearCookie('token', cookieOptions());
    return res.json({ success: true, revokedCount });
  } catch (error) { return next(error); }
};

exports.listActivity = async (req, res, next) => {
  try {
    const activity = await securityAuditService.listSecurityEvents({ userId: req.user.id, page: req.query.page, pageSize: req.query.pageSize });
    return res.json({ success: true, ...activity });
  } catch (error) { return next(error); }
};

exports.setPassword = async (req, res, next) => {
  try {
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    if (!isValidPassword(password)) return res.status(400).json({ success: false, code: 'INVALID_PASSWORD', message: PASSWORD_MESSAGE });
    if (password !== confirmPassword) return res.status(400).json({ success: false, code: 'PASSWORD_CONFIRMATION_MISMATCH', message: 'Mật khẩu xác nhận không khớp.' });
    const user = await require('../models').User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    const methods = Array.isArray(user.auth_methods) ? user.auth_methods : [];
    if (methods.includes('password')) return res.status(409).json({ success: false, code: 'PASSWORD_ALREADY_SET', message: 'Tài khoản đã có mật khẩu. Hãy dùng chức năng đổi mật khẩu.' });
    if (!(await verifyStepUp(req))) return res.status(401).json({ success: false, code: 'STEP_UP_REQUIRED', message: 'Hãy đăng nhập lại để thiết lập mật khẩu.' });

    user.password_hash = await bcrypt.hash(password, 10);
    user.auth_methods = [...new Set([...methods, 'password'])];
    user.password_changed_at = new Date();
    user.password_policy_checked_at = new Date();
    await user.save();
    const revokedCount = await authSessionService.revokeOtherSessions({ userId: user.id, currentSessionId: req.authSession?.id, reason: 'password_setup' });
    await securityAuditService.recordSecurityEvent({ userId: user.id, sessionId: req.authSession?.id, type: 'password_setup', result: 'success', request: req, metadata: { otherSessionsRevoked: revokedCount } }).catch(() => {});
    return res.json({ success: true, message: 'Đã thiết lập mật khẩu.' });
  } catch (error) { return next(error); }
};

exports.requestEmailChange = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const currentPassword = req.body?.currentPassword;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Email mới không hợp lệ.' });
    if (!(await verifyStepUp(req, { currentPassword }))) return res.status(401).json({ success: false, code: 'STEP_UP_REQUIRED', message: 'Vui lòng xác thực lại tài khoản.' });
    const { User, EmailChangeVerification } = require('../models');
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    if (email === String(user.email).toLowerCase()) return res.status(400).json({ success: false, message: 'Email mới phải khác email hiện tại.' });
    if (await User.findOne({ where: { email } })) return res.status(409).json({ success: false, code: 'EMAIL_IN_USE', message: 'Email này đã được sử dụng.' });
    const latest = await EmailChangeVerification.findOne({ where: { user_id: user.id, consumed_at: null }, order: [['created_at', 'DESC']] });
    if (latest?.resend_available_at && new Date(latest.resend_available_at) > new Date()) return res.status(429).json({ success: false, code: 'EMAIL_CHANGE_RATE_LIMIT', message: 'Vui lòng chờ trước khi gửi mã khác.' });
    await EmailChangeVerification.update({ consumed_at: new Date() }, { where: { user_id: user.id, consumed_at: null } });
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const verification = await EmailChangeVerification.create({ user_id: user.id, pending_email: email, code_hash: hashEmailCode(code), expires_at: new Date(Date.now() + 10 * 60 * 1000), resend_available_at: new Date(Date.now() + 60 * 1000), attempt_count: 0 });
    try { await require('../services/email.service').sendEmailChangeVerification({ to: email, code }); }
    catch (error) { verification.consumed_at = new Date(); await verification.save(); return res.status(502).json({ success: false, message: 'Không gửi được email xác minh. Vui lòng thử lại.' }); }
    return res.json({ success: true, message: 'Mã xác minh đã được gửi đến email mới.' });
  } catch (error) { return next(error); }
};

exports.confirmEmailChange = async (req, res, next) => {
  try {
    const code = String(req.body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Mã xác minh phải gồm 6 chữ số.' });
    const { User, EmailChangeVerification } = require('../models');
    const pending = await EmailChangeVerification.findOne({ where: { user_id: req.user.id, consumed_at: null, expires_at: { [require('../db/mongo-store').Op.gt]: new Date() } }, order: [['created_at', 'DESC']] });
    if (!pending) return res.status(400).json({ success: false, code: 'EMAIL_CHANGE_CODE_INVALID', message: 'Mã không hợp lệ hoặc đã hết hạn.' });
    if (pending.attempt_count >= 5) { pending.consumed_at = new Date(); await pending.save(); return res.status(429).json({ success: false, message: 'Đã vượt quá số lần thử.' }); }
    if (!matchesEmailCode(code, pending.code_hash)) { pending.attempt_count += 1; await pending.save(); return res.status(400).json({ success: false, code: 'EMAIL_CHANGE_CODE_INVALID', message: 'Mã xác minh không chính xác.' }); }
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    if (await User.findOne({ where: { email: pending.pending_email } })) return res.status(409).json({ success: false, code: 'EMAIL_IN_USE', message: 'Email này vừa được tài khoản khác sử dụng.' });
    user.email = pending.pending_email;
    user.is_verified = true;
    await user.save();
    pending.consumed_at = new Date();
    await pending.save();
    await securityAuditService.recordSecurityEvent({ userId: user.id, sessionId: req.authSession?.id, type: 'email_changed', result: 'success', request: req }).catch(() => {});
    return res.json({ success: true, email: user.email, message: 'Email đã được cập nhật và xác minh.' });
  } catch (error) { return next(error); }
};

exports.beginPasskeyRegistration = async (req, res, next) => {
  try {
    if (!(await verifyStepUp(req, { currentPassword: req.body?.currentPassword }))) {
      return res.status(401).json({ success: false, code: 'STEP_UP_REQUIRED', message: 'Mật khẩu hiện tại không hợp lệ. Hãy đăng nhập lại nếu đây là tài khoản OAuth.' });
    }
    const user = await require('../models').User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    const setup = await passkeyService.beginRegistration(user);
    return res.json({ success: true, ...setup });
  } catch (error) { return next(error); }
};

exports.finishPasskeyRegistration = async (req, res, next) => {
  try {
    const result = await passkeyService.finishRegistration({ userId: req.user.id, challengeId: req.body?.challengeId, response: req.body?.response, name: req.body?.name });
    if (!result.ok) return res.status(400).json({ success: false, code: result.reason, message: 'Không thể xác minh passkey. Hãy thử lại.' });
    await securityAuditService.recordSecurityEvent({ userId: req.user.id, sessionId: req.authSession?.id, type: 'passkey_registered', result: 'success', request: req }).catch(() => {});
    return res.json({ success: true, passkey: { id: result.passkey.id, name: result.passkey.name } });
  } catch (error) { return next(error); }
};

exports.deletePasskey = async (req, res, next) => {
  try {
    if (!(await verifyStepUp(req, { currentPassword: req.body?.currentPassword }))) {
      return res.status(401).json({ success: false, code: 'STEP_UP_REQUIRED', message: 'Mật khẩu hiện tại không hợp lệ. Hãy đăng nhập lại nếu đây là tài khoản OAuth.' });
    }
    const deleted = await passkeyService.deletePasskey({ userId: req.user.id, passkeyId: req.params.passkeyId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Không tìm thấy passkey.' });
    await securityAuditService.recordSecurityEvent({ userId: req.user.id, sessionId: req.authSession?.id, type: 'passkey_removed', result: 'success', request: req }).catch(() => {});
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.renamePasskey = async (req, res, next) => {
  try {
    const renamed = await passkeyService.renamePasskey({ userId: req.user.id, passkeyId: req.params.passkeyId, name: req.body?.name });
    if (!renamed) return res.status(404).json({ success: false, message: 'Không tìm thấy passkey.' });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};
