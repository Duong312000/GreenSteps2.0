/**
 * API Quota & Rate Limiting Protocol for External Google APIs
 * Protects server resources, prevents abuse, and controls Google Places API quota.
 */

// In-memory sliding window store (persists across warm serverless invocations / Node runtime)
const ipRequestHistory = new Map(); // ip -> Array of timestamps
const dailyCounter = {
  date: new Date().toISOString().slice(0, 10),
  count: 0
};
const destinationCooldowns = new Map(); // destination -> lastCrawlTimestamp

// Configurable thresholds
const LIMITS = {
  MAX_PER_10_MINUTES: 5,        // Max crawl calls per IP in 10 minutes
  MAX_PER_DAY_PER_IP: 25,       // Max crawl calls per IP in 24 hours
  GLOBAL_DAILY_HARD_CAP: 100,   // Safety breaker for the whole server per day
  DESTINATION_COOLDOWN_MS: 30000 // 30s cooldown before crawling same destination again
};

/**
 * Check if the request is permitted to call Google Places API
 * @param {string} clientIp - Client IP address or session id
 * @param {string} destination - Target destination
 * @returns {{ allowed: boolean, statusCode?: number, message?: string, remaining?: number }}
 */
function checkExternalApiQuota(clientIp = 'unknown', destination = '') {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Reset daily global counter if new day
  if (dailyCounter.date !== today) {
    dailyCounter.date = today;
    dailyCounter.count = 0;
  }

  // 2. Check Global Daily Circuit Breaker
  if (dailyCounter.count >= LIMITS.GLOBAL_DAILY_HARD_CAP) {
    return {
      allowed: false,
      statusCode: 429,
      code: 'DAILY_CAP_REACHED',
      message: 'Hệ thống đã đạt giới hạn tra cứu vệ tinh trong ngày để bảo vệ tài nguyên. Vui lòng sử dụng các dịch vụ sinh thái hiện có!'
    };
  }

  // 3. Check Destination Cooldown (prevents clicking "Trang tiếp" 10 times in 2 seconds)
  if (destination) {
    const destKey = destination.trim().toLowerCase();
    const lastCrawl = destinationCooldowns.get(destKey) || 0;
    if (now - lastCrawl < LIMITS.DESTINATION_COOLDOWN_MS) {
      const waitSec = Math.ceil((LIMITS.DESTINATION_COOLDOWN_MS - (now - lastCrawl)) / 1000);
      return {
        allowed: false,
        statusCode: 429,
        code: 'DEST_COOLDOWN',
        message: `Đang cập nhật địa điểm tại ${destination}. Vui lòng đợi ${waitSec} giây trước khi tải thêm.`
      };
    }
  }

  // 4. Check Per-IP Sliding Window (10-minute window)
  const ipKey = String(clientIp).split(',')[0].trim();
  const history = (ipRequestHistory.get(ipKey) || []).filter(ts => now - ts < 24 * 60 * 60 * 1000);
  
  // Count requests in last 10 minutes
  const recentTenMins = history.filter(ts => now - ts < 10 * 60 * 1000);
  if (recentTenMins.length >= LIMITS.MAX_PER_10_MINUTES) {
    const oldestInWindow = recentTenMins[0];
    const waitSec = Math.ceil((10 * 60 * 1000 - (now - oldestInWindow)) / 1000);
    return {
      allowed: false,
      statusCode: 429,
      code: 'SESSION_RATE_LIMITED',
      message: `Bạn đã thực hiện ${recentTenMins.length} lượt khám phá mới trong 10 phút. Vui lòng nghỉ ngơi và thử lại sau ${waitSec} giây.`
    };
  }

  // Count requests in last 24 hours
  if (history.length >= LIMITS.MAX_PER_DAY_PER_IP) {
    return {
      allowed: false,
      statusCode: 429,
      code: 'IP_DAILY_LIMITED',
      message: 'Bạn đã đạt giới hạn tra cứu địa điểm mới cho phiên hôm nay (tối đa 25 lần). Cảm ơn bạn!'
    };
  }

  return {
    allowed: true,
    remaining: LIMITS.MAX_PER_10_MINUTES - recentTenMins.length - 1
  };
}

/**
 * Record a successful crawl execution
 */
function recordApiUsage(clientIp = 'unknown', destination = '') {
  const now = Date.now();
  const ipKey = String(clientIp).split(',')[0].trim();

  // Record IP history
  const history = (ipRequestHistory.get(ipKey) || []).filter(ts => now - ts < 24 * 60 * 60 * 1000);
  history.push(now);
  ipRequestHistory.set(ipKey, history);

  // Record daily global
  dailyCounter.count++;

  // Record destination cooldown
  if (destination) {
    destinationCooldowns.set(destination.trim().toLowerCase(), now);
  }

  console.log(`[API Quota Guard] Ghi nhận lượt gọi từ ${ipKey}. Global today: ${dailyCounter.count}/${LIMITS.GLOBAL_DAILY_HARD_CAP}`);
}

module.exports = {
  checkExternalApiQuota,
  recordApiUsage,
  LIMITS
};
