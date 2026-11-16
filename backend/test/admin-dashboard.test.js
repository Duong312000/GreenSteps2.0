const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../src/controllers/admin-dashboard.controller');

function collection(name, count, aggregate = []) {
  return {
    collectionName: name,
    countDocuments: async filter => {
      collection.lastFilters[name] = filter;
      return count;
    },
    aggregate: pipeline => {
      collection.lastPipelines[name] = pipeline;
      return { toArray: async () => aggregate };
    }
  };
}
collection.lastFilters = {};
collection.lastPipelines = {};

function models() {
  return {
    User: { collection: collection('app_users', 40) },
    VenderContract: { collection: collection('app_vendercontracts', 0, [{ count: 3 }]) },
    GreenService: { collection: collection('app_greenservices', 4) },
    ServiceBooking: { collection: collection('app_servicebookings', 2) },
    TourBooking: { collection: collection('app_tourbookings', 27) },
    WalletTransaction: { collection: collection('app_wallettransactions', 0, [{ amount: 123456, transactions: 2 }]) },
    CommunityReport: { collection: collection('app_community_reports', 1) },
    WithdrawalRequest: { collection: collection('app_withdrawalrequests', 0) },
    SepayPaymentAttempt: { collection: collection('app_sepaypaymentattempts', 0) }
  };
}

test('Vietnam business day uses UTC+7 and a half-open day interval', () => {
  const { start, end } = _test.vietnamBusinessDay(new Date('2026-11-16T18:00:00.000Z'));
  assert.equal(start.toISOString(), '2026-11-16T17:00:00.000Z');
  assert.equal(end.toISOString(), '2026-11-17T17:00:00.000Z');
});

test('admin summary reports actual metric definitions and does not invent anomaly counts', async () => {
  const result = await _test.getSummary(new Date('2026-11-16T05:00:00.000Z'), models());
  assert.equal(result.activeUsers.value, 40);
  assert.equal(result.pendingProviders.value, 3);
  assert.equal(result.pendingServices.value, 4);
  assert.deepEqual(result.pendingBookings, {
    value: 29, service: 2, tour: 27, walletPayments: 0,
    source: 'ServiceBooking.status = pending + TourBooking.status = pending + WalletTransaction(type=payment,status=pending).'
  });
  assert.equal(result.platformRevenueToday.value, 123456);
  assert.equal(result.platformRevenueToday.transactions, 2);
  assert.deepEqual(result.abnormalTransactions, {
    available: false,
    reason: 'Chưa có tiêu chí nghiệp vụ phát hiện giao dịch bất thường.'
  });
  assert.equal(result.alerts.items.some(alert => alert.key === 'reports' && alert.count === 1), true);
  assert.equal(collection.lastFilters.app_users.is_verified, true);
  assert.equal(collection.lastPipelines.app_wallettransactions.some(stage => stage.$match?.$expr), true);
});
