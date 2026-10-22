const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('Facebook reuses email account, preserves role and blocks conflicting or banned accounts', async () => {
  for (const scenario of ['existing', 'linked', 'conflict', 'banned']) {
    const handlers = {};
    const user = { _id: 'existing-id', username: 'existing', email: 'test@example.com', roles: ['admin'], status: scenario === 'banned' ? 'banned' : 'active', profile: { fullname: 'Original name' }, facebook_id: scenario === 'conflict' ? 'other-facebook' : scenario === 'linked' ? 'facebook-id' : undefined };
    let links = 0;
    const User = {
      findOne: async query => query.facebook_id ? scenario === 'linked' ? user : null : user,
      findOneAndUpdate: async (query, change) => { links++; assert.equal(change.$set.facebook_id, 'facebook-id'); return { ...user, facebook_id: 'facebook-id' }; },
      create: async () => { throw new Error('Must not create duplicate account'); }
    };
    const router = { get() {}, put() {}, post(path, handler) { if (typeof path === 'string') handlers[path] = handler; } };
    const context = {
      require(name) {
        if (name === 'express') return { Router: () => router };
        if (name === '../models') return { User };
        if (name === '../utils/facebook-auth') return { facebookConfig() {}, verifyFacebookAccessToken: async () => ({ facebookId: 'facebook-id', email: user.email }) };
        if (name === '../utils/google-auth') return {};
        if (name === '../utils/password.validation') return {};
        if (name === 'jsonwebtoken') return { sign: () => 'app-jwt' };
        if (name === 'bcrypt') return {};
        return require(name);
      }, module: { exports: {} }, process, console
    };
    vm.runInNewContext(fs.readFileSync('server_mongodb/routes/auth.routes.js', 'utf8'), context);
    let status = 200, body;
    const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; }, cookie() {} };
    await handlers['/facebook-login']({ body: { accessToken: 'verified-token' }, session: {} }, res);
    if (scenario === 'conflict') assert.equal(status, 409);
    else if (scenario === 'banned') assert.equal(status, 403);
    else { assert.equal(body.success, true); assert.equal(body.user.id, 'existing-id'); assert.equal(body.user.role, 'admin'); assert.equal(body.user.fullname, 'Original name'); }
    assert.equal(links, scenario === 'existing' ? 1 : 0);
  }
});
