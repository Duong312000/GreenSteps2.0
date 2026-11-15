// Add preview campaigns through the normal API. Existing campaigns are preserved.
require('../src/config/env');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
const { User, Vender, GreenService, PartnerCampaign, store } = require('../src/models');

async function main() {
  let server;
  try {
    await store.authenticate();
    const username = process.argv[2] || 'Duong1';
    const user = await User.findOne({ where: { username } });
    if (!user || user.role !== 'provider' || !user.is_verified) {
      throw new Error('A verified provider account is required.');
    }
    const vender = await Vender.findOne({ where: { user_id: user.id } });
    if (!vender) throw new Error('Provider profile not found.');
    const services = await GreenService.collection.find({
      vender_id: vender.id, status: 'active', cost: { $gt: 0 },
    }).sort({ id: 1 }).toArray();
    const stay = services.filter(service => service.type === 'stay');
    const food = services.find(service => service.type === 'food');
    const transport = services.find(service => service.type === 'transport');
    if (stay.length < 2 || !food || !transport) {
      throw new Error('Preview requires two stays, one food service and one transport service.');
    }
    server = await new Promise(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/partner/promotions`;
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '10m' });
    async function api(method, path, body) {
      const response = await fetch(base + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
      return result;
    }
    const definitions = [
      { key: 'stay20', name: '[DEMO] Nghỉ dưỡng Đà Lạt xanh - Giảm 20%', service: stay[0], value: 20, hours: 48, limit: 50 },
      { key: 'stay500k', name: '[DEMO] Vi vu Hội An - Giảm 500.000đ', service: stay[1], value: 500000, fixed: true, hours: 72, limit: 30 },
      { key: 'tea15', name: '[DEMO] Trà chiều Đà Lạt - Giảm 15%', service: food, value: 15, hours: 24, limit: 80 },
      { key: 'bike30', name: '[DEMO] Đạp xe phố cổ xanh - Giảm 30%', service: transport, value: 30, hours: 168, limit: 100 },
      { key: 'early25', name: '[DEMO] Đặt sớm kỳ nghỉ xanh - Giảm 25%', service: stay[0], value: 25, hours: 168, limit: 40, scheduled: true },
      { key: 'paused10', name: '[DEMO] Flash Sale nghỉ dưỡng - Giảm 10% (tạm dừng)', service: stay[1], value: 10, hours: 120, limit: 20, paused: true },
    ];
    const activeIds = [];
    for (const definition of definitions) {
      const marker = `flash-preview-v1:${definition.key}`;
      const existing = await PartnerCampaign.collection.findOne({ user_id: user.id, demo_seed_key: marker });
      if (existing) {
        console.log(JSON.stringify({ skipped: true, name: existing.name }));
        continue;
      }
      if (definition.fixed && definition.value > definition.service.cost) throw new Error('Discount exceeds service price.');
      const start = Date.now() + (definition.scheduled ? 86400000 : -10000);
      const { item } = await api('POST', '', {
        name: definition.name, type: 'flash_sale', service_id: definition.service.id,
        discount_type: definition.fixed ? 'fixed' : 'percent', discount_value: definition.value,
        min_order: 0, usage_limit: definition.limit,
        start_at: new Date(start).toISOString(), end_at: new Date(start + definition.hours * 3600000).toISOString(),
      });
      await PartnerCampaign.collection.updateOne({ id: item.id, user_id: user.id }, { $set: { demo_seed_key: marker } });
      if (definition.paused) await api('PATCH', `/${item.id}/status`, { status: 'paused', version: item.version });
      if (!definition.paused && !definition.scheduled) activeIds.push(item.id);
      const saved = await api('GET', `/${item.id}`);
      console.log(JSON.stringify({ created: true, name: saved.item.name, status: saved.item.effective_status }));
    }
    const feed = await api('GET', '/public');
    if (activeIds.some(id => !feed.items.some(item => item.id === id))) {
      throw new Error('An active preview campaign is missing from the public feed.');
    }
    console.log(JSON.stringify({ username, verifiedNewPublicFlashSales: activeIds.length }));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await store.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
