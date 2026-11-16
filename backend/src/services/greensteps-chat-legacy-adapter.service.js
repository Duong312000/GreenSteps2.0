const { randomUUID } = require('node:crypto');
const { createChatAdapter } = require('./greensteps-chat.service');

function safeActivities(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map(activity => {
    const name = typeof activity?.name === 'string' ? activity.name : activity?.activity_name;
    if (typeof name !== 'string' || !name.trim()) return null;
    const time = typeof activity.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(activity.time) ? activity.time : '08:00';
    return { name: name.trim().slice(0, 140), time, verified: false };
  }).filter(Boolean);
}

function createLegacyChatAdapter({ sendCatalogChat = createChatAdapter() } = {}) {
  return async function sendLegacyCatalogChat({ message, destination, currentActivities, history } = {}, options = {}) {
    const destinationText = typeof destination === 'string' ? destination.trim().slice(0, 80) : '';
    const requestText = typeof message === 'string' ? message.trim() : '';
    const augmentedMessage = destinationText && !requestText.toLocaleLowerCase().includes(destinationText.toLocaleLowerCase())
      ? `${requestText} (điểm đến hiện tại: ${destinationText})`
      : requestText;
    const activities = safeActivities(currentActivities);
    const planState = activities.length && destinationText
      ? { name: 'Lịch trình hiện tại', destination: destinationText, days: [activities] }
      : null;
    const result = await sendCatalogChat({
      message: augmentedMessage,
      sessionId: randomUUID(),
      history: Array.isArray(history) ? history.slice(-6) : [],
      plannerState: planState
    }, options);
    return {
      success: true,
      reply: result.reply,
      recommendation: null,
      action: null
    };
  };
}

module.exports = { createLegacyChatAdapter, safeActivities };
