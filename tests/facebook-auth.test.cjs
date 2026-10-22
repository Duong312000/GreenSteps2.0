const { test } = require('node:test');
const assert = require('node:assert/strict');
for (const file of ['../backend/src/services/facebook-auth.service', '../server_mongodb/utils/facebook-auth']) {
  test(file + ' verifies app, expiry and Facebook identity', async () => {
    const { verifyFacebookAccessToken: verify, facebookConfig } = require(file);
    const originalFetch = global.fetch;
    const keys = ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'FACEBOOK_GRAPH_VERSION'];
    const saved = keys.map(k => process.env[k]);
    Object.assign(process.env, { FACEBOOK_APP_ID: 'app', FACEBOOK_APP_SECRET: 'secret', FACEBOOK_GRAPH_VERSION: 'v99.0' });
    let data = { is_valid: true, type: 'USER', app_id: 'app', user_id: 'fb-user', expires_at: Date.now()/1000 + 3600 };
    let profile = { id: 'fb-user', email: 'fb@example.com', name: 'Tester' };
    global.fetch = async (url, options) => {
      assert.ok(options.headers.Authorization);
      return { ok: true, json: async () => url.includes('debug_token') ? { data } : profile };
    };
    try {
      assert.equal(facebookConfig().secret, undefined);
      await assert.rejects(verify(undefined), { statusCode: 400 });
      assert.equal((await verify('token')).facebookId, 'fb-user');
      data.app_id = 'other'; await assert.rejects(verify('token'), { statusCode: 401 }); data.app_id = 'app';
      data.is_valid = false; await assert.rejects(verify('token'), { statusCode: 401 }); data.is_valid = true;
      data.expires_at = 1; await assert.rejects(verify('token'), { statusCode: 401 }); data.expires_at = Date.now()/1000 + 3600;
      data.data_access_expires_at = 1; await assert.rejects(verify('token'), { statusCode: 401 }); delete data.data_access_expires_at;
      profile.id = 'other'; await assert.rejects(verify('token'), { statusCode: 401 }); profile.id = 'fb-user';
      delete profile.email; await assert.rejects(verify('token'), { statusCode: 400 });
      global.fetch = async () => { throw new Error('offline'); }; await assert.rejects(verify('token'), { statusCode: 503 });
      delete process.env.FACEBOOK_APP_SECRET; await assert.rejects(verify('token'), { statusCode: 503 });
    } finally {
      global.fetch = originalFetch;
      keys.forEach((k, i) => saved[i] === undefined ? delete process.env[k] : process.env[k] = saved[i]);
    }
  });
}
