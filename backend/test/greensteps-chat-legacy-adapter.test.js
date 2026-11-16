const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLegacyChatAdapter } = require('../src/services/greensteps-chat-legacy-adapter.service');

test('legacy adapter preserves response schema and passes unverified planner context without identity', async () => {
  let captured;
  const sendCatalogChat = async input => {
    captured = input;
    return { success: true, reply: 'Chỉ có hoạt động đã xác minh trong danh mục.', type: 'text' };
  };
  const send = createLegacyChatAdapter({ sendCatalogChat });
  const response = await send({
    message: 'Gợi ý quán cafe ở đây', destination: 'Đà Lạt', userId: 'private-user',
    currentActivities: [{ name: 'Hồ Xuân Hương', time: '09:00', cost: 900000, carbon: 8 }]
  });

  assert.deepEqual(Object.keys(response).sort(), ['action', 'recommendation', 'reply', 'success']);
  assert.equal(response.success, true);
  assert.equal(captured.message.includes('Đà Lạt'), true);
  assert.ok(captured.sessionId.length >= 8);
  assert.equal(captured.userId, undefined);
  assert.deepEqual(captured.plannerState.days[0], [{ name: 'Hồ Xuân Hương', time: '09:00', verified: false }]);
});

test('legacy adapter propagates a catalog-unavailable response instead of fabricating a reply', async () => {
  const send = createLegacyChatAdapter({ sendCatalogChat: async () => { throw Object.assign(new Error('Catalog unavailable'), { code: 'CHAT_CATALOG_UNAVAILABLE', statusCode: 503 }); } });
  await assert.rejects(send({ message: 'Tìm tour ở Đà Lạt', destination: 'Đà Lạt' }), error => error.code === 'CHAT_CATALOG_UNAVAILABLE' && error.statusCode === 503);
});
