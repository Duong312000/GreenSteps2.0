const express = require('express');
const router = express.Router();
const { Review, Booking, User, Service, Schedule, Provider } = require('../models');

const userIdFrom = req => req.session?.user?.id || req.session?.user?._id || req.body.userId || req.body.user_id;

function asClientReview(review) {
  const user = review.user_id && typeof review.user_id === 'object' ? review.user_id : null;
  return {
    id: String(review._id),
    rating: review.rating,
    text: review.comment,
    image_url: review.images?.[0] || '',
    createdAt: review.created_at,
    likesCount: review.likes_count || 0,
    user: user ? {
      id: String(user._id),
      fullname: user.profile?.fullname || user.username || 'Khách du lịch',
      avatar: user.profile?.avatarUrl || ''
    } : { fullname: 'Khách du lịch' },
    replies: (review.replies || []).map(reply => {
      const replyUser = reply.user_id && typeof reply.user_id === 'object' ? reply.user_id : null;
      return {
        id: String(reply._id),
        text: reply.text,
        createdAt: reply.created_at,
        user: replyUser ? {
          id: String(replyUser._id),
          fullname: replyUser.profile?.fullname || replyUser.username || 'Người dùng',
          avatar: replyUser.profile?.avatarUrl || ''
        } : { fullname: 'Người dùng' }
      };
    })
  };
}

async function getTargetReviews(targetField, targetId, res) {
  try {
    const reviews = await Review.find({ [targetField]: targetId, rating: { $ne: null } })
      .populate('user_id', 'username profile.fullname profile.avatarUrl')
      .populate('replies.user_id', 'username profile.fullname profile.avatarUrl')
      .sort({ created_at: -1 });
    return res.json(reviews.map(asClientReview));
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể tải đánh giá', error: error.message });
  }
}

async function refreshRating(targetField, targetId, model) {
  const [stats] = await Review.aggregate([
    { $match: { [targetField]: targetId, rating: { $ne: null } } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const rating = stats ? Math.round(stats.average * 10) / 10 : 5;
  const count = stats?.count || 0;
  const fields = targetField === 'schedule_id'
    ? { 'sample_details.rating': rating, 'sample_details.votes_count': count }
    : { rating, reviews_count: count };
  await model.updateOne({ _id: targetId }, { $set: fields });
  return { rating, votes_count: count };
}

async function createOrReply(req, res, targetField) {
  try {
    const userId = userIdFrom(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để gửi đánh giá' });

    const { rating, text, comment, parentCommentId, bookingId, booking_id, images } = req.body;
    const content = String(text || comment || '').trim();
    if (!content) return res.status(400).json({ success: false, message: 'Nội dung không được để trống' });

    if (parentCommentId) {
      const parent = await Review.findById(parentCommentId);
      if (!parent) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá cần phản hồi' });
      parent.replies.push({ user_id: userId, text: content });
      await parent.save();
      await parent.populate('replies.user_id', 'username profile.fullname profile.avatarUrl');
      return res.status(201).json({ success: true, message: 'Gửi phản hồi thành công', reply: parent.replies.at(-1) });
    }

    const targetId = targetField === 'schedule_id' ? (req.body.tourId || req.body.schedule_id) : (req.body.serviceId || req.body.service_id);
    if (!targetId) return res.status(400).json({ success: false, message: 'Thiếu dịch vụ hoặc tour cần đánh giá' });
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Số sao phải từ 1 đến 5' });
    }

    const review = await Review.create({
      user_id: userId,
      [targetField]: targetId,
      booking_id: bookingId || booking_id || undefined,
      rating: numericRating,
      comment: content,
      images: Array.isArray(images) ? images : []
    });

    await User.findByIdAndUpdate(userId, { $inc: { 'wallet.green_points': 50 } });
    const targetModel = targetField === 'schedule_id' ? Schedule : Service;
    const stats = await refreshRating(targetField, review[targetField], targetModel);
    return res.status(201).json({ success: true, message: 'Gửi đánh giá thành công', data: review, ...stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu đánh giá', error: error.message });
  }
}

// Compatibility routes used by the Angular tour and service detail pages.
router.get('/tour/:tourId', (req, res) => getTargetReviews('schedule_id', req.params.tourId, res));
router.get('/service/:serviceId', (req, res) => getTargetReviews('service_id', req.params.serviceId, res));
router.post('/tour', (req, res) => createOrReply(req, res, 'schedule_id'));
router.post('/service', (req, res) => createOrReply(req, res, 'service_id'));

router.get('/provider', async (req, res) => {
  try {
    const provider = await Provider.findOne({ user_id: req.query.providerId });
    if (!provider) return res.json([]);
    const services = await Service.find({ provider_id: provider._id }, '_id name type');
    const serviceIds = services.map(service => service._id);
    const filter = { service_id: { $in: serviceIds }, rating: { $ne: null } };
    if (req.query.rating) filter.rating = Number(req.query.rating);
    if (req.query.serviceId) filter.service_id = req.query.serviceId;
    let reviews = await Review.find(filter)
      .populate('user_id', 'username profile.fullname profile.avatarUrl')
      .populate('replies.user_id', 'username profile.fullname profile.avatarUrl')
      .sort({ created_at: -1 });
    if (req.query.answered === 'true') reviews = reviews.filter(r => r.provider_reply?.reply_text);
    if (req.query.answered === 'false') reviews = reviews.filter(r => !r.provider_reply?.reply_text);
    const serviceById = new Map(services.map(s => [String(s._id), s]));
    return res.json(reviews.map(review => ({
      ...asClientReview(review),
      is_reported: review.is_reported,
      report_reason: review.report_reason,
      internal_notes: review.internal_notes,
      provider_reply: review.provider_reply,
      service: serviceById.get(String(review.service_id)) || null
    })));
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể tải đánh giá của đối tác', error: error.message });
  }
});

// Generic list/detail endpoints retained for existing callers.
router.get('/', async (req, res) => {
  try {
    const { service_id, schedule_id, user_id, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (service_id) filter.service_id = service_id;
    if (schedule_id) filter.schedule_id = schedule_id;
    if (user_id) filter.user_id = user_id;
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));
    const safeLimit = Math.min(100, Math.max(1, Number(limit)));
    const [reviews, total] = await Promise.all([
      Review.find(filter).sort({ created_at: -1 }).skip(skip).limit(safeLimit), Review.countDocuments(filter)
    ]);
    return res.json({ success: true, data: reviews, pagination: { page: Number(page), limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy đánh giá', error: error.message });
  }
});

router.post('/:id/like', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { $inc: { likes_count: 1 } }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    return res.json({ success: true, likes: review.likes_count });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể thích đánh giá', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate('user_id', 'username profile.fullname profile.avatarUrl');
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    return res.json({ success: true, data: review });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const { text, reply_text } = req.body;
    const content = String(reply_text || text || '').trim();
    if (!content) return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được để trống' });
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    if (req.body.userId || req.body.user_id) {
      review.replies.push({ user_id: req.body.userId || req.body.user_id, text: content });
    } else {
      review.provider_reply = { reply_text: content, replied_at: new Date() };
    }
    await review.save();
    return res.json({ success: true, message: 'Đã gửi phản hồi đánh giá thành công', data: review });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

router.post('/:id/report', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { $set: { is_reported: true, report_reason: req.body.reason || 'Nội dung không phù hợp' } }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    return res.json({ success: true, message: 'Đã báo cáo đánh giá vi phạm thành công' });
  } catch (error) { return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message }); }
});

router.post('/:id/notes', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { $set: { internal_notes: req.body.notes || '' } }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    return res.json({ success: true, data: review });
  } catch (error) { return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message }); }
});

router.post('/', (req, res) => createOrReply(req, res, req.body.service_id ? 'service_id' : 'schedule_id'));

router.put('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    if (req.body.rating != null) review.rating = Number(req.body.rating);
    if (req.body.comment != null) review.comment = req.body.comment;
    if (req.body.images != null) review.images = req.body.images;
    await review.save();
    return res.json({ success: true, message: 'Cập nhật đánh giá thành công', data: review });
  } catch (error) { return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    return res.json({ success: true, message: 'Đã xóa đánh giá thành công' });
  } catch (error) { return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message }); }
});

module.exports = router;
