const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { AuthOtp, PendingRegistration, User } = require('../models/index');
const { JWT_SECRET } = require('../middlewares/auth.middleware');
const { assertMailDomainCanReceive, sendOtpEmail } = require('./email.service');

const OTP_TTL_MINUTES = 5;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const RESET_TOKEN_MINUTES = 10;

function generateOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function futureDate(ms) {
  return new Date(Date.now() + ms);
}

function hashOtp(otp) {
  const hash = crypto.createHmac('sha256', JWT_SECRET).update(otp).digest('hex');
  return `sha256:${hash}`;
}

function hashResetJti(jti) {
  const hash = crypto.createHmac('sha256', JWT_SECRET).update(`reset:${jti}`).digest('hex');
  return `sha256:${hash}`;
}

async function compareOtp(otp, storedHash) {
  if (String(storedHash || '').startsWith('sha256:')) {
    const expected = Buffer.from(hashOtp(otp));
    const actual = Buffer.from(storedHash);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  return bcrypt.compare(otp, storedHash);
}

async function compareResetJti(jti, storedHash) {
  if (String(storedHash || '').startsWith('sha256:')) {
    const expected = Buffer.from(hashResetJti(jti));
    const actual = Buffer.from(storedHash);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  return bcrypt.compare(jti, storedHash);
}

async function sendOtpEmailInBackground({ to, otp, purpose }) {
  // Always print the OTP to server console logs for easier debugging and demo tracking
  console.log(`\n==================================================`);
  console.log(`[OTP LOG] Mã xác thực gửi tới: ${to}`);
  console.log(`Mục đích: ${purpose}`);
  console.log(`MÃ OTP: ${otp}`);
  console.log(`==================================================\n`);

  await sendOtpEmail({ to, otp, purpose }).catch((error) => {
    console.error('OTP email delivery failed:', {
      to,
      purpose,
      code: error.code,
      message: error.message
    });
  });
}

async function consumeActiveOtps(userId, purpose, transaction) {
  await AuthOtp.update(
    { consumed_at: new Date() },
    {
      where: {
        user_id: userId,
        purpose,
        consumed_at: null
      },
      transaction
    }
  );
}

async function consumeActivePendingRegistration(email, username, transaction) {
  await PendingRegistration.update(
    { consumed_at: new Date() },
    {
      where: {
        [Op.or]: [{ email }, { username }],
        consumed_at: null
      },
      transaction
    }
  );
}

function createResendTooSoonError(resendAvailableAt) {
  const retryAfterSeconds = Math.ceil((resendAvailableAt.getTime() - Date.now()) / 1000);
  const error = new Error('Vui lòng chờ trước khi gửi lại mã xác thực.');
  error.statusCode = 429;
  error.code = 'OTP_RESEND_TOO_SOON';
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

async function createAndSendOtp(user, purpose, transaction) {
  await assertMailDomainCanReceive(user.email);

  const latest = await AuthOtp.findOne({
    where: {
      user_id: user.id,
      purpose,
      consumed_at: null
    },
    order: [['created_at', 'DESC']],
    transaction
  });

  if (latest && latest.resend_available_at && latest.resend_available_at > new Date()) {
    const retryAfterSeconds = Math.ceil((latest.resend_available_at.getTime() - Date.now()) / 1000);
    const error = new Error('Vui lòng chờ trước khi gửi lại mã xác thực.');
    error.statusCode = 429;
    error.code = 'OTP_RESEND_TOO_SOON';
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  }

  await consumeActiveOtps(user.id, purpose, transaction);

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  await AuthOtp.create({
    user_id: user.id,
    purpose,
    otp_hash: otpHash,
    expires_at: futureDate(OTP_TTL_MINUTES * 60 * 1000),
    resend_available_at: futureDate(RESEND_SECONDS * 1000)
  }, { transaction });

  sendOtpEmailInBackground({ to: user.email, otp, purpose });
  return { queued: true };
}

async function createAndSendPendingRegistrationOtp({ username, email, passwordHash }, transaction) {
  await assertMailDomainCanReceive(email);

  const latest = await PendingRegistration.findOne({
    where: {
      [Op.or]: [{ email }, { username }],
      consumed_at: null
    },
    order: [['created_at', 'DESC']],
    transaction
  });

  if (latest && latest.resend_available_at && latest.resend_available_at > new Date()) {
    throw createResendTooSoonError(latest.resend_available_at);
  }

  await consumeActivePendingRegistration(email, username, transaction);

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  await PendingRegistration.create({
    username,
    email,
    password_hash: passwordHash,
    otp_hash: otpHash,
    expires_at: futureDate(OTP_TTL_MINUTES * 60 * 1000),
    resend_available_at: futureDate(RESEND_SECONDS * 1000)
  }, { transaction });

  sendOtpEmailInBackground({ to: email, otp, purpose: 'REGISTER' });
  return { queued: true };
}

async function resendPendingRegistrationOtp(email) {
  const pending = await PendingRegistration.findOne({
    where: {
      email,
      consumed_at: null,
      expires_at: { [Op.gt]: new Date() }
    },
    order: [['created_at', 'DESC']]
  });

  if (!pending) {
    const error = new Error('Không tìm thấy đăng ký đang chờ xác thực.');
    error.statusCode = 404;
    error.code = 'PENDING_REGISTRATION_NOT_FOUND';
    throw error;
  }

  return createAndSendPendingRegistrationOtp({
    username: pending.username,
    email: pending.email,
    passwordHash: pending.password_hash
  });
}

async function verifyPendingRegistrationOtp({ email, otp }) {
  const pending = await PendingRegistration.findOne({
    where: {
      email,
      consumed_at: null,
      expires_at: { [Op.gt]: new Date() }
    },
    order: [['created_at', 'DESC']]
  });

  if (!pending) {
    const error = new Error('Mã xác thực không hợp lệ hoặc đã hết hạn.');
    error.statusCode = 400;
    error.code = 'OTP_INVALID';
    throw error;
  }

  if (pending.attempt_count >= MAX_ATTEMPTS) {
    pending.consumed_at = new Date();
    await pending.save();
    const error = new Error('Mã xác thực đã bị khóa do nhập sai quá nhiều lần.');
    error.statusCode = 400;
    error.code = 'OTP_MAX_ATTEMPTS';
    throw error;
  }

  const isMatch = await compareOtp(otp, pending.otp_hash);
  if (!isMatch) {
    pending.attempt_count += 1;
    if (pending.attempt_count >= MAX_ATTEMPTS) {
      pending.consumed_at = new Date();
    }
    await pending.save();
    const error = new Error('Mã xác thực không đúng.');
    error.statusCode = 400;
    error.code = 'OTP_MISMATCH';
    throw error;
  }

  return pending;
}

async function verifyOtp({ email, otp, purpose }) {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const error = new Error('Mã xác thực không hợp lệ hoặc đã hết hạn.');
    error.statusCode = 400;
    error.code = 'OTP_INVALID';
    throw error;
  }

  const otpRecord = await AuthOtp.findOne({
    where: {
      user_id: user.id,
      purpose,
      consumed_at: null,
      expires_at: { [Op.gt]: new Date() }
    },
    order: [['created_at', 'DESC']]
  });

  if (!otpRecord) {
    const error = new Error('Mã xác thực không hợp lệ hoặc đã hết hạn.');
    error.statusCode = 400;
    error.code = 'OTP_INVALID';
    throw error;
  }

  if (otpRecord.attempt_count >= MAX_ATTEMPTS) {
    otpRecord.consumed_at = new Date();
    await otpRecord.save();
    const error = new Error('Mã xác thực đã bị khóa do nhập sai quá nhiều lần.');
    error.statusCode = 400;
    error.code = 'OTP_MAX_ATTEMPTS';
    throw error;
  }

  const isMatch = await compareOtp(otp, otpRecord.otp_hash);
  if (!isMatch) {
    otpRecord.attempt_count += 1;
    if (otpRecord.attempt_count >= MAX_ATTEMPTS) {
      otpRecord.consumed_at = new Date();
    }
    await otpRecord.save();
    const error = new Error('Mã xác thực không đúng.');
    error.statusCode = 400;
    error.code = 'OTP_MISMATCH';
    throw error;
  }

  return { user, otpRecord };
}

async function createResetToken(user, otpRecord) {
  const resetJti = crypto.randomUUID();
  const resetToken = jwt.sign(
    { id: user.id, email: user.email, purpose: 'RESET_PASSWORD', jti: resetJti },
    JWT_SECRET,
    { expiresIn: `${RESET_TOKEN_MINUTES}m` }
  );

  otpRecord.reset_token_hash = hashResetJti(resetJti);
  otpRecord.reset_token_expires_at = futureDate(RESET_TOKEN_MINUTES * 60 * 1000);
  await otpRecord.save();

  return resetToken;
}

async function consumeResetToken(resetToken) {
  let decoded;
  try {
    decoded = jwt.verify(resetToken, JWT_SECRET);
  } catch (error) {
    const err = new Error('Reset token không hợp lệ hoặc đã hết hạn.');
    err.statusCode = 400;
    err.code = 'RESET_TOKEN_INVALID';
    throw err;
  }

  if (decoded.purpose !== 'RESET_PASSWORD' || !decoded.jti) {
    const error = new Error('Reset token không hợp lệ.');
    error.statusCode = 400;
    error.code = 'RESET_TOKEN_INVALID';
    throw error;
  }

  const otpRecord = await AuthOtp.findOne({
    where: {
      user_id: decoded.id,
      purpose: 'RESET_PASSWORD',
      reset_token_hash: { [Op.ne]: null },
      reset_token_consumed_at: null,
      reset_token_expires_at: { [Op.gt]: new Date() }
    },
    order: [['updated_at', 'DESC']]
  });

  if (!otpRecord || !(await compareResetJti(decoded.jti, otpRecord.reset_token_hash))) {
    const error = new Error('Reset token không hợp lệ hoặc đã được sử dụng.');
    error.statusCode = 400;
    error.code = 'RESET_TOKEN_INVALID';
    throw error;
  }

  const user = await User.findByPk(decoded.id);
  if (!user) {
    const error = new Error('Tài khoản không tồn tại.');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  otpRecord.reset_token_consumed_at = new Date();
  otpRecord.consumed_at = otpRecord.consumed_at || new Date();
  await otpRecord.save();

  return user;
}

module.exports = {
  createAndSendOtp,
  createAndSendPendingRegistrationOtp,
  resendPendingRegistrationOtp,
  verifyPendingRegistrationOtp,
  verifyOtp,
  createResetToken,
  consumeResetToken
};
