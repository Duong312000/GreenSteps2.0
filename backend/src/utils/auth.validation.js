const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
const PASSWORD_MESSAGE = 'Mật khẩu phải có ít nhất 6 ký tự, bao gồm ít nhất một chữ cái và một chữ số, không chứa khoảng trắng hoặc ký tự đặc biệt.';

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
  return PASSWORD_REGEX.test(String(password || ''));
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
