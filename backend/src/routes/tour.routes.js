const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const { authMiddleware, softAuth } = require('../middlewares/auth.middleware');

router.get('/', softAuth, tourController.getPresetTours);
router.get('/search', tourController.searchTours);
router.get('/recommendations/:userId', authMiddleware, tourController.getRecommendations);
router.get('/destinations', tourController.getDestinations);
router.get('/:id', tourController.getPresetTourById);
router.post('/reviews', authMiddleware, tourController.postTourReview);
router.get('/:tourId/reviews', tourController.getTourReviews);

module.exports = router;
