const demo = require('../services/wallet-demo.service');
const route = fn => async (req, res, next) => {
  try { await fn(req, res); }
  catch (error) {
    if (error.code === 11000 || error.hasErrorLabel?.('TransientTransactionError')) {
      return next(Object.assign(new Error('Giao dịch hoặc số dư vừa thay đổi. Vui lòng thử lại cùng yêu cầu.'), { statusCode: 409 }));
    }
    next(error);
  }
};
exports.deposit = route(async (req, res) => res.status(202).json({ success: true, transaction: await demo.create(req.user.id, 'deposit', req.body, req.headers['idempotency-key']) }));
exports.withdraw = route(async (req, res) => res.status(202).json({ success: true, transaction: await demo.create(req.user.id, 'withdrawal', req.body, req.headers['idempotency-key']) }));
exports.transfer = route(async (req, res) => res.json({ success: true, transaction: await demo.transfer(req.user.id, req.body, req.headers['idempotency-key']) }));
exports.recipient = route(async (req, res) => res.json({ success: true, recipient: await demo.recipient(req.user.id, req.query.q) }));
exports.bank = route(async (req, res) => res.status(201).json({ success: true, bank: await demo.addBank(req.user.id, req.body.label) }));
exports.history = route(async (req, res) => res.json({ success: true, ...await demo.history(req.user.id, Number(req.query.page || 0)) }));
exports.detail = route(async (req, res) => res.json({ success: true, ...await demo.detail(req.user, req.params.id) }));
exports.settle = route(async (req, res) => res.json({ success: true, transaction: await demo.settle(req.user, req.params.id, req.body.status) }));
exports.cancel = route(async (req, res) => res.json({ success: true, transaction: await demo.settle(req.user, req.params.id, 'CANCELLED', true) }));
exports.simulate = route(async (req, res) => res.json({ success: true, transaction: await demo.settle(req.user, req.params.id, req.body.status, false, true) }));
exports.queue = route(async (req, res) => res.json({ success: true, transactions: await demo.queue(req.user) }));
