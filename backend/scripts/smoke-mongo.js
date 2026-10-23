// Read-only HTTP checks against migrated data using a temporary local listener.
const { store, User, Wallet, ScheduleSample, GreenService, ScheduleCustom, WalletTransaction } = require('../src/models');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
async function smoke() {
  let server;
  try {
    await store.authenticate();
    const user = await User.findOne();
    const admin = await User.findOne({ where: { role: 'admin' } }) || user;
    if (!user) throw new Error('No migrated users found');
    const sample = await ScheduleSample.findOne();
    const service = await GreenService.findOne();
    const custom = await ScheduleCustom.findOne();
    const wallet = await Wallet.findOne();
    const transaction = wallet && await WalletTransaction.findOne({ where: { wallet_id: wallet.id } });
    const token = jwt.sign({ id: admin.id, role: admin.role, username: admin.username }, JWT_SECRET, { expiresIn: '1m' });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const endpoints = ['/api/health', '/api/tours', '/api/services', '/api/tours/destinations', '/api/community/posts', '/api/bookings', '/api/bookings/pending', '/api/change-requests', '/api/operations', `/api/notifications/user/${user.id}`, `/api/recommendations/tours/${user.id}`, `/api/recommendations/services/${user.id}`, '/api/v1/tours'];
    if (sample) endpoints.push(`/api/tours/${sample.id}`, `/api/reviews/tour/${sample.id}`);
    if (service) endpoints.push(`/api/services/${service.id}`, `/api/reviews/service/${service.id}`);
    if (custom) endpoints.push(`/api/itineraries/${custom.id}`, `/api/itineraries/user/${custom.user_id}`);
    if (wallet) endpoints.push(`/api/wallet/${wallet.user_id}`);
    if (transaction) endpoints.push(`/api/wallet/transaction-status/${transaction.id}`);
    for (const endpoint of endpoints) {
      const response = await fetch(base + endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(`HTTP ${response.status}: ${endpoint.split('/').slice(0, 3).join('/')} ${body.message || ''}`);
      }
      const body = await response.json();
      console.log(`OK ${endpoint.split('/').slice(0, 3).join('/')} ${Array.isArray(body) ? `(${body.length} rows)` : ''}`);
    }
    console.log(`Read-only smoke checks passed: ${endpoints.length} endpoints`);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await store.close();
  }
}
if (require.main === module) smoke().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { smoke };
