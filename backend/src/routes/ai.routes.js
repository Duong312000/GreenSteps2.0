const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { softAuth } = require('../middlewares/auth.middleware');

router.post('/chat', softAuth, aiController.chat);

module.exports = router;
