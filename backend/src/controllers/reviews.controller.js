const {
  CommentPost, User, GreenService, Schedule, ScheduleSample, ServiceBooking, TourBooking,
  Vender, Provider, CPSS, CPGS
} = require('../models/index');
const { Op } = require('../db/mongo-store');
const { randomUUID } = require('node:crypto');

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function requireProvider(req) {
  if (!req.user?.id) throw httpError('Đăng nhập để quản lý đánh giá.', 401);
  if (req.user.role !== 'provider') throw httpError('Chỉ nhà cung cấp được quản lý đánh giá.', 403);
  return req.user.id;
}

async function resolveProviderRecord(userId) {
  const linked = await Provider.findOne({ where: { user_id: userId } });
  if (linked) return linked;

  const user = await User.findByPk(userId);
  if (!user?.company_name) return null;
  const legacyMatches = await Provider.findAll({ where: { name_provider: user.company_name } });
  return legacyMatches.length === 1 ? legacyMatches[0] : null;
}

async function getOwnedTargets(userId) {
  const vender = await Vender.findOne({ where: { user_id: userId } });
  const services = vender ? await GreenService.findAll({ where: { vender_id: vender.id } }) : [];
  const provider = await resolveProviderRecord(userId);
  const tours = provider ? await ScheduleSample.findAll({ where: { provider_id: provider.id } }) : [];
  return { services, tours };
}

async function ownedReviewTarget(userId, comment) {
  if (!comment || comment.parent_comment_id) return null;
  let serviceId = comment.service_id;
  let tourId = comment.tour_id;
  if (!serviceId) {
    const links = await CPGS.findAll({ where: { comment_id: comment.id } });
    if (links.length === 1) serviceId = links[0].service_id;
  }
  if (!tourId) {
    const links = await CPSS.findAll({ where: { comment_id: comment.id } });
    if (links.length === 1) tourId = links[0].schedule_sample_id;
  }

  if (serviceId) {
    const service = await GreenService.findByPk(serviceId);
    const vender = service?.vender_id ? await Vender.findByPk(service.vender_id) : null;
    if (vender?.user_id === userId) return { type: 'service', target: service };
  }
  if (tourId) {
    const [provider, tour] = await Promise.all([
      resolveProviderRecord(userId),
      ScheduleSample.findByPk(tourId)
    ]);
    if (provider && tour?.provider_id === provider.id) return { type: 'tour', target: tour };
  }
  return null;
}

function mapReply(reply, user) {
  return {
    id: reply.id,
    text: reply.text,
    createdAt: reply.createdAt,
    user: user ? { id: user.id, fullname: user.fullname, role: user.role } : { fullname: 'Nhà cung cấp' }
  };
}

exports.getProviderReviews = async (req, res, next) => {
  try {
    const userId = requireProvider(req);
    const { rating, serviceId, tourId, type, answered } = req.query;
    if (rating !== undefined && (!/^([1-5])$/.test(String(rating)))) {
      return res.status(400).json({ success: false, message: 'Bộ lọc số sao phải từ 1 đến 5.' });
    }
    if (type && !['tour', 'service'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại đánh giá không hợp lệ.' });
    }

    const owned = await getOwnedTargets(userId);
    const allServiceIds = owned.services.map(item => item.id);
    const allTourIds = owned.tours.map(item => item.id);
    if (serviceId && !allServiceIds.includes(serviceId)) return res.status(403).json({ success: false, message: 'Dịch vụ không thuộc tài khoản này.' });
    if (tourId && !allTourIds.includes(tourId)) return res.status(403).json({ success: false, message: 'Tour không thuộc tài khoản này.' });

    const serviceIds = serviceId ? [serviceId] : (type === 'tour' ? [] : allServiceIds);
    const tourIds = tourId ? [tourId] : (type === 'service' ? [] : allTourIds);
    if (!serviceIds.length && !tourIds.length) return res.json([]);

    const [serviceLinks, tourLinks] = await Promise.all([
      serviceIds.length ? CPGS.findAll({ where: { service_id: { [Op.in]: serviceIds } } }) : [],
      tourIds.length ? CPSS.findAll({ where: { schedule_sample_id: { [Op.in]: tourIds } } }) : []
    ]);
    const clauses = [];
    if (serviceIds.length) clauses.push({ service_id: { [Op.in]: serviceIds } });
    if (tourIds.length) clauses.push({ tour_id: { [Op.in]: tourIds } });
    const linkedIds = [...serviceLinks, ...tourLinks].map(link => link.comment_id).filter(Boolean);
    if (linkedIds.length) clauses.push({ id: { [Op.in]: linkedIds } });

    const where = { parent_comment_id: null, [Op.or]: clauses };
    if (rating !== undefined) where.rating = Number(rating);
    const comments = await CommentPost.findAll({ where, order: [['createdAt', 'DESC']] });
    const mapped = [];

    for (const comment of comments) {
      const targetInfo = await ownedReviewTarget(userId, comment);
      if (!targetInfo) continue;
      if (type && type !== targetInfo.type) continue;
      if (serviceId && (targetInfo.type !== 'service' || targetInfo.target.id !== serviceId)) continue;
      if (tourId && (targetInfo.type !== 'tour' || targetInfo.target.id !== tourId)) continue;

      const [customer, replyRows] = await Promise.all([
        User.findByPk(comment.user_id),
        CommentPost.findAll({ where: { parent_comment_id: comment.id }, order: [['createdAt', 'ASC']] })
      ]);
      const replies = [];
      let providerReply = null;
      for (const reply of replyRows) {
        const replyUser = await User.findByPk(reply.user_id);
        const mappedReply = mapReply(reply, replyUser);
        replies.push(mappedReply);
        if (replyUser?.role === 'provider' && replyUser.id === userId) providerReply = mappedReply;
      }
      if (answered === 'true' && !providerReply) continue;
      if (answered === 'false' && providerReply) continue;

      let booking = null;
      if (comment.booking_id) {
        booking = targetInfo.type === 'tour'
          ? await TourBooking.findByPk(comment.booking_id)
          : await ServiceBooking.findByPk(comment.booking_id);
      }
      const target = targetInfo.target;
      const schedule = targetInfo.type === 'tour' ? await Schedule.findByPk(target.id) : null;
      const targetView = targetInfo.type === 'tour'
        ? { id: target.id, name: schedule?.tour_name || target.tour_name || target.id, type: 'tour' }
        : { id: target.id, name: target.name_service, type: target.type };
      mapped.push({
        id: comment.id,
        type: targetInfo.type,
        targetId: target.id,
        target: targetView,
        ...(targetInfo.type === 'tour' ? { tour: targetView } : { service: targetView }),
        rating: comment.rating,
        text: comment.text,
        image_url: comment.image_url,
        createdAt: comment.createdAt,
        is_reported: comment.is_reported,
        report_reason: comment.report_reason,
        internal_notes: comment.internal_notes,
        user: customer ? { id: customer.id, fullname: customer.fullname, role: customer.role } : { fullname: 'Người dùng ẩn danh' },
        replies,
        providerReply,
        replied: Boolean(providerReply),
        booking: booking ? { id: booking.id, date: booking.booking_date, guests: booking.guests } : null
      });
    }
    res.json(mapped);
  } catch (error) {
    next(error);
  }
};

exports.replyToReview = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw httpError('Login required to reply to a review.', 401);
    const isProvider = req.user.role === 'provider';
    if (!isProvider && req.user.role !== 'traveler') throw httpError('This account cannot reply to reviews.', 403);
    const { commentId } = req.params;
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 5000) return res.status(400).json({ success: false, message: 'Reply must be nonempty and at most 5000 characters.' });

    const parent = await CommentPost.findByPk(commentId);
    if (!parent) return res.status(404).json({ success: false, message: 'Review not found.' });
    const targetInfo = isProvider
      ? await ownedReviewTarget(userId, parent)
      : parent.parent_comment_id ? null : await publicReviewTarget(parent);
    if (!targetInfo) return res.status(403).json({ success: false, message: 'Review target is unavailable to this account.' });

    if (isProvider) {
      const children = await CommentPost.findAll({ where: { parent_comment_id: commentId } });
      for (const child of children) {
        const author = await User.findByPk(child.user_id);
        if (author?.role === 'provider' && author.id === userId) {
          return res.status(409).json({ success: false, message: 'You have already replied to this review.' });
        }
      }
    }

    const reply = await CommentPost.create({
      id: isProvider ? `provider_reply_${commentId}_${userId}` : `reply_${randomUUID()}`,
      text,
      user_id: userId,
      rating: null,
      parent_comment_id: commentId,
      tour_id: parent.tour_id || (targetInfo.type === 'tour' ? targetInfo.target.id : null),
      service_id: parent.service_id || (targetInfo.type === 'service' ? targetInfo.target.id : null)
    });
    const user = await User.findByPk(userId);
    res.status(201).json({ success: true, reply: mapReply(reply, user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A provider reply already exists for this review.' });
    next(error);
  }
};

async function publicReviewTarget(comment) {
  let serviceId = comment.service_id;
  let tourId = comment.tour_id;
  if (!serviceId) {
    const links = await CPGS.findAll({ where: { comment_id: comment.id } });
    if (links.length === 1) serviceId = links[0].service_id;
  }
  if (!tourId) {
    const links = await CPSS.findAll({ where: { comment_id: comment.id } });
    if (links.length === 1) tourId = links[0].schedule_sample_id;
  }
  if (serviceId) {
    const target = await GreenService.findByPk(serviceId);
    if (target) return { type: 'service', target };
  }
  if (tourId) {
    const target = await ScheduleSample.findByPk(tourId);
    if (target) return { type: 'tour', target };
  }
  return null;
}

async function getOwnedRootReview(req, commentId) {
  const userId = requireProvider(req);
  const comment = await CommentPost.findByPk(commentId);
  if (!comment) throw httpError('Không tìm thấy đánh giá.', 404);
  const target = await ownedReviewTarget(userId, comment);
  if (!target) throw httpError('Đánh giá không thuộc tour/dịch vụ của tài khoản này.', 403);
  return comment;
}

exports.reportReview = async (req, res, next) => {
  try {
    const comment = await getOwnedRootReview(req, req.params.commentId);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 1000) return res.status(400).json({ success: false, message: 'Lý do báo cáo không được để trống và tối đa 1000 ký tự.' });
    comment.is_reported = true;
    comment.report_reason = reason;
    await comment.save();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.updateInternalNotes = async (req, res, next) => {
  try {
    const comment = await getOwnedRootReview(req, req.params.commentId);
    if (typeof req.body.notes !== 'string' || req.body.notes.length > 5000) {
      return res.status(400).json({ success: false, message: 'Ghi chú phải là văn bản tối đa 5000 ký tự.' });
    }
    comment.internal_notes = req.body.notes.trim();
    await comment.save();
    res.json({ success: true, comment });
  } catch (error) {
    next(error);
  }
};
