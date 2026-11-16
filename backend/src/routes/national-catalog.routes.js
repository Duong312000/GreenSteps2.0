const express = require('express');
const controller = require('../controllers/national-catalog.controller');
const router = express.Router();

router.get('/regions', controller.getRegions);
router.get('/provinces', controller.getProvinces);
router.get('/destinations', controller.getDestinations);
router.get('/destinations/:slug', controller.getDestinationBySlug);

module.exports = router;
