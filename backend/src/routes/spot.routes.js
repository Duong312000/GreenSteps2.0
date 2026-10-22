const express = require('express');
const router = express.Router();
const spotController = require('../controllers/spot.controller');
const { cacheMiddleware } = require('../middlewares/cache');

// GET /api/spots/search-serp?q=...&destination=...
// Cache results for 30 minutes (1800 seconds) to save SerpApi quota
router.get('/search-serp', cacheMiddleware(1800), spotController.searchSerp);
router.get('/reverse-serp', cacheMiddleware(1800), spotController.reverseSerp);

module.exports = router;

