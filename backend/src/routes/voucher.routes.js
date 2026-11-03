const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucher.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const wallet = require('../controllers/wallet-v2.controller');
router.use(authMiddleware);

router.post('/redeem', (req, res, next) => { req.body.points ??= 1000; next(); }, wallet.redeem);
router.post('/validate', voucherController.validateVoucher);
router.get('/my', voucherController.getMyVouchers);

module.exports = router;
