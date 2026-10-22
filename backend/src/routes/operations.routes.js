const express = require('express');
const router = express.Router();
const operationsController = require('../controllers/operations.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, operationsController.getAssignments);
router.post('/:bookingId/assign', authMiddleware, operationsController.assignStaffAndVehicle);
router.post('/:bookingId/checklist', authMiddleware, operationsController.updateChecklistItem);
router.post('/:bookingId/status', authMiddleware, operationsController.updateAssignmentStatus);

module.exports = router;
