const jwt = require('jsonwebtoken');
const { createHash, timingSafeEqual } = require('node:crypto');

const TOKEN_TTL_SECONDS = 120;
const fail = (message, statusCode = 503, code = 'CHAT_NOT_CONFIGURED') =>
  Object.assign(new Error(message), { statusCode, code });

function readChatAccessConfig(env = process.env) {
  const webhookUrl = env.N8N_CHAT_WEBHOOK_URL;
  const secret = env.N8N_CHAT_JWT_SECRET;
  if (!webhookUrl || !secret || secret.length < 32) {
    throw fail('Chat trực tiếp tới n8n chưa được cấu hình.');
  }

  let endpoint;
  try { endpoint = new URL(webhookUrl); }
  catch { throw fail('Webhook n8n chưa được cấu hình hợp lệ.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if ((endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:'))
    || endpoint.username || endpoint.password || endpoint.hash) {
    throw fail('Webhook n8n chưa được cấu hình hợp lệ.');
  }
  return { webhookUrl: endpoint.href, secret };
}

function createChatAccess({ env = process.env, userId } = {}) {
  const { webhookUrl, secret } = readChatAccessConfig(env);
  const payload = {
    scope: 'greensteps:chat',
    ...(typeof userId === 'string' && userId.length <= 128 ? { sub: userId } : {})
  };
  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
    issuer: 'greensteps-backend',
    audience: 'greensteps-n8n-chat',
    noTimestamp: false,
    mutatePayload: false
  });
  return { success: true, webhookUrl, token, expiresIn: TOKEN_TTL_SECONDS };
}

function catalogKeyMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !provided || !expected) return false;
  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

module.exports = { createChatAccess, readChatAccessConfig, catalogKeyMatches, TOKEN_TTL_SECONDS };
