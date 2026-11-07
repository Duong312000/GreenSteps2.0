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

function normalizeRating(rating) {
  if (rating === null || rating === undefined || rating === '') return null;
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw reviewError('Điểm đánh giá phải là số nguyên từ 1 đến 5.', 400);
  }
  return value;
}

function validateText(text) {
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 5000) {
    throw reviewError('Nội dung không được để trống và tối đa 5000 ký tự.', 400);
  }
}

/**
 * Create a root review / comment on a tour or service.
 * - Any logged-in user may comment (rating optional).
 * - A user may give a star rating only once per tour/service.
 * - If a completed bookingId is supplied, the review is marked as verified.
 */
async function createBookingReview({ type, bookingId, targetId, userId, role, rating, text }) {
  if (!userId) throw reviewError('Đăng nhập để gửi đánh giá.', 401);
  if (!['tour', 'service'].includes(type)) throw reviewError('Loại đánh giá không hợp lệ.', 400);
  if (typeof targetId !== 'string' || !targetId.trim()) {
    throw reviewError('Thiếu tour/dịch vụ cần đánh giá.', 400);
  }
  validateText(text);
  const normalizedRating = normalizeRating(rating);
  const targetField = type === 'tour' ? 'tour_id' : 'service_id';

  try {
    return await store.transaction(async transaction => {
      const targetModel = type === 'tour' ? ScheduleSample : GreenService;
      const target = await targetModel.findByPk(targetId, { transaction });
      if (!target) throw reviewError('Không tìm thấy tour/dịch vụ.', 404);

      let booking = null;
      if (bookingId) {
        const bookingModel = type === 'tour' ? TourBooking : ServiceBooking;
        const bookingTargetField = type === 'tour' ? 'schedule_id' : 'service_id';
        booking = await bookingModel.findByPk(bookingId, { transaction });
        if (!booking) throw reviewError('Không tìm thấy booking.', 404);
        if (booking.user_id !== userId) throw reviewError('Booking không thuộc tài khoản này.', 403);
        if (booking.status !== 'completed') throw reviewError('Chỉ booking đã hoàn thành mới được đánh giá.', 400);
        if (booking[bookingTargetField] !== targetId) throw reviewError('Booking không thuộc tour/dịch vụ đang đánh giá.', 400);
        const existingBookingReview = await CommentPost.findOne({ where: { booking_id: booking.id }, transaction });
        if (existingBookingReview) throw reviewError('Booking này đã được đánh giá.', 409);
      }

      if (normalizedRating !== null) {
        const userRatings = await CommentPost.findAll({ where: { user_id: userId, [targetField]: targetId }, transaction });
        if (userRatings.some(c => !c.parent_comment_id && c.rating !== null && c.rating !== undefined)) {
          throw reviewError('Bạn đã chấm điểm mục này rồi. Bạn vẫn có thể bình luận không kèm số sao.', 409);
        }
      }

      const comment = await CommentPost.create({
        id: `review_${randomUUID()}`,
        user_id: userId,
        booking_id: booking ? booking.id : null,
        is_verified: !!booking,
        rating: normalizedRating,
        text: text.trim(),
        parent_comment_id: null,
        [targetField]: targetId
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

/** Reply to an existing root review/comment of a tour or service. */
async function createReply({ type, targetId, parentCommentId, userId, text }) {
  if (!userId) throw reviewError('Đăng nhập để gửi phản hồi.', 401);
  validateText(text);
  const parent = await CommentPost.findByPk(parentCommentId);
  if (!parent || parent.parent_comment_id) throw reviewError('Không tìm thấy bình luận gốc.', 404);
  const targetField = type === 'tour' ? 'tour_id' : 'service_id';
  if (targetId && parent[targetField] && parent[targetField] !== targetId) {
    throw reviewError('Bình luận không thuộc mục này.', 400);
  }
  return CommentPost.create({
    id: `reply_${randomUUID()}`,
    user_id: userId,
    rating: null,
    text: text.trim(),
    parent_comment_id: parentCommentId,
    [targetField]: parent[targetField] || targetId
  });
}

module.exports = { createBookingReview, createReply };
