const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { authMiddleware, checkRole } = require('../middlewares/auth.middleware');

const v2 = require('../controllers/wallet-v2.controller');
router.use(authMiddleware);
const demo = require('../controllers/wallet-demo.controller');
router.post('/demo/deposits', demo.deposit);
router.post('/demo/withdrawals', demo.withdraw);
router.post('/demo/transfers', demo.transfer);
router.get('/demo/recipient', demo.recipient);
router.post('/demo/banks', demo.bank);
router.get('/demo/transactions', demo.history);
router.get('/demo/transactions/:id', demo.detail);
router.post('/demo/transactions/:id/cancel', demo.cancel);
router.post('/demo/transactions/:id/simulate', demo.simulate);
router.get('/demo/admin/pending', checkRole(['admin']), demo.queue);
router.post('/demo/admin/transactions/:id/settle', checkRole(['admin']), demo.settle);
router.get('/overview', v2.overview);
router.post('/activate', v2.activate);
router.post('/deposit', v2.request);
router.post('/withdraw', v2.request);
router.post('/points/redeem', v2.redeem);
router.post('/points/transfer', v2.transfer);
router.post('/methods', v2.addMethod);
router.delete('/methods/:id', v2.removeMethod);
router.post('/deposits/:id/reject', checkRole(['admin']), v2.reject);
router.post('/withdrawals/:id/reject', checkRole(['admin']), v2.reject);
router.post('/deposits/:id/approve', checkRole(['admin']), v2.verify);
router.post('/withdrawals/:id/approve', checkRole(['admin']), v2.verify);
router.post('/pending-activations/:txId/approve', checkRole(['admin']), (req, res) => res.status(409).json({ success: false, message: 'Kích hoạt ví không cấp tiền thưởng. Vui lòng kích hoạt từ tài khoản.' }));

router.get('/', walletController.getWallet);
router.get('/transactions', walletController.getTransactions);
router.get('/transaction-status/:txId', authMiddleware, walletController.getTransactionStatus);

// Admin-only endpoints
router.get('/withdrawals', authMiddleware, checkRole(['admin']), walletController.listAllWithdrawals);
router.get('/deposits/pending', authMiddleware, checkRole(['admin']), walletController.listPendingDeposits);
router.get('/pending-activations', authMiddleware, checkRole(['admin']), walletController.listPendingWallets);
router.post('/pending-activations/:txId/reject', authMiddleware, checkRole(['admin']), walletController.rejectWalletActivation);

// Legacy compat endpoints
router.get('/:userId', walletController.getWallet);
router.post('/pay', (req, res, next) => { req.body.userId = req.user.id; next(); }, walletController.payItinerary);
router.post('/pay-qr', (req, res, next) => { req.body.userId = req.user.id; next(); }, walletController.payItineraryQr);
router.get('/transactions/:userId', walletController.getTransactions);

module.exports = router;
