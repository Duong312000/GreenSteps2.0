const { test } = require('node:test');
const assert = require('node:assert/strict');
for (const file of ['../backend/src/services/google-auth.service', '../server_mongodb/utils/google-auth']) {
  test(file + ' rejects forged identity and validates Google claims', async () => {
    const { verifyGoogleAccessToken: verify } = require(file);
    const originalFetch = global.fetch;
    const originalId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    let info = { aud: 'test-client', expires_in: 3600, sub: 'google-sub' };
    let profile = { sub: 'google-sub', email: 'test@gmail.com', email_verified: true, name: 'Tester' };
    global.fetch = async url => ({ ok: true, json: async () => url.includes('tokeninfo') ? info : profile });
    try {
      await assert.rejects(verify(undefined), { statusCode: 400 });
      assert.equal((await verify('valid-token')).email, 'test@gmail.com');
      info.aud = 'another-client';
      await assert.rejects(verify('token'), { statusCode: 401 });
      info.aud = 'test-client'; info.expires_in = 0;
      await assert.rejects(verify('token'), { statusCode: 401 });
      info.expires_in = 3600; profile.sub = 'different';
      await assert.rejects(verify('token'), { statusCode: 401 });
      profile.sub = 'google-sub'; profile.email_verified = false;
      await assert.rejects(verify('token'), { statusCode: 401 });
      profile.email_verified = true; profile.email = 'test@example.com';
      await assert.rejects(verify('token'), { statusCode: 401 });
      profile.hd = 'example.com';
      assert.equal((await verify('token')).email, 'test@example.com');
      global.fetch = async () => { throw new Error('offline'); };
      await assert.rejects(verify('token'), { statusCode: 503 });
      delete process.env.GOOGLE_CLIENT_ID;
      await assert.rejects(verify('token'), { statusCode: 503 });
    } finally {
      global.fetch = originalFetch;
      if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = originalId;
    }
  });
}
