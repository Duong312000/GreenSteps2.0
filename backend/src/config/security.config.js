const LOCAL_FRONTEND_ORIGINS = ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:4201', 'http://127.0.0.1:4201'];
// Keep the deployed frontend available even when the Render environment misses its CORS setting.
const PRODUCTION_FRONTEND_ORIGINS = [
  'https://greensteps-livid.vercel.app',
  'https://greensteps.vercel.app',
  'https://greensteps-backend.vercel.app'
];
const MIN_JWT_SECRET_LENGTH = 30;

function getJwtSecret(env = process.env) {
  const secret = String(env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET is required for authenticated API runtime.');
  if (secret.length < MIN_JWT_SECRET_LENGTH) throw new Error(`JWT_SECRET must contain at least ${MIN_JWT_SECRET_LENGTH} characters.`);
  return secret;
}

function parseAllowedOrigins(env = process.env) {
  const origins = new Set(PRODUCTION_FRONTEND_ORIGINS);
  LOCAL_FRONTEND_ORIGINS.forEach(origin => origins.add(origin));
  const configured = String(env.CORS_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (env.CLIENT_URL?.trim()) configured.push(env.CLIENT_URL.trim());
  for (const candidate of configured) {
    let url;
    try { url = new URL(candidate); }
    catch { throw new Error(`CORS origin must be an origin URL: ${candidate}`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== candidate.replace(/\/$/, '') || url.username || url.password) {
      throw new Error(`CORS origin must be an origin URL without a path or credentials: ${candidate}`);
    }
    origins.add(url.origin);
  }
  return origins;
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (typeof origin !== 'string') return false;
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    // Allow localhost and local loopback on any port for development
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return true;
    // Allow any Vercel deployment of this project
    if (url.hostname.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return false;
}

function createCorsOptions(allowedOrigins) {
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS.');
      error.code = 'CORS_ORIGIN_DENIED';
      error.statusCode = 403;
      return callback(error);
    }
  };
}

module.exports = { getJwtSecret, parseAllowedOrigins, isAllowedOrigin, createCorsOptions, MIN_JWT_SECRET_LENGTH };
