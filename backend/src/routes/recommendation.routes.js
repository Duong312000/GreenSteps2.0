const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const serviceController = require('../controllers/service.controller');
const { softAuth } = require('../middlewares/auth.middleware');

router.get('/tours/:userId', softAuth, tourController.getRecommendations);
router.get('/services/:userId', softAuth, serviceController.getRecommendations);

module.exports = router;
