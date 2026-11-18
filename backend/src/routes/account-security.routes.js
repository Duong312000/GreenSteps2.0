const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const controller = require('../controllers/account-security.controller');
const { createLoginRateLimiter } = require('../middlewares/security.middleware');
const securityAttemptLimiter = createLoginRateLimiter({ limit: 8 });

const router = express.Router();
router.use(authMiddleware);
router.get('/overview', controller.getOverview);
router.get('/sessions', controller.listSessions);
router.delete('/sessions/:sessionId', controller.revokeSession);
router.post('/sessions/revoke-others', controller.revokeOtherSessions);
router.post('/sessions/revoke-all', controller.revokeAllSessions);
router.get('/activity', controller.listActivity);
router.put('/preferences', controller.updatePreferences);
router.post('/password/setup', securityAttemptLimiter, controller.setPassword);
router.post('/email-change/request', securityAttemptLimiter, controller.requestEmailChange);
router.post('/email-change/confirm', securityAttemptLimiter, controller.confirmEmailChange);
router.post('/passkeys/register/options', securityAttemptLimiter, controller.beginPasskeyRegistration);
router.post('/passkeys/register/verify', securityAttemptLimiter, controller.finishPasskeyRegistration);
router.patch('/passkeys/:passkeyId', controller.renamePasskey);
router.delete('/passkeys/:passkeyId', securityAttemptLimiter, controller.deletePasskey);

module.exports = router;
