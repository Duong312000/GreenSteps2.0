const express = require('express');
const controller = require('../controllers/media.controller');
const { strictAuthMiddleware, checkRole } = require('../middlewares/auth.middleware');
const router = express.Router();

router.post('/', strictAuthMiddleware, checkRole(['provider', 'admin']), controller.uploadImage);
router.delete('/:id', strictAuthMiddleware, checkRole(['provider', 'admin']), controller.deleteImage);

module.exports = router;
