const router = require('express').Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const favorites = require('../services/favorites.service');
router.use(authMiddleware);
router.get('/', async (req, res, next) => {
  try { res.json({ success: true, ...await favorites.list(req.user.id, req.query) }); } catch (error) { next(error); }
});
router.put('/:type/:targetId', async (req, res, next) => {
  try { res.json({ success: true, saved: true, data: await favorites.save(req.user.id, req.params.type, req.params.targetId, req.body || {}) }); } catch (error) { next(error); }
});
router.delete('/:type/:targetId', async (req, res, next) => {
  try { await favorites.remove(req.user.id, req.params.type, req.params.targetId); res.json({ success: true, saved: false }); } catch (error) { next(error); }
});
module.exports = router;
