const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const { softAuth, authMiddleware } = require('../middlewares/auth.middleware');

router.get('/user/:userId', authMiddleware, tourController.getUserCustomItineraries);
router.get('/:id', authMiddleware, tourController.getCustomItineraryById);
router.post('/', authMiddleware, tourController.saveCustomItinerary);
router.post('/:id/clone', authMiddleware, tourController.cloneItinerary);
router.delete('/:id', authMiddleware, tourController.deleteCustomItinerary);
router.post('/:id/invite', authMiddleware, tourController.inviteCollaborator);
router.post('/:id/join', authMiddleware, tourController.joinItinerary);

module.exports = router;
