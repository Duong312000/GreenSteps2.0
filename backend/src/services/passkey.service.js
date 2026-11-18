const crypto = require('node:crypto');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { AuthPasskey, AuthWebAuthnChallenge, User } = require('../models');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function relyingParty() {
  const rpName = process.env.WEBAUTHN_RP_NAME || 'GreenSteps Travel';
  const rpID = process.env.WEBAUTHN_RP_ID || (process.env.NODE_ENV === 'production' ? '' : 'localhost');
  const expectedOrigin = process.env.WEBAUTHN_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4200');
  if (!rpID || !expectedOrigin) {
    const error = new Error('WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN must be configured before using passkeys.');
    error.statusCode = 503;
    error.code = 'WEBAUTHN_CONFIG_MISSING';
    throw error;
  }
  return { rpName, rpID, expectedOrigin };
}

async function saveChallenge({ userId = null, purpose, challenge }) {
  const row = await AuthWebAuthnChallenge.create({
    id: crypto.randomUUID(), user_id: userId ? String(userId) : null, purpose, challenge,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS), consumed_at: null
  });
  return row;
}

async function activeChallenge(id, purpose) {
  const row = await AuthWebAuthnChallenge.findByPk(String(id || ''));
  if (!row || row.purpose !== purpose || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

async function beginRegistration(user) {
  const { rpName, rpID } = relyingParty();
  const existing = await AuthPasskey.findAll({ where: { user_id: String(user.id) } });
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(String(user.id), 'utf8'),
    userName: user.email || user.username || String(user.id),
    userDisplayName: user.fullname || user.username || user.email,
    timeout: 60000,
    attestationType: 'none',
    excludeCredentials: existing.map(item => ({ id: item.credential_id, transports: item.transports || [] })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
  });
  const challenge = await saveChallenge({ userId: user.id, purpose: 'registration', challenge: options.challenge });
  return { options, challengeId: challenge.id };
}

async function finishRegistration({ userId, challengeId, response, name }) {
  const challenge = await activeChallenge(challengeId, 'registration');
  if (!challenge || String(challenge.user_id) !== String(userId)) return { ok: false, reason: 'invalid_challenge' };
  const { rpID, expectedOrigin } = relyingParty();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    requireUserVerification: true
  });
  challenge.consumed_at = new Date();
  await challenge.save();
  if (!verification.verified || !verification.registrationInfo) return { ok: false, reason: 'verification_failed' };
  const credential = verification.registrationInfo.credential;
  const exists = await AuthPasskey.findOne({ where: { credential_id: credential.id } });
  if (exists) return { ok: false, reason: 'credential_exists' };
  const passkey = await AuthPasskey.create({
    id: crypto.randomUUID(), user_id: String(userId), credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter,
    transports: response.response?.transports || [], name: String(name || 'Passkey').trim().slice(0, 80) || 'Passkey'
  });
  const user = await User.findByPk(userId);
  if (user) {
    const methods = Array.isArray(user.auth_methods) ? user.auth_methods : [];
    if (!methods.includes('passkey')) { user.auth_methods = [...methods, 'passkey']; await user.save(); }
  }
  return { ok: true, passkey };
}

async function beginAuthentication() {
  const { rpID } = relyingParty();
  const options = await generateAuthenticationOptions({ rpID, timeout: 60000, userVerification: 'required', allowCredentials: [] });
  const challenge = await saveChallenge({ purpose: 'authentication', challenge: options.challenge });
  return { options, challengeId: challenge.id };
}

async function finishAuthentication({ challengeId, response }) {
  const challenge = await activeChallenge(challengeId, 'authentication');
  if (!challenge) return { ok: false, reason: 'invalid_challenge' };
  const passkey = await AuthPasskey.findOne({ where: { credential_id: String(response?.id || response?.rawId || '') } });
  if (!passkey) {
    challenge.consumed_at = new Date();
    await challenge.save();
    return { ok: false, reason: 'credential_not_found' };
  }
  const { rpID, expectedOrigin } = relyingParty();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credential_id,
      publicKey: Buffer.from(passkey.public_key, 'base64url'),
      counter: passkey.counter,
      transports: passkey.transports || []
    },
    requireUserVerification: true
  });
  challenge.consumed_at = new Date();
  await challenge.save();
  if (!verification.verified) return { ok: false, reason: 'verification_failed' };
  passkey.counter = verification.authenticationInfo.newCounter;
  passkey.last_used_at = new Date();
  await passkey.save();
  const user = await User.findByPk(passkey.user_id);
  if (!user || (user.account_status && user.account_status !== 'active')) return { ok: false, reason: 'account_disabled' };
  user.last_login_at = new Date();
  await user.save();
  return { ok: true, user, passkey };
}

async function listPasskeys(userId) {
  const rows = await AuthPasskey.findAll({ where: { user_id: String(userId) } });
  return rows.map(({ id, name, created_at, createdAt, last_used_at }) => ({ id, name, createdAt: created_at || createdAt || null, lastUsedAt: last_used_at || null }));
}

async function deletePasskey({ userId, passkeyId }) {
  const passkey = await AuthPasskey.findByPk(String(passkeyId || ''));
  if (!passkey || String(passkey.user_id) !== String(userId)) return false;
  await AuthPasskey.destroy({ where: { id: passkey.id, user_id: String(userId) } });
  const remaining = await AuthPasskey.findAll({ where: { user_id: String(userId) } });
  if (!remaining.length) {
    const user = await User.findByPk(userId);
    if (user?.auth_methods?.includes('passkey')) { user.auth_methods = user.auth_methods.filter(method => method !== 'passkey'); await user.save(); }
  }
  return true;
}

async function renamePasskey({ userId, passkeyId, name }) {
  const passkey = await AuthPasskey.findByPk(String(passkeyId || ''));
  if (!passkey || String(passkey.user_id) !== String(userId)) return false;
  passkey.name = String(name || '').trim().slice(0, 80) || 'Passkey';
  await passkey.save();
  return true;
}

module.exports = { CHALLENGE_TTL_MS, relyingParty, beginRegistration, finishRegistration, beginAuthentication, finishAuthentication, listPasskeys, deletePasskey, renamePasskey };
