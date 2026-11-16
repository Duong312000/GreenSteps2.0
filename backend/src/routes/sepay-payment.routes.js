const express = require('express');
const router = express.Router();
const controller = require('../controllers/sepay-payment.controller');
const { softAuth } = require('../middlewares/auth.middleware');

router.get('/config', controller.config);
router.post('/create', softAuth, controller.create);
router.get('/status/:bookingId', softAuth, controller.status);
router.post('/ipn', controller.ipn);

module.exports = router;
