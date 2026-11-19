const crypto = require('node:crypto');
const { SePayPgClient } = require('sepay-pg-node');

const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 50000000;

function getReadiness(env = process.env) {
  const required = ['SEPAY_MERCHANT_ID', 'SEPAY_MERCHANT_SECRET', 'SEPAY_IPN_SECRET'];
  const missing = required.filter(name => !String(env[name] || '').trim());
  const paymentEnv = String(env.SEPAY_ENV || 'sandbox').trim().toLowerCase();
  if (!['sandbox', 'production'].includes(paymentEnv)) missing.push('SEPAY_ENV');
  return { configured: missing.length === 0, environment: paymentEnv, missing: [...new Set(missing)] };
}

function isValidAmount(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) >= MIN_AMOUNT && Number(value) <= MAX_AMOUNT;
}

function createGuestCapability() {
  const raw = crypto.randomBytes(32).toString('base64url');
  return { raw, hash: crypto.createHash('sha256').update(raw).digest('hex') };
}

function matchesGuestCapability(raw, hash) {
  if (typeof raw !== 'string' || typeof hash !== 'string' || !/^[a-f\d]{64}$/i.test(hash)) return false;
  const actual = crypto.createHash('sha256').update(raw).digest();
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function safeSecretEqual(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function amountToMinorUnits(value) {
  const match = String(value ?? '').trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}

async function retrieveOrder(invoice, env = process.env) {
  const readiness = getReadiness(env);
  if (!readiness.configured) throw Object.assign(new Error('SePay is not configured.'), { statusCode: 503, missing: readiness.missing });
  const client = new SePayPgClient({
    env: readiness.environment,
    merchant_id: env.SEPAY_MERCHANT_ID.trim(),
    secret_key: env.SEPAY_MERCHANT_SECRET.trim()
  });
  const response = await client.order.retrieve(String(invoice));
  return response?.data?.data || response?.data || null;
}

function createCheckout({ bookingId, invoice, amount, description, customerId, env = process.env }) {
  const readiness = getReadiness(env);
  if (!readiness.configured) throw Object.assign(new Error('SePay sandbox chưa được cấu hình đầy đủ.'), { statusCode: 503, missing: readiness.missing });
  if (!isValidAmount(amount)) throw Object.assign(new Error('Số tiền thanh toán không hợp lệ.'), { statusCode: 400 });
  if (typeof bookingId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(bookingId)) {
    throw Object.assign(new Error('Mã đặt chỗ không hợp lệ.'), { statusCode: 400 });
  }

  const clientUrl = String(env.CLIENT_URL || 'http://localhost:4200').replace(/\/$/, '');
  let clientOrigin;
  try {
    const parsed = new URL(clientUrl);
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error();
    clientOrigin = parsed.origin;
  } catch {
    throw Object.assign(new Error('CLIENT_URL phải là HTTPS (hoặc localhost khi phát triển).'), { statusCode: 503 });
  }

  const client = new SePayPgClient({
    env: readiness.environment,
    merchant_id: env.SEPAY_MERCHANT_ID.trim(),
    secret_key: env.SEPAY_MERCHANT_SECRET.trim()
  });
  const base = `${clientOrigin}/booking/confirm?bookingId=${encodeURIComponent(bookingId)}`;
  const checkoutFields = client.checkout.initOneTimePaymentFields({
    operation: 'PURCHASE',
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: invoice || bookingId,
    order_amount: Number(amount),
    currency: 'VND',
    order_description: String(description || `GreenSteps booking ${bookingId}`).replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 200),
    ...(customerId ? { customer_id: String(customerId).slice(0, 100) } : {}),
    success_url: `${base}&sepay=success`,
    error_url: `${base}&sepay=error`,
    cancel_url: `${base}&sepay=cancel`
  });

  return { checkoutUrl: client.checkout.initCheckoutUrl(), fields: checkoutFields };
}

module.exports = {
  MIN_AMOUNT, MAX_AMOUNT, getReadiness, isValidAmount, createGuestCapability,
  matchesGuestCapability, safeSecretEqual, amountToMinorUnits, createCheckout, retrieveOrder
};
