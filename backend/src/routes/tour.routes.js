const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/', tourController.getPresetTours);
router.get('/recommendations/:userId', tourController.getRecommendations);
router.get('/destinations', tourController.getDestinations);
router.get('/:id', tourController.getPresetTourById);
router.post('/reviews', authMiddleware, tourController.postTourReview);
router.get('/:tourId/reviews', tourController.getTourReviews);

module.exports = router;
