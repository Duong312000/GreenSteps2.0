const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,72}$/;
const PASSWORD_MESSAGE = 'Mật khẩu phải có 8-72 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt; chỉ dùng ký tự Latin không dấu và không có khoảng trắng.';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && PASSWORD_REGEX.test(password);
}

function isValidOtp(otp) {
  return /^\d{6}$/.test(String(otp || ''));
}

module.exports = {
  PASSWORD_REGEX,
  PASSWORD_MESSAGE,
  normalizeEmail,
  normalizeText,
  isValidEmail,
  isValidPassword,
  isValidOtp
};
