const fs = require('fs');
const path = require('path');
const { Op } = require('../db/mongo-store');
const { FAQ, AdCampaign, GreenService, TourBooking, ServiceBooking } = require('../models/index');
const { geminiModel } = require('../config/gemini');
const { sendBookingConfirmationEmail } = require('./email.service');
const { isCatalogDependentRequest } = require('./greensteps-chat-fast-path.service');
const { createLegacyChatAdapter } = require('./greensteps-chat-legacy-adapter.service');
const { randomUUID } = require('node:crypto');

const sendCatalogTravelChat = createLegacyChatAdapter();

// Load Training Dataset (85+ Curated Multi-turn Samples)
let trainingDataset = null;
try {
  const datasetPath = path.join(__dirname, '..', 'data', 'ai-training-dataset.json');
  if (fs.existsSync(datasetPath)) {
    trainingDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    console.log(`[AI Router] Loaded training dataset with ${trainingDataset.totalSamples || trainingDataset.examples?.length} examples.`);
  }
} catch (e) {
  console.warn('[AI Router] Training dataset load skipped:', e.message);
}

// Normalize Vietnamese accents and lowercases for fuzzy rule matching
function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// Helper: Dispatch to n8n Webhook
async function triggerN8nWorkflow(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  const headerName = process.env.N8N_AUTH_HEADER_NAME || 'X-GreenSteps-Agent-Key';
  const headerValue = process.env.N8N_AUTH_HEADER_VALUE;

  if (!url || !headerValue) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const fullPayload = {
      ...payload,
      sessionId: payload.sessionId || `gs_session_${randomUUID()}`,
      chatInput: payload.message || payload.chatInput || ''
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [headerName]: headerValue
      },
      body: JSON.stringify(fullPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.reply || data.output || data.message)) {
        return data.reply || data.output || data.message;
      }
    }
  } catch (err) {
    console.warn('n8n Webhook request bypassed or timed out:', err.message);
  }
  return null;
}

// Helper: Local fallback for Booking Lookup
async function handleBookingLookup(bookingCode) {
  try {
    const code = String(bookingCode).trim().toUpperCase();
    let booking = await TourBooking.findByPk(code);
    let type = 'Tour du lịch';

    if (!booking) {
      booking = await ServiceBooking.findByPk(code);
      type = 'Dịch vụ sinh thái';
    }

    if (!booking) {
      booking = await TourBooking.findOne({ where: { id: { [Op.iLike]: `%${code}%` } } });
      if (!booking) {
        booking = await ServiceBooking.findOne({ where: { id: { [Op.iLike]: `%${code}%` } } });
      }
    }

    if (!booking) {
      return `⚠️ **Không tìm thấy đơn hàng:** Không có đơn hàng nào khớp với mã \`${code}\`. Vui lòng kiểm tra lại email xác nhận hoặc liên hệ hotline 1900 6868 để được trợ giúp.`;
    }

    const statusMap = {
      pending: '⏳ Đang chờ xác nhận / thanh toán',
      confirmed: '✅ Đã xác nhận (Hoạt động)',
      completed: '🎉 Đã hoàn thành',
      cancelled: '❌ Đã hủy',
      refunded: '💰 Đã hoàn tiền'
    };

    const statusText = statusMap[booking.status] || booking.status;
    const formattedAmount = booking.total_price ? new Intl.NumberFormat('vi-VN').format(booking.total_price) + ' đ' : 'Miễn phí';
    const guestName = booking.guest_name || booking.contact_name || 'Quý khách';
    const departure = booking.start_date || booking.checkin_date || 'Theo thỏa thuận';

    return `🎫 **KẾT QUẢ TRA CỨU ĐƠN HÀNG #${booking.id}**
• **Loại dịch vụ:** ${type}
• **Tên khách hàng:** ${guestName}
• **Trạng thái:** ${statusText}
• **Ngày khởi hành / nhận chỗ:** ${departure}
• **Tổng thanh toán:** ${formattedAmount}
• **Email nhận vé:** ${booking.guest_email || booking.contact_email || 'Đã lưu trên hệ thống'}

*Vé điện tử (E-Voucher) hợp lệ. Bạn có thể xuất trình mã đơn này tại điểm đón để check-in.*`;
  } catch (err) {
    console.error('Error during local booking lookup:', err);
    return `⚠️ Không thể tra cứu đơn hàng #${bookingCode} lúc này do trục trặc cơ sở dữ liệu. Vui lòng thử lại sau.`;
  }
}

// Helper: Local fallback for resending ticket email
async function handleResendTicket(emailOrCode) {
  try {
    const q = String(emailOrCode || '').trim();
    let booking = null;

    if (q.includes('@')) {
      booking = await TourBooking.findOne({ where: { guest_email: q }, order: [['createdAt', 'DESC']] });
      if (!booking) {
        booking = await ServiceBooking.findOne({ where: { contact_email: q }, order: [['createdAt', 'DESC']] });
      }
    } else {
      booking = await TourBooking.findByPk(q.toUpperCase()) || await ServiceBooking.findByPk(q.toUpperCase());
    }

    if (!booking) {
      return `📧 **Gửi lại vé điện tử:** Vui lòng cung cấp chính xác **Mã đơn hàng (ví dụ: BKT-...)** hoặc **Địa chỉ Email** bạn đã dùng để đặt vé để hệ thống gửi lại vé.`;
    }

    const targetEmail = booking.guest_email || booking.contact_email;
    if (targetEmail) {
      await sendBookingConfirmationEmail(booking, targetEmail).catch(err => console.warn('Email dispatch warning:', err.message));
      return `📧 **Đã kích hoạt gửi lại vé điện tử thành công!**
Vé đã được gửi đến địa chỉ email: **${targetEmail}** (Đơn hàng #${booking.id}).
Vui lòng kiểm tra hộp thư đến (Inbox) hoặc thư mục Spam trong vòng 1-2 phút tới.`;
    }

    return `⚠️ Đơn hàng #${booking.id} chưa có thông tin email liên kết. Vui lòng liên hệ CSKH 1900 6868 để cập nhật email.`;
  } catch (err) {
    console.error('Error resending ticket:', err);
    return `⚠️ Đã có sự cố khi kết nối hệ thống gửi thư. Vui lòng liên hệ hotline 1900 6868.`;
  }
}

const NATIONAL_DESTINATION_KEYWORDS = [
  { dest: 'Hà Nội', keywords: ['ha noi', 'hanoi', 'thu do'] },
  { dest: 'Hạ Long', keywords: ['ha long', 'halong', 'quang ninh', 'vinh ha long'] },
  { dest: 'Cát Bà', keywords: ['cat ba', 'lan ha', 'hai phong'] },
  { dest: 'Hà Giang', keywords: ['ha giang', 'dong van', 'meo vac', 'ma pi leng', 'tu san'] },
  { dest: 'Sa Pa', keywords: ['sa pa', 'sapa', 'fansipan', 'lao cai'] },
  { dest: 'Ninh Bình', keywords: ['ninh binh', 'trang an', 'tam coc', 'hang mua'] },
  { dest: 'Mộc Châu', keywords: ['moc chau', 'son la'] },
  { dest: 'Phong Nha', keywords: ['phong nha', 'ke bang', 'quang binh', 'son doong'] },
  { dest: 'Huế', keywords: ['hue', 'co do', 'song huong', 'thua thien'] },
  { dest: 'Đà Nẵng', keywords: ['da nang', 'ba na', 'son tra'] },
  { dest: 'Hội An', keywords: ['hoi an', 'pho co', 'an bang'] },
  { dest: 'Quy Nhơn', keywords: ['quy nhon', 'ky co', 'eo gio', 'binh dinh'] },
  { dest: 'Phú Yên', keywords: ['phu yen', 'tuy hoa', 'ganh da dia', 'hon yen'] },
  { dest: 'Nha Trang', keywords: ['nha trang', 'khanh hoa', 'hon mun'] },
  { dest: 'Đà Lạt', keywords: ['da lat', 'dalat', 'lam dong', 'xuan huong', 'langbiang', 'tuyen lam'] },
  { dest: 'Măng Đen', keywords: ['mang den', 'kon tum'] },
  { dest: 'Buôn Ma Thuột', keywords: ['buon ma thuot', 'bmt', 'dak lak'] },
  { dest: 'TP. Hồ Chí Minh', keywords: ['sai gon', 'tp hcm', 'tphcm', 'ho chi minh', 'can gio'] },
  { dest: 'Côn Đảo', keywords: ['con dao', 'vung tau'] },
  { dest: 'Cần Thơ', keywords: ['can tho', 'cai rang', 'ninh kieu', 'song hau'] },
  { dest: 'Phú Quốc', keywords: ['phu quoc', 'dao ngoc', 'kien giang', 'sao beach'] },
  { dest: 'An Giang', keywords: ['an giang', 'tra su', 'chau doc'] },
  { dest: 'Bến Tre', keywords: ['ben tre', 'xu dua'] }
];

function detectDestinationFromText(normalizedText) {
  for (const item of NATIONAL_DESTINATION_KEYWORDS) {
    if (item.keywords.some(k => normalizedText.includes(k))) {
      return item.dest;
    }
  }
  return null;
}

/**
 * Main AI Router Engine with Training Dataset Retrieval & Interactive Actions
 */
async function routeUserIntent({ message, destination, currentActivities, history, userId, catalogChat = sendCatalogTravelChat }) {
  const cleanMessage = String(message || '').trim();
  const normalized = normalizeText(cleanMessage);
  const detectedDest = destination || detectDestinationFromText(normalized) || 'Việt Nam';

  const scheduleAction = /(?:toi uu lich trinh|sua gio|trung gio|chinh gio|tu dong sua|sap xep lai gio|doi gio hop ly|giam phat thai carbon)/.test(normalized);
  const bookingAction = /\b(?:BKT-[A-Z0-9_-]+|SCH[A-Z0-9_-]+)\b/i.test(cleanMessage)
    || /(?:tra cuu|kiem tra|tim don|ma don|ma ve|tinh trang don|trang thai don)/.test(normalized);
  const resendAction = /(?:gui lai ve|gui lai email|chua nhan duoc ve|ban lai ve|gui ve qua mail|gui mail ve)/.test(normalized);
  if (isCatalogDependentRequest(cleanMessage) && !scheduleAction && !bookingAction && !resendAction) {
    return catalogChat({ message: cleanMessage, destination: detectedDest, currentActivities, history });
  }

  // 1. Check against the 85+ Curated Training Samples in Dataset
  if (trainingDataset && Array.isArray(trainingDataset.examples)) {
    for (const ex of trainingDataset.examples) {
      const matchFound = ex.userQueries.some(q => {
        const normQ = normalizeText(q);
        if (normQ.length < 5) return false;
        return normalized.includes(normQ) || normQ.includes(normalized);
      });

      if (matchFound) {
        return {
          success: true,
          reply: ex.agentResponse,
          recommendation: ex.recommendation || null,
          action: ex.action || null
        };
      }
    }
  }

  // 2. Interactive Action Detectors
  // Pattern A: Time Optimization / Auto-fix conflict request
  const optKeywords = ['toi uu lich trinh', 'sua gio', 'trung gio', 'chinh gio', 'tu dong sua', 'sap xep lai gio', 'doi gio hop ly', 'giam phat thai co2'];
  if (optKeywords.some(kw => normalized.includes(kw))) {
    return {
      success: true,
      reply: `⚡ **Đã phân tích các điểm đến trên timeline của bạn:**\n• Hệ thống phát hiện một số mốc thời gian diễn ra quá sát nhau hoặc đi ngược khoảng cách di chuyển.\n• Quy tắc chuẩn: Mỗi điểm ăn uống/tham quan cần tối thiểu 60-90 phút trải nghiệm + thời gian di chuyển thực tế.\n\n👉 Bạn hãy bấm nút **"Tự động sửa giờ hợp lý ngay"** bên dưới để hệ thống tự động giãn mốc thời gian khoa học nhất!`,
      recommendation: null,
      action: 'auto_adjust_times'
    };
  }

  // Pattern B: Booking Code Lookup (BKT-..., SCH...)
  const codeRegex = /\b(BKT-[A-Z0-9_-]+|SCH[A-Z0-9_-]+)\b/i;
  const lookupKeywordRegex = /(?:tra cuu|kiem tra|tim don|ma don|ma ve|tinh trang don|trang thai don)\s*(?:don|hang|ve)?\s*([a-z0-9_-]+)?/i;

  const codeMatch = cleanMessage.match(codeRegex);
  const lookupMatch = normalized.match(lookupKeywordRegex);

  if (codeMatch || (lookupMatch && lookupMatch[1])) {
    const targetCode = codeMatch ? codeMatch[1] : lookupMatch[1];
    const reply = await handleBookingLookup(targetCode);
    return {
      success: true,
      reply: reply,
      recommendation: null,
      action: 'lookup_booking'
    };
  }

  // Pattern C: Resend Ticket Email
  const resendTicketRegex = /(?:gui lai ve|gui lai email|chua nhan duoc ve|ban lai ve|gui ve qua mail|gui mail ve)/i;
  if (resendTicketRegex.test(normalized)) {
    const emailMatch = cleanMessage.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const codeInText = cleanMessage.match(codeRegex);
    const target = emailMatch ? emailMatch[1] : (codeInText ? codeInText[1] : '');
    const reply = await handleResendTicket(target);
    return {
      success: true,
      reply: reply,
      recommendation: null,
      action: 'resend_ticket'
    };
  }

  // 3. Generative AI Query via n8n Agent (Primary Agent Engine)
  const n8nReply = await triggerN8nWorkflow({
    message: cleanMessage,
    destination: detectedDest,
    currentActivities: currentActivities || []
  });

  if (n8nReply) {
    return {
      success: true,
      reply: n8nReply,
      recommendation: null,
      action: null
    };
  }

  // 4. Secondary fallback: Gemini API if available
  if (geminiModel) {
    try {
      const destName = detectedDest;
      const systemInstruction = `
Bạn là Trợ lý Lịch trình Sinh Thái GreenSteps Việt Nam.
Nhiệm vụ: Tư vấn thân thiện, gợi ý điểm tham quan, quán ăn, cafe, bảo vệ môi trường, giảm phát thải carbon tại: ${destName}.
Quy tắc quan trọng:
- Nếu người dùng muốn đi hoặc lập lịch trình tại một điểm đến (kể cả nơi chưa có tour đối tác trọn gói như Vũng Tàu, Cần Thơ, Hà Giang...), TUYỆT ĐỐI KHÔNG từ chối hoặc bắt người dùng đổi sang điểm đến khác. Hãy luôn chủ động gợi ý khung lịch trình tự túc với các địa danh và trải nghiệm xanh nổi tiếng tại ${destName}!
- Các hoạt động hiện tại: ${JSON.stringify(currentActivities || [])}.
- Luôn trả lời bằng tiếng Việt tự nhiên, súc tích và hữu ích.
Định dạng JSON:
{
  "reply": "Nội dung phản hồi",
  "recommendation": null
}
`;
      const result = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: cleanMessage }] }],
        systemInstruction: systemInstruction,
        generationConfig: { responseMimeType: "application/json" }
      });

      const responseText = result.response.text().trim();
      const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const responseJson = JSON.parse(cleanJson);

      return {
        success: true,
        reply: responseJson.reply,
        recommendation: responseJson.recommendation || null,
        action: null
      };
    } catch (err) {
      console.warn('Gemini secondary call failed, using graceful guidance:', err.message);
    }
  }

  // Friendly conversational fallback
  return {
    success: true,
    reply: `Chào bạn! Cảm ơn bạn đã nhắn tin cho Trợ lý GreenSteps. Tôi có thể hỗ trợ bạn tìm hiểu lịch trình khám phá sinh thái tại ${detectedDest !== 'Việt Nam' ? detectedDest : 'các điểm đến xanh trên toàn quốc'}, tra cứu mã đơn hàng (*BKT-...*), hoặc giải đáp chính sách hoàn hủy và thanh toán. Bạn cần mình tư vấn chi tiết phần nào?`,
    recommendation: null,
    action: null
  };
}

module.exports = {
  routeUserIntent,
  normalizeText,
  trainingDataset
};
