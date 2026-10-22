const express = require('express');
const router = express.Router();
const changeRequestController = require('../controllers/change-request.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, changeRequestController.getChangeRequests);
router.post('/', authMiddleware, changeRequestController.createChangeRequest);
router.post('/:id/approve', authMiddleware, changeRequestController.approveChangeRequest);
router.post('/:id/reject', authMiddleware, changeRequestController.rejectChangeRequest);
router.post('/:id/propose', authMiddleware, changeRequestController.proposeAlternativeChangeRequest);

module.exports = router;
