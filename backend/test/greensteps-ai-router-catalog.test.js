const { test } = require('node:test');
const assert = require('node:assert/strict');
const { routeUserIntent } = require('../src/services/ai-router.service');

test('legacy travel advice uses catalog chat before fixture responses and does not send identity', async () => {
  let received;
  const result = await routeUserIntent({
    message: 'Gợi ý địa điểm Di Di Thảo Mộc Cafe ở Đà Lạt',
    destination: 'Đà Lạt',
    currentActivities: [{ name: 'Hồ Xuân Hương' }],
    userId: 'private-user',
    catalogChat: async payload => { received = payload; return { success: true, reply: 'Chỉ dữ liệu catalog.', recommendation: null, action: null }; }
  });

  assert.equal(result.reply, 'Chỉ dữ liệu catalog.');
  assert.equal(received.message, 'Gợi ý địa điểm Di Di Thảo Mộc Cafe ở Đà Lạt');
  assert.equal(received.userId, undefined);
  assert.deepEqual(received.currentActivities, [{ name: 'Hồ Xuân Hương' }]);
});

test('legacy schedule adjustment remains on the existing action flow', async () => {
  let catalogCalls = 0;
  const result = await routeUserIntent({
    message: 'Tự động sửa giờ bị trùng và sắp xếp lại timeline lịch trình hôm nay',
    catalogChat: async () => { catalogCalls++; throw new Error('Should not use catalog for a schedule action'); }
  });

  assert.equal(catalogCalls, 0);
  assert.equal(result.action, 'auto_adjust_times');
});
