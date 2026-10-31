// Explicit demo seed for Duong. Reruns preserve existing records and user edits.
require('../src/config/env');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
const { User, Vender, GreenService, PartnerCampaign, store } = require('../src/models');

(async () => {
  let server;
  try {
    await store.authenticate();
    const user = await User.findOne({ where: { username: 'Duong' } });
    if (!user || user.role !== 'provider' || !user.is_verified) throw new Error('Duong must be a verified provider.');
    let vender = await Vender.findOne({ where: { user_id: user.id } });
    if (!vender) vender = await Vender.create({ id: `provider_${user.id}`, user_id: user.id });
    const serviceDefinitions = [
      { id: `demo-${user.id}-stay`, name_service: '[DEMO] Homestay xanh Đà Lạt', type: 'stay', cost: 850000, destination: 'Đà Lạt', image_url: '/image/dalat_cover.png' },
      { id: `demo-${user.id}-experience`, name_service: '[DEMO] Khám phá thiên nhiên Đà Nẵng', type: 'attraction', cost: 450000, destination: 'Đà Nẵng', image_url: '/image/danang_cover.png' },
    ];
    for (const service of serviceDefinitions) {
      const existing = await GreenService.findByPk(service.id);
      if (existing && existing.vender_id !== vender.id) throw new Error('Demo service ownership conflict.');
      if (!existing) await GreenService.create({ ...service, vender_id: vender.id, status: 'active', max_capacity: 0,
        current_data: { is_demo: true, bookable: false, description: 'Dịch vụ minh họa cho chiến dịch demo, không nhận đặt chỗ.', img: service.image_url },
      });
    }
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}/api/partner/promotions`;
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '10m' });
    async function api(method, path, body) {
      const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
      return data;
    }
    const now = Date.now();
    const day = 86400000;
    const definitions = [
      { name: '[DEMO] Đà Lạt xanh - Gói nổi bật', type: 'promotion', service_id: serviceDefinitions[0].id, package: 'featured', budget: 1050000, offset: -10000, days: 7 },
      { name: '[DEMO] Đà Nẵng - Hành trình tháng mới', type: 'promotion', service_id: serviceDefinitions[1].id, package: 'discovery', budget: 500000, offset: 3 * day, days: 10 },
      { name: '[DEMO] Flash Sale homestay - Giảm 20%', type: 'flash_sale', service_id: serviceDefinitions[0].id, discount_value: 20, usage_limit: 50, offset: -10000, days: 3 },
      { name: '[DEMO] Trải nghiệm xanh - Giảm 100.000đ', type: 'flash_sale', service_id: serviceDefinitions[1].id, discount_type: 'fixed', discount_value: 100000, min_order: 400000, usage_limit: 30, offset: -10000, days: 5, paused: true },
      { name: '[DEMO] Chào bạn mới - Ưu đãi 10%', type: 'voucher', code: 'DUONGDEMO10', discount_value: 10, min_order: 500000, usage_limit: 100, offset: -10000, days: 30 },
      { name: '[DEMO] Vi vu xanh - Giảm 150.000đ', type: 'voucher', code: 'DUONGDEMO150K', discount_type: 'fixed', discount_value: 150000, min_order: 1000000, usage_limit: 60, offset: 2 * day, days: 14 },
    ];
    for (const definition of definitions) {
      const existing = await PartnerCampaign.findOne({ where: { user_id: user.id, name: definition.name } });
      if (existing) { console.log(JSON.stringify({ skipped: true, name: definition.name })); continue; }
      const { offset, days, paused, ...fields } = definition;
      const body = { discount_type: 'percent', min_order: 0, ...fields,
        start_at: new Date(now + offset).toISOString(), end_at: new Date(now + offset + days * day).toISOString(),
      };
      const { item } = await api('POST', '', body);
      if (paused) await api('PATCH', `/${item.id}/status`, { status: 'paused', version: item.version });
      const saved = await PartnerCampaign.collection.findOne({ id: item.id, user_id: user.id });
      if (!saved) throw new Error('MongoDB persistence verification failed.');
      console.log(JSON.stringify({ created: true, name: saved.name, type: saved.type }));
    }
    const result = await api('GET', '?q=%5BDEMO%5D&limit=50');
    console.log(JSON.stringify({ username: user.username, total: result.total,
      campaigns: result.items.map(item => ({ name: item.name, status: item.effective_status })) }));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await store.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
