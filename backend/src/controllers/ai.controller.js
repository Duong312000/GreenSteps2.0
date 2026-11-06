const { routeUserIntent } = require('../services/ai-router.service');

/**
 * 3-Tier AI Chat Controller:
 * - Tier 1: Instant rule-based & FAQ answers (<50ms, 0 AI tokens)
 * - Tier 2: n8n workflow triggers (booking lookup, resend tickets, operational actions)
 * - Tier 3: Gemini generative AI agent (complex reasoning, custom itineraries, eco advice)
 */
exports.chat = async (req, res, next) => {
  const { message, destination, currentActivities, history } = req.body;

  if (!message || !String(message).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nội dung tin nhắn không được để trống!'
    });
  }

  try {
    const result = await routeUserIntent({
      message: String(message).trim(),
      destination,
      currentActivities,
      history,
      userId: req.user?.id || null
    });

    return res.json(result);
  } catch (error) {
    console.error('AI chat endpoint error:', error);
    return res.status(500).json({
      success: false,
      tier: 'tier_1_faq',
      tierLabel: '⚡ GreenSteps Bot',
      reply: 'Hệ thống đang gặp sự cố kết nối. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ hotline 1900 6868.',
      recommendation: null
    });
  }
};
