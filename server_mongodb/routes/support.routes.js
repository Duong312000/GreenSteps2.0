const express = require('express');
const router = express.Router();
const { SupportTicket, User } = require('../models');

// GET /api/support/tickets - Danh sách ticket hỗ trợ
router.get('/tickets', async (req, res) => {
  try {
    const currentUserId = req.session?.user?.id || req.query.user_id;
    const filter = {};

    // Nếu không phải admin hoặc có chỉ định user_id
    if (req.session?.user?.role !== 'admin' || req.query.user_id) {
      if (currentUserId) {
        filter.user_id = currentUserId;
      }
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const tickets = await SupportTicket.find(filter)
      .populate('user_id', 'full_name email phone')
      .populate('booking_id', 'booking_code total_amount')
      .sort({ updated_at: -1 });

    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error in GET /support/tickets:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// POST /api/support/tickets - Gửi yêu cầu hỗ trợ mới
router.post('/tickets', async (req, res) => {
  try {
    const currentUserId = req.session?.user?.id || req.body.user_id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để gửi yêu cầu hỗ trợ' });
    }

    const { subject, category, booking_id, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề và nội dung cần hỗ trợ' });
    }

    const ticket = new SupportTicket({
      user_id: currentUserId,
      booking_id: booking_id || null,
      subject,
      category: category || 'booking_issue',
      status: 'open',
      messages: [{
        sender: 'customer',
        content: message,
        sent_at: new Date()
      }]
    });

    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Gửi yêu cầu hỗ trợ thành công. Đội ngũ GreenSteps sẽ phản hồi sớm nhất!',
      data: ticket
    });
  } catch (error) {
    console.error('Error in POST /support/tickets:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// GET /api/support/tickets/:id - Chi tiết cuộc hội thoại hỗ trợ
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user_id', 'full_name email phone avatar')
      .populate('booking_id');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hỗ trợ' });
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// POST /api/support/tickets/:id/messages - Gửi tin nhắn phản hồi tiếp theo vào ticket
router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { content, sender } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được rỗng' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hỗ trợ' });
    }

    ticket.messages.push({
      sender: sender || 'customer',
      content,
      sent_at: new Date()
    });

    if (ticket.status === 'closed') {
      ticket.status = 'open';
    }

    await ticket.save();

    res.json({
      success: true,
      message: 'Đã gửi phản hồi',
      data: ticket
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// PUT /api/support/tickets/:id/status - Cập nhật trạng thái ticket
router.put('/tickets/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ticket' });
    }
    res.json({ success: true, message: 'Cập nhật trạng thái thành công', data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// POST /api/support/chat - AI Trợ lý du lịch xanh GreenSteps Bot
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Nội dung chat không được để trống' });
    }

    const lower = message.toLowerCase();
    let reply = '';
    let suggestions = [];

    if (lower.includes('đặt tour') || lower.includes('tour') || lower.includes('giá')) {
      reply = 'GreenSteps cung cấp các tour du lịch sinh thái đạt chuẩn Net-Zero: Trekking Bidoup Đà Lạt, Chèo SUP Hồ Tuyền Lâm, Khám phá biển đảo Phú Yên và Tour di sản Hội An. Bạn có thể xem danh sách tại mục "Tour trọn gói" hoặc dùng tính năng "Lên kế hoạch AI" để tạo lịch trình riêng!';
      suggestions = ['Xem Tour Đà Lạt', 'Tour Phú Yên', 'Lên kế hoạch AI'];
    } else if (lower.includes('hủy') || lower.includes('hoàn tiền') || lower.includes('chính sách')) {
      reply = 'Chính sách hoàn tiền của GreenSteps: Huỷ trước 72 giờ được hoàn 100% vào Ví GreenSteps hoặc tài khoản ngân hàng. Huỷ trước 24 giờ được hoàn 50%. Mọi tiền đặt cọc đều được bảo vệ trong hệ thống Escrow cho đến khi bạn hoàn thành dịch vụ!';
      suggestions = ['Chính sách bảo vệ người dùng', 'Liên hệ hỗ trợ viên'];
    } else if (lower.includes('ví') || lower.includes('thanh toán') || lower.includes('nạp tiền')) {
      reply = 'Ví GreenSteps hỗ trợ thanh toán tức thì không phí, nạp tiền qua VNPay/MoMo/Chuyển khoản QR. Khi thanh toán bằng Ví Green, bạn nhận ngay 5% hoàn tiền bằng Điểm Xanh!';
      suggestions = ['Mở ví GreenSteps', 'Nạp tiền ngay'];
    } else if (lower.includes('điểm xanh') || lower.includes('green points') || lower.includes('giảm giá')) {
      reply = 'Điểm Xanh (Green Points) được tích lũy khi bạn tham gia các hoạt động giảm rác thải, đi xe điện, đánh giá dịch vụ hoặc trồng cây du lịch. 100 Điểm Xanh = 10.000 VNĐ giảm giá cho các tour tiếp theo!';
      suggestions = ['Đổi quà từ Điểm Xanh', 'Xem huy hiệu của tôi'];
    } else {
      reply = 'Chào bạn! Mình là Trợ lý AI của GreenSteps Travel. Mình có thể giúp bạn tìm tour sinh thái, gợi ý chỗ ở homestay bền vững, tính lượng carbon tiết kiệm được và giải đáp các thắc mắc về đặt dịch vụ. Bạn cần hỗ trợ gì hôm nay?';
      suggestions = ['Gợi ý tour 3 ngày 2 đêm', 'Khách sạn sinh thái Đà Lạt', 'Chính sách đặt cọc Escrow'];
    }

    res.json({
      success: true,
      data: {
        reply,
        suggestions,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error in POST /support/chat:', error);
    res.status(500).json({ success: false, message: 'Lỗi chatbot AI', error: error.message });
  }
});

module.exports = router;
