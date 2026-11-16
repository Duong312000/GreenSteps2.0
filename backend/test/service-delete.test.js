const test = require('node:test');
const assert = require('node:assert/strict');
const serviceController = require('../src/controllers/service.controller');
const { GreenService, Vender } = require('../src/models');

test('provider deletion hides a service without removing booking history', async t => {
  const originalServiceFind = GreenService.findByPk;
  const originalVenderFind = Vender.findByPk;
  const service = {
    id: 'service-1',
    vender_id: 'vender-1',
    status: 'active',
    current_data: { address: 'Da Lat' },
    save: async () => {}
  };
  const vender = { user_id: 'provider-1' };
  let response;
  let statusCode = 200;

  t.after(() => {
    GreenService.findByPk = originalServiceFind;
    Vender.findByPk = originalVenderFind;
  });
  GreenService.findByPk = async () => service;
  Vender.findByPk = async () => vender;

  await serviceController.deleteService(
    { params: { id: service.id }, user: { id: 'provider-1', role: 'provider' } },
    {
      status(code) { statusCode = code; return this; },
      json(body) { response = body; }
    },
    error => { throw error; }
  );

  assert.equal(statusCode, 200);
  assert.equal(service.status, 'deleted');
  assert.deepEqual(service.current_data, { address: 'Da Lat', catalogHidden: true });
  assert.deepEqual(response, { success: true, message: 'Đã xóa dịch vụ khỏi danh sách.' });
});

test('provider cannot delete another provider service', async t => {
  const originalServiceFind = GreenService.findByPk;
  const originalVenderFind = Vender.findByPk;
  const service = {
    id: 'service-1',
    vender_id: 'vender-1',
    status: 'active',
    current_data: {},
    save: async () => { throw new Error('must not save'); }
  };
  let statusCode = 200;
  let response;

  t.after(() => {
    GreenService.findByPk = originalServiceFind;
    Vender.findByPk = originalVenderFind;
  });
  GreenService.findByPk = async () => service;
  Vender.findByPk = async () => ({ user_id: 'different-provider' });

  await serviceController.deleteService(
    { params: { id: service.id }, user: { id: 'provider-1', role: 'provider' } },
    {
      status(code) { statusCode = code; return this; },
      json(body) { response = body; }
    },
    error => { throw error; }
  );

  assert.equal(statusCode, 403);
  assert.equal(service.status, 'active');
  assert.equal(response.success, false);
});
