const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const handlers = new Map();
  const router = {};
  for (const method of ['get', 'put', 'post']) router[method] = (paths, ...chain) => {
    for (const path of Array.isArray(paths) ? paths : [paths]) handlers.set(method + path, chain);
  };
  const account = { _id: 'owner', username: 'Owner', email: 'owner@example.com', roles: ['traveler'], status: 'active', profile: { fullname: 'Owner' }, verified: true, save: async () => {} };
  const User = { findById: async id => { assert.equal(id, 'owner'); return account; } };
  vm.runInNewContext(fs.readFileSync('server_mongodb/routes/auth.routes.js', 'utf8'), {
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === '../models') return { User };
      if (name === 'jsonwebtoken') return { verify: token => { if (token !== 'valid') throw Error('invalid'); return { id: 'owner' }; } };
      if (name === 'bcrypt') return {};
      if (name.startsWith('../utils/')) return {};
      return require(name);
    }, module: { exports: {} }, process, console
  });
  async function request(method, path, body = {}, token) {
    let status = 200, data;
    const req = { body, headers: token ? { authorization: 'Bearer ' + token } : {}, params: { userId: 'victim' } };
    const res = { status(code) { status = code; return this; }, json(value) { data = value; return this; } };
    const chain = handlers.get(method + path);
    for (const handler of chain) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) break;
    }
    return { status, data };
  }
  return { request, account };
}
test('profile requires a valid session and never trusts supplied user id or role', async () => {
  const { request, account } = setup();
  assert.equal((await request('get', '/profile/:userId')).status, 401);
  assert.equal((await request('get', '/profile/:userId', {}, 'invalid')).status, 401);
  const result = await request('put', '/profile/:userId', { id: 'victim', fullname: 'Updated', role: 'admin', password_hash: 'injected' }, 'valid');
  assert.equal(result.status, 200);
  assert.equal(result.data.user.id, 'owner');
  assert.equal(result.data.user.fullname, 'Updated');
  assert.equal(result.data.user.role, 'traveler');
  assert.equal(result.data.user.password_hash, undefined);
  account.status = 'banned';
  assert.equal((await request('get', '/profile', {}, 'valid')).status, 403);
});
test('register rejects malformed input before querying database', async () => {
  const { request } = setup();
  for (const body of [{}, { username: {}, email: [], password: {} }, { username: 'ab', email: 'not-email', password: 'Strong123!' }]) {
    assert.equal((await request('post', '/register', body)).status, 400);
  }
});
