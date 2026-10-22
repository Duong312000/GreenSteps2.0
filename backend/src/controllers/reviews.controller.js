const { CommentPost, User, GreenService, ServiceBooking, TourBooking, Vender } = require('../models/index');
const { Op } = require('sequelize');

// 1. Get all reviews for a provider's services
exports.getProviderReviews = async (req, res, next) => {
  const { providerId, rating, serviceId, answered } = req.query;
  try {
    const vender = await Vender.findOne({ where: { user_id: providerId } });
    const venderId = vender ? vender.id : '';
    
    const services = await GreenService.findAll({ where: { vender_id: venderId } });
    const serviceIds = services.map(s => s.id);
    
    const where = {
      service_id: { [Op.in]: serviceIds },
      parent_comment_id: null
    };
    
    if (rating) {
      where.rating = Number(rating);
    }
    if (serviceId) {
      where.service_id = serviceId;
    }
    
    let comments = await CommentPost.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    
    const mapped = [];
    for (const c of comments) {
      const user = await User.findByPk(c.user_id || c.userId);
      const srv = services.find(s => s.id === c.service_id);
      
      const replies = await CommentPost.findAll({
        where: { parent_comment_id: c.id }
      });
      
      const mappedReplies = [];
      for (const r of replies) {
        const rUser = await User.findByPk(r.user_id || r.userId);
        mappedReplies.push({
          id: r.id,
          text: r.text,
          createdAt: r.createdAt,
          user: rUser ? { id: rUser.id, fullname: rUser.fullname, role: rUser.role } : { fullname: 'Người dùng ẩn danh' }
        });
      }
      
      if (answered === 'true' && replies.length === 0) continue;
      if (answered === 'false' && replies.length > 0) continue;
      
      let booking = null;
      if (c.booking_id) {
        booking = await ServiceBooking.findByPk(c.booking_id);
      }
      
      mapped.push({
        id: c.id,
        rating: c.rating,
        text: c.text,
        image_url: c.image_url,
        createdAt: c.createdAt,
        is_reported: c.is_reported,
        report_reason: c.report_reason,
        internal_notes: c.internal_notes,
        user: user ? { id: user.id, fullname: user.fullname, role: user.role } : { fullname: 'Người dùng ẩn danh' },
        service: srv ? { id: srv.id, name: srv.name_service, type: srv.type } : null,
        replies: mappedReplies,
        booking: booking ? { id: booking.id, date: booking.booking_date, guests: booking.guests } : null
      });
    }
    
    res.json(mapped);
  } catch (error) {
    next(error);
  }
};

// 2. Post a reply to a review
exports.replyToReview = async (req, res, next) => {
  const { commentId } = req.params;
  const { text } = req.body;
  const userId = req.user ? req.user.id : req.body.userId;
  try {
    const parent = await CommentPost.findByPk(commentId);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Đánh giá không tồn tại!' });
    }
    
    const replyId = 'CEPtra_reply_' + Date.now();
    const reply = await CommentPost.create({
      id: replyId,
      text,
      user_id: userId,
      parent_comment_id: commentId,
      tour_id: parent.tour_id,
      service_id: parent.service_id
    });
    
    const user = await User.findByPk(userId);
    res.json({
      success: true,
      message: 'Gửi phản hồi thành công!',
      reply: {
        id: reply.id,
        text: reply.text,
        createdAt: reply.createdAt,
        user: user ? { id: user.id, fullname: user.fullname, role: user.role } : { fullname: 'Đối tác' }
      }
    });
  } catch (error) {
    next(error);
  }
};

// 3. Report a review
exports.reportReview = async (req, res, next) => {
  const { commentId } = req.params;
  const { reason } = req.body;
  try {
    const comment = await CommentPost.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Đánh giá không tồn tại!' });
    }
    comment.is_reported = true;
    comment.report_reason = reason || 'Nội dung không phù hợp';
    await comment.save();
    res.json({ success: true, message: 'Đã báo cáo đánh giá vi phạm thành công!' });
  } catch (error) {
    next(error);
  }
};

// 4. Update internal notes on a review
exports.updateInternalNotes = async (req, res, next) => {
  const { commentId } = req.params;
  const { notes } = req.body;
  try {
    const comment = await CommentPost.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Đánh giá không tồn tại!' });
    }
    comment.internal_notes = notes || '';
    await comment.save();
    res.json({ success: true, message: 'Cập nhật ghi chú nội bộ thành công!', comment });
  } catch (error) {
    next(error);
  }
};
