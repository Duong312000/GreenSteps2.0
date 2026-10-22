const { Op } = require('sequelize');
const { FAQ, AdCampaign, GreenService } = require('../models/index');
const { geminiModel } = require('../config/gemini');

exports.chat = async (req, res, next) => {
  const { message, destination, currentActivities } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống!' });
  }

  try {
    // 1. FAQ router: check if message matches question in CSDL
    const cleanMessage = message.trim();
    const matchedFaq = await FAQ.findOne({
      where: {
        question: {
          [Op.iLike]: `%${cleanMessage}%`
        }
      }
    });

    if (matchedFaq) {
      return res.json({
        success: true,
        reply: matchedFaq.answer,
        recommendation: null
      });
    }

    // 2. If no FAQ match, routing to Gemini AI with injected sponsored campaigns
    if (!geminiModel) {
      // Fallback if no Gemini API key configured
      return res.json({
        success: true,
        reply: `Chào bạn! Cảm ơn bạn đã quan tâm đến du lịch sinh thái tại ${destination || 'Đà Lạt'}. Hiện tại AI Chatbot của chúng tôi đang bảo trì kết nối thông minh. Bạn có thể tham khảo các câu hỏi thường gặp FAQ trên trang hoặc liên hệ quản trị viên!`,
        recommendation: null
      });
    }

    // Fetch sponsored green services (AdCampaign status = active) at this destination
    const destName = destination || 'Đà Lạt';
    const sponsoredCampaigns = await AdCampaign.findAll({
      where: { status: 'active' },
      include: [{
        model: GreenService,
        where: { destination: { [Op.iLike]: `%${destName}%` } }
      }]
    });

    let sponsoredListPrompt = '';
    if (sponsoredCampaigns && sponsoredCampaigns.length > 0) {
      sponsoredListPrompt = 'BẮT BUỘC: Bạn hãy lồng ghép khéo léo và ưu tiên giới thiệu một trong các dịch vụ xanh được tài trợ quảng cáo sau đây vào câu trả lời của mình:\n';
      sponsoredCampaigns.forEach((camp, idx) => {
        const svc = camp.GreenService;
        sponsoredListPrompt += `- Dịch vụ: "${svc.name_service}" (Loại: ${svc.type}, Chi phí: ${svc.cost}đ, Lượng carbon: ${svc.carbon}kg, Tọa độ: ${svc.current_data ? svc.current_data.lat : ''}, ${svc.current_data ? svc.current_data.lng : ''})\n`;
      });
    }

    const systemInstruction = `
Bạn là trợ lý ảo AI cao cấp của ứng dụng du lịch sinh thái GreenSteps Việt Nam.
Nhiệm vụ của bạn là hỗ trợ người dùng lên lịch trình du lịch xanh tại điểm đến: ${destName}.
Các hoạt động hiện tại trong ngày của họ là: ${JSON.stringify(currentActivities || [])}.

${sponsoredListPrompt}

Hãy gợi ý các quán ăn địa phương, nhà hàng, khách sạn hoặc địa điểm tham quan tự nhiên, bảo vệ môi trường, giảm phát thải carbon tại điểm đến.
Hãy phản hồi thân thiện, ngắn gọn và hữu ích (viết bằng tiếng Việt tự nhiên).

BẮT BUỘC trả về kết quả dưới định dạng JSON duy nhất, tuân thủ đúng cấu trúc JSON sau:
{
  "reply": "Nội dung phản hồi văn bản của bạn gửi cho khách hàng",
  "recommendation": {
    "name": "Tên địa điểm/dịch vụ xanh cụ thể mà bạn gợi ý (Nếu lồng ghép dịch vụ tài trợ quảng cáo ở trên, hãy điền đúng Tên dịch vụ)",
    "type": "dining" | "lodging" | "attraction",
    "cost": số_tiền_ước_tính_VND_số_nguyên (nếu miễn phí điền 0),
    "carbon": lượng_CO2_ước_tính_kg_số_thực,
    "lat": vĩ_độ_địa_lý_số_thực (phải phù hợp với điểm đến ${destName}),
    "lng": kinh_độ_địa_lý_số_thực (phải phù hợp với điểm đến ${destName})
  }
}

Nếu không có gợi ý địa điểm cụ thể hoặc chỉ chat chào hỏi thông thường, hãy đặt trường "recommendation" là null.
`;

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const responseJson = JSON.parse(cleanJson);

    res.json({
      success: true,
      reply: responseJson.reply,
      recommendation: responseJson.recommendation
    });
  } catch (error) {
    console.error('Gemini AI execution failed:', error);
    
    // Check for 429/quota exceeded error
    const isRateLimit = error.status === 429 || 
                       String(error.message || '').toLowerCase().includes('quota') ||
                       String(error.message || '').toLowerCase().includes('429') ||
                       String(error.statusText || '').toLowerCase().includes('too many requests');

    if (isRateLimit) {
      return res.json({
        success: true,
        reply: 'Chào bạn! Cảm ơn bạn đã nhắn tin. Hiện tại số lượng yêu cầu gửi đến AI Chatbot của GreenSteps đã vượt quá hạn mức miễn phí trong ngày. Bạn vui lòng thử lại sau ít phút nhé!',
        recommendation: null
      });
    }

    // Default friendly AI fallback response
    return res.json({
      success: true,
      reply: 'Chào bạn! Kết nối đến trợ lý ảo AI của GreenSteps đang bị gián đoạn tạm thời. Bạn vui lòng thử lại sau ít phút hoặc tra cứu các điểm đến trên hệ thống nhé!',
      recommendation: null
    });
  }
};
