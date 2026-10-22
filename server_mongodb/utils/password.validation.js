const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,72}$/;
const PASSWORD_MESSAGE = 'Mật khẩu phải có 8-72 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt; chỉ dùng ký tự Latin không dấu và không có khoảng trắng.';

function isValidPassword(password) {
  return typeof password === 'string' && PASSWORD_REGEX.test(password);
}

module.exports = { isValidPassword, PASSWORD_MESSAGE };
