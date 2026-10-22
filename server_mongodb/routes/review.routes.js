const express = require('express');
const router = express.Router();
const { Review, Booking, User, Service } = require('../models');

// GET /api/reviews - Lấy danh sách đánh giá theo service_id, schedule_id hoặc user_id
router.get('/', async (req, res) => {
  try {
    const { service_id, schedule_id, user_id, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (service_id) filter.service_id = service_id;
    if (schedule_id) filter.schedule_id = schedule_id;
    if (user_id) filter.user_id = user_id;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find(filter)
      .populate('user_id', 'full_name email avatar')
      .populate('service_id', 'name service_type destination')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in GET /reviews:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy đánh giá', error: error.message });
  }
});

// GET /api/reviews/:id - Chi tiết 1 đánh giá
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user_id', 'full_name email avatar')
      .populate('service_id', 'name service_type');

    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// POST /api/reviews - Tạo đánh giá mới (Người dùng đánh giá dịch vụ/tour)
router.post('/', async (req, res) => {
  try {
    const currentUserId = req.session?.user?.id || req.body.user_id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để gửi đánh giá' });
    }

    const { booking_id, service_id, schedule_id, rating, comment, images } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp số sao đánh giá và nội dung nhận xét' });
    }

    // Kiểm tra booking nếu có
    if (booking_id) {
      const booking = await Booking.findById(booking_id);
      if (booking) {
        // Cập nhật trạng thái booking hoặc gắn cờ đã đánh giá
        booking.has_review = true;
        await booking.save();
      }
    }

    const review = new Review({
      booking_id: booking_id || null,
      service_id: service_id || null,
      schedule_id: schedule_id || null,
      user_id: currentUserId,
      rating: Number(rating),
      comment,
      images: Array.isArray(images) ? images : []
    });

    await review.save();

    // Thưởng 50 điểm xanh (green_points) cho người dùng khi để lại đánh giá bảo vệ môi trường
    await User.findByIdAndUpdate(currentUserId, {
      $inc: { green_points: 50 }
    });

    res.status(201).json({
      success: true,
      message: 'Gửi đánh giá thành công! Bạn nhận được +50 điểm xanh GreenSteps.',
      data: review
    });
  } catch (error) {
    console.error('Error in POST /reviews:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lưu đánh giá', error: error.message });
  }
});

// POST /api/reviews/:id/reply - Nhà cung cấp phản hồi đánh giá
router.post('/:id/reply', async (req, res) => {
  try {
    const { reply_text } = req.body;
    if (!reply_text) {
      return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được để trống' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    review.provider_reply = {
      reply_text,
      replied_at: new Date()
    };

    await review.save();

    res.json({
      success: true,
      message: 'Đã gửi phản hồi đánh giá thành công',
      data: review
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// PUT /api/reviews/:id - Sửa đánh giá
router.put('/:id', async (req, res) => {
  try {
    const { rating, comment, images } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    if (rating) review.rating = Number(rating);
    if (comment) review.comment = comment;
    if (images) review.images = images;

    await review.save();
    res.json({ success: true, message: 'Cập nhật đánh giá thành công', data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// DELETE /api/reviews/:id - Xoá đánh giá
router.delete('/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }
    res.json({ success: true, message: 'Đã xoá đánh giá thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;
