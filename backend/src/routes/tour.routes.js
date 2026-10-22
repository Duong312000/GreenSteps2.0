const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { cacheMiddleware } = require('../middlewares/cache');

router.get('/', cacheMiddleware(600), tourController.getPresetTours); // cache 10 min
router.get('/recommendations/:userId', tourController.getRecommendations);
router.get('/destinations', cacheMiddleware(1800), tourController.getDestinations); // cache 30 min
router.get('/:id', cacheMiddleware(600), tourController.getPresetTourById); // cache 10 min
router.post('/reviews', authMiddleware, tourController.postTourReview);
router.get('/:tourId/reviews', tourController.getTourReviews);

module.exports = router;
