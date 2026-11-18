const express = require('express');
const { NewsletterSubscription } = require('../models');

function createNewsletterRouter({ Model = NewsletterSubscription, now = Date.now } = {}) {
  const router = express.Router();
  const requests = new Map();

  router.post('/', async (req, res) => {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 128);
    const current = now();
    for (const [key, value] of requests) if (value.until <= current) requests.delete(key);
    const state = requests.get(ip) || { count: 0, until: current + 60_000 };
    state.count += 1;
    requests.set(ip, state);
    if (state.count > 10) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((state.until - current) / 1000))));
      return res.status(429).json({ success: false, message: 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.' });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
    }
    try {
      const [, created] = await Model.findOrCreate({
        where: { email },
        defaults: { email, consented_at: new Date(current), status: 'subscribed' }
      });
      return res.status(created ? 201 : 200).json({ success: true, message: created ? 'Bạn đã đăng ký nhận bản tin GreenSteps.' : 'Email này đã đăng ký nhận bản tin.' });
    } catch (error) {
      if (error?.code === 11000 || error?.name === 'SequelizeUniqueConstraintError') {
        return res.json({ success: true, message: 'Email này đã đăng ký nhận bản tin.' });
      }
      return res.status(500).json({ success: false, message: 'Chưa thể đăng ký lúc này. Vui lòng thử lại sau.' });
    }
  });

  return router;
}

module.exports = createNewsletterRouter();
module.exports.createNewsletterRouter = createNewsletterRouter;
