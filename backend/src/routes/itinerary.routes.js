const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const { softAuth } = require('../middlewares/auth.middleware');

router.get('/user/:userId', softAuth, tourController.getUserCustomItineraries);
router.get('/:id', softAuth, tourController.getCustomItineraryById);
router.post('/', softAuth, tourController.saveCustomItinerary);
router.post('/:id/clone', softAuth, tourController.cloneItinerary);
router.delete('/:id', softAuth, tourController.deleteCustomItinerary);
router.post('/:id/invite', softAuth, tourController.inviteCollaborator);
router.post('/:id/join', softAuth, tourController.joinItinerary);

module.exports = router;
