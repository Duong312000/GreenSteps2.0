const router = require('express').Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const controller = require('../controllers/partner-promotions.controller');
// Public customer feed: controller applies active dates, remaining usage and service checks.
router.get('/public', controller.publicList);
router.use(authMiddleware, controller.authorize);
router.get('/options', controller.options);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.detail);
router.get('/:id/report', controller.report);
router.put('/:id', controller.update);
router.patch('/:id/status', controller.status);
router.delete('/:id', controller.remove);
module.exports = router;
