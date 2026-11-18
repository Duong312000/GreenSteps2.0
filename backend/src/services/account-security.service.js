const { User } = require('../models');
const authSessionService = require('./auth-session.service');
const passkeyService = require('./passkey.service');

const WEIGHTS = Object.freeze({
  primaryAuthentication: 20,
  emailVerified: 20,
  localPasswordPolicy: 15,
  passkey: 10,
  recoveryEmail: 10
});

function scoreMeasures(measures) {
  let possible = 0;
  let earned = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const measure = measures[key];
    if (!measure.applicable) continue;
    possible += weight;
    if (measure.enabled) earned += weight;
  }
  return possible ? Math.round(earned / possible * 100) : 0;
}

async function getSecurityOverview({ userId, currentSessionId }) {
  const user = await User.findByPk(userId, { attributes: [
    'id', 'email', 'is_verified', 'account_status', 'auth_methods', 'password_policy_checked_at',
    'password_changed_at', 'security_email_notifications',
    'recovery_phone_verified_at', 'phone', 'last_login_at'
  ] });
  if (!user) {
    const error = new Error('Account not found.');
    error.statusCode = 404;
    throw error;
  }

  const methods = Array.isArray(user.auth_methods) ? user.auth_methods : [];
  const hasLocalPassword = methods.includes('password');
  const emailVerified = Boolean(user.email && user.is_verified);
  const passkeys = await passkeyService.listPasskeys(userId);
  const passkeyCount = passkeys.length;
  const sessions = await authSessionService.listUserSessions({ userId, currentSessionId });
  const measures = {
    primaryAuthentication: {
      applicable: true,
      enabled: Boolean(currentSessionId),
      provider: methods.length ? methods.join(', ') : 'unknown',
      status: currentSessionId ? 'configured' : 'unknown'
    },
    emailVerified: { applicable: true, enabled: emailVerified, status: emailVerified ? 'verified' : 'not_verified' },
    localPassword: {
      applicable: hasLocalPassword,
      configured: hasLocalPassword,
      enabled: Boolean(hasLocalPassword && user.password_policy_checked_at),
      strength: 'unknown',
      policyCheckedAt: user.password_policy_checked_at || null,
      lastChangedAt: user.password_changed_at || null,
      status: !hasLocalPassword ? 'not_applicable' : user.password_policy_checked_at ? 'policy_checked' : 'unknown'
    },
    passkeys: { applicable: true, enabled: passkeyCount > 0, count: passkeyCount, status: 'not_configured' },
    recoveryEmail: { applicable: true, enabled: emailVerified, verified: emailVerified, address: user.email || null, status: emailVerified ? 'verified' : 'not_verified' },
    recoveryPhone: { applicable: true, enabled: Boolean(user.recovery_phone_verified_at), verified: Boolean(user.recovery_phone_verified_at), status: user.recovery_phone_verified_at ? 'verified' : user.phone ? 'not_verified' : 'not_configured' },
    securityEmailNotifications: { enabled: user.security_email_notifications === true }
  };

  const score = scoreMeasures({
    primaryAuthentication: { applicable: measures.primaryAuthentication.applicable, enabled: measures.primaryAuthentication.enabled },
    emailVerified: { applicable: measures.emailVerified.applicable, enabled: measures.emailVerified.enabled },
    localPasswordPolicy: { applicable: measures.localPassword.applicable, enabled: measures.localPassword.enabled },
    passkey: { applicable: measures.passkeys.applicable, enabled: measures.passkeys.enabled },
    recoveryEmail: { applicable: measures.recoveryEmail.applicable, enabled: measures.recoveryEmail.enabled }
  });
  const recommendations = [];
  if (!emailVerified) recommendations.push({ id: 'verify_email', title: 'Xác minh email', action: 'verify_email' });
  if (hasLocalPassword && !measures.localPassword.enabled) recommendations.push({ id: 'review_password', title: 'Cập nhật mật khẩu theo chính sách hiện tại', action: 'change_password' });
  if (!passkeyCount) recommendations.push({ id: 'add_passkey', title: 'Chưa có Passkey', action: 'setup_passkey' });
  if (measures.recoveryPhone.status === 'not_configured') recommendations.push({ id: 'recovery_phone', title: 'Chưa thiết lập số khôi phục', action: 'recovery_phone' });

  return {
    score,
    scoreLabel: score >= 80 ? 'Tốt' : score >= 60 ? 'Trung bình' : 'Cần cải thiện',
    scoreWeights: WEIGHTS,
    measures,
    recommendations,
    sessions,
    passkeys,
    recentLoginAt: user.last_login_at || null
  };
}

async function updateSecurityEmailPreference({ userId, enabled }) {
  if (typeof enabled !== 'boolean') {
    const error = new Error('enabled must be a boolean.');
    error.statusCode = 400;
    throw error;
  }
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('Account not found.');
    error.statusCode = 404;
    throw error;
  }
  user.security_email_notifications = enabled;
  await user.save();
  return enabled;
}

module.exports = { WEIGHTS, scoreMeasures, getSecurityOverview, updateSecurityEmailPreference };
