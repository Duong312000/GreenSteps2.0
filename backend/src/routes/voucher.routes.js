const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucher.controller');
const { softAuth } = require('../middlewares/auth.middleware');

router.post('/redeem', softAuth, voucherController.redeemVoucher);
router.post('/validate', softAuth, voucherController.validateVoucher);
router.get('/my', softAuth, voucherController.getMyVouchers);

module.exports = router;
