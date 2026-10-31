const { randomUUID } = require('node:crypto');
const {
  store,
  CommentPost,
  ServiceBooking,
  TourBooking,
  GreenService,
  ScheduleSample,
  CPGS,
  CPSS
} = require('../models');

function reviewError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function validateReview({ userId, role, bookingId, targetId, rating, text }) {
  if (!userId) throw reviewError('Đăng nhập để gửi đánh giá.', 401);
  if (role !== 'traveler') throw reviewError('Chỉ tài khoản khách hàng được gửi đánh giá.', 403);
  if (typeof bookingId !== 'string' || !bookingId.trim() || typeof targetId !== 'string' || !targetId.trim()) {
    throw reviewError('Thiếu booking hoặc tour/dịch vụ cần đánh giá.', 400);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw reviewError('Điểm đánh giá phải là số nguyên từ 1 đến 5.', 400);
  }
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 5000) {
    throw reviewError('Nội dung đánh giá không được để trống và tối đa 5000 ký tự.', 400);
  }
}

async function createBookingReview({ type, bookingId, targetId, userId, role, rating, text }) {
  validateReview({ userId, role, bookingId, targetId, rating, text });
  if (!['tour', 'service'].includes(type)) throw reviewError('Loại đánh giá không hợp lệ.', 400);

  try {
    return await store.transaction(async transaction => {
      const bookingModel = type === 'tour' ? TourBooking : ServiceBooking;
      const targetField = type === 'tour' ? 'schedule_id' : 'service_id';
      const booking = await bookingModel.findByPk(bookingId, { transaction });
      if (!booking) throw reviewError('Không tìm thấy booking.', 404);
      if (booking.user_id !== userId) throw reviewError('Booking không thuộc tài khoản này.', 403);
      if (booking.status !== 'completed') throw reviewError('Chỉ booking đã hoàn thành mới được đánh giá.', 400);
      if (booking[targetField] !== targetId) throw reviewError('Booking không thuộc tour/dịch vụ đang đánh giá.', 400);

      const targetModel = type === 'tour' ? ScheduleSample : GreenService;
      const target = await targetModel.findByPk(targetId, { transaction });
      if (!target) throw reviewError('Không tìm thấy tour/dịch vụ.', 404);

      const existing = await CommentPost.findOne({ where: { booking_id: booking.id }, transaction });
      if (existing) throw reviewError('Booking này đã được đánh giá.', 409);

      const reviewId = `review_${randomUUID()}`;
      const comment = await CommentPost.create({
        id: reviewId,
        user_id: userId,
        booking_id: booking.id,
        rating,
        text: text.trim(),
        ...(type === 'tour' ? { tour_id: targetId } : { service_id: targetId })
      }, { transaction });

      if (type === 'tour') {
        await CPSS.create({ comment_id: comment.id, schedule_sample_id: targetId }, { transaction });
      } else {
        await CPGS.create({ comment_id: comment.id, service_id: targetId }, { transaction });
      }

      const updatedTarget = await targetModel.findByPk(targetId, { transaction });
      return {
        type,
        booking,
        target: updatedTarget || target,
        comment,
        rating: updatedTarget?.rating ?? null,
        reviews_count: type === 'tour'
          ? Number(updatedTarget?.votes_count || 0)
          : Number(updatedTarget?.reviews_count || 0)
      };
    });
  } catch (error) {
    if (error.code === 11000) {
      throw reviewError('Booking này đã được đánh giá.', 409);
    }
    throw error;
  }
}

module.exports = { createBookingReview };
