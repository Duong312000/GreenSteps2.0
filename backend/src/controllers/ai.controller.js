const { routeUserIntent } = require('../services/ai-router.service');

/**
 * Legacy AI chat controller. Keeps booking and schedule actions on the existing
 * router while returning a safe, explicit failure when catalog verification is
 * unavailable.
 */
function createAiController({ routeUserIntent: route = routeUserIntent, logger = console } = {}) {
  return async (req, res, next) => {
    const { message, destination, currentActivities, history } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống!'
      });
    }

    try {
      const result = await route({
        message: String(message).trim(),
        destination,
        currentActivities,
        history,
        userId: req.user?.id || null
      });
      return res.json(result);
    } catch (error) {
      logger.error?.('AI chat endpoint failed', { code: error.code || 'AI_CHAT_ERROR' });
      const catalogUnavailable = error.code === 'CHAT_CATALOG_UNAVAILABLE';
      return res.status(catalogUnavailable ? 503 : 500).json({
        success: false,
        tier: 'tier_1_faq',
        tierLabel: 'GreenSteps Bot',
        reply: catalogUnavailable
          ? 'Danh mục du lịch GreenSteps hiện chưa truy cập được nên mình chưa thể xác minh tour, dịch vụ hoặc giá. Vui lòng thử lại sau.'
          : 'Hệ thống đang gặp sự cố kết nối. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ hotline 1900 6868.',
        recommendation: null,
        action: null
      });
    }
  };
}

exports.createAiController = createAiController;
exports.chat = createAiController();
