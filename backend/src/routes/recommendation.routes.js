const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const serviceController = require('../controllers/service.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/tours/:userId', authMiddleware, tourController.getRecommendations);
router.get('/services/:userId', authMiddleware, serviceController.getRecommendations);

module.exports = router;
