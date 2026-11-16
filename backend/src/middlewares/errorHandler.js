const GENERIC_SERVER_ERROR = 'Có lỗi hệ thống xảy ra, vui lòng thử lại sau.';
const SECRET_ASSIGNMENT = /\b(password|passwd|token|secret|cookie|authorization|api[_-]?key|credential)\b\s*[:=]\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)/gi;
const DATABASE_UNAVAILABLE_MESSAGE = 'Cơ sở dữ liệu đang tạm thời không kết nối được. Vui lòng thử lại sau.';
const DATABASE_NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH']);

function isDatabaseUnavailable(error) {
  for (let current = error; current; current = current.cause) {
    if (/^Mongo(ServerSelection|Network(?:Timeout)?|TopologyClosed|NotConnected)Error$/.test(current.name || '')
      || DATABASE_NETWORK_CODES.has(current.code)) return true;
  }
  return false;
}

function redactSensitiveText(value) {
  return String(value ?? '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(mongodb(?:\+srv)?:\/\/)[^\s@]+@/gi, '$1[REDACTED]@')
    .replace(SECRET_ASSIGNMENT, '$1=[REDACTED]');
}

function errorHandler(err, req, res, next) {
  const databaseUnavailable = isDatabaseUnavailable(err);
  const conflict = err.code === 11000 || err.hasErrorLabel?.('TransientTransactionError');
  const statusCode = databaseUnavailable ? 503 : conflict ? 409 : Number(err.statusCode || err.status) || 500;
  const errorName = databaseUnavailable ? 'DatabaseUnavailable' : err.name || 'InternalServerError';
  const originalMessage = err.message || GENERIC_SERVER_ERROR;
  const isServerError = statusCode >= 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = databaseUnavailable
    ? DATABASE_UNAVAILABLE_MESSAGE
    : isServerError && !isDevelopment
    ? GENERIC_SERVER_ERROR
    : redactSensitiveText(originalMessage);
  const logDetails = databaseUnavailable
    ? `${req.method} ${(req.originalUrl || req.url || '').split('?')[0]}: ${err.name || 'MongoError'} code=${err.code || err.cause?.code || 'n/a'} ${redactSensitiveText(err.message || '')}`
    : redactSensitiveText(err.stack || `${errorName}: ${originalMessage}`);

  console[databaseUnavailable ? 'warn' : 'error'](`${databaseUnavailable ? '[DB] Database unavailable' : '[ERROR HANDLER] Unhandled System Error'}: ${logDetails}`);

  const body = {
    success: false,
    error: errorName,
    code: err.code,
    message
  };
  if (isDevelopment && err.stack && !databaseUnavailable) body.stack = redactSensitiveText(err.stack);
  return res.status(statusCode).json(body);
}

errorHandler.redactSensitiveText = redactSensitiveText;
errorHandler.isDatabaseUnavailable = isDatabaseUnavailable;
module.exports = errorHandler;
