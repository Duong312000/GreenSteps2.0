const { randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const { Op, filter } = require('../db/mongo-store');
const {
  store, User, AdminAuditLog, Provider, ServiceBooking, TourBooking,
  CommentPost, Vender, VenderContract, GreenService, ScheduleSample
} = require('../models');
const otpService = require('../services/otp.service');

const ACCOUNT_STATUSES = new Set(['active', 'suspended', 'deactivated']);
const ROLES = new Set(['traveler', 'provider', 'admin']);
const MUTABLE_PROFILE_FIELDS = new Set(['fullname', 'phone', 'dob', 'gender', 'address']);
const SAFE_USER_FIELDS = [
  'id', 'username', 'fullname', 'email', 'phone', 'role', 'is_verified',
  'account_status', 'account_status_reason', 'account_status_changed_by',
  'account_status_changed_at', 'last_login_at', 'dob', 'gender', 'address',
  'avatarUrl', 'createdAt', 'updatedAt'
];
const ADMIN_USER_LIST_FIELDS = [
  'id', 'username', 'fullname', 'email', 'phone', 'role', 'is_verified',
  'account_status', 'last_login_at', 'avatarUrl', 'createdAt'
];

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function requireAdmin(req, res) {
  if (req.user?.role === 'admin' && req.user?.id) return true;
  fail(res, 403, 'Bạn không có quyền quản lý người dùng.');
  return false;
}

function normalizeReason(value) {
  return typeof value === 'string' ? value.trim().slice(0, 1000) : '';
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function userWhere(query = {}) {
  const clauses = [];
  const role = String(query.role || '').trim();
  if (ROLES.has(role)) clauses.push({ role });

  const status = String(query.status || '').trim();
  if (status === 'active') {
    clauses.push({ is_verified: true });
    clauses.push({ [Op.or]: [{ account_status: 'active' }, { account_status: null }] });
  }
  else if (ACCOUNT_STATUSES.has(status)) clauses.push({ account_status: status });
  else if (status === 'unverified') clauses.push({ is_verified: false });

  const start = query.startDate ? new Date(query.startDate) : null;
  const end = query.endDate ? new Date(query.endDate) : null;
  if ((start && !Number.isNaN(start.getTime())) || (end && !Number.isNaN(end.getTime()))) {
    const createdAt = {};
    if (start && !Number.isNaN(start.getTime())) createdAt[Op.gte] = start;
    if (end && !Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      createdAt[Op.lte] = end;
    }
    clauses.push({ createdAt });
  }

  const term = String(query.search || '').trim().slice(0, 100);
  if (term) {
    const contains = `%${term}%`;
    clauses.push({ [Op.or]: [
      { id: { [Op.iLike]: contains } },
      { username: { [Op.iLike]: contains } },
      { fullname: { [Op.iLike]: contains } },
      { email: { [Op.iLike]: contains } },
      { phone: { [Op.iLike]: contains } }
    ] });
  }
  if (clauses.length > 1) return { [Op.and]: clauses };
  return clauses[0] || {};
}

function pageParams(query = {}) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1));
  const requestedLimit = Number.parseInt(query.limit, 10) || 10;
  const limit = [10, 20, 50].includes(requestedLimit) ? requestedLimit : 10;
  const sortField = ['createdAt', 'last_login_at', 'fullname', 'email'].includes(query.sort) ? query.sort : 'createdAt';
  const direction = String(query.order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { page, limit, offset: (page - 1) * limit, order: [[sortField, direction]] };
}

function safeUser(user) {
  if (!user) return null;
  const result = {};
  for (const key of SAFE_USER_FIELDS) if (user[key] !== undefined) result[key] = user[key];
  if (result.account_status === undefined) result.account_status = 'active';
  return result;
}

function auditState(user) {
  return {
    role: user.role,
    account_status: user.account_status || 'active',
    fullname: user.fullname,
    email: user.email,
    phone: user.phone
  };
}

async function writeAudit({ actorId, targetId, action, reason, previousState, newState, transaction }) {
  return AdminAuditLog.create({
    actor_id: actorId,
    target_user_id: targetId,
    action,
    reason,
    previous_state: previousState,
    new_state: newState,
    result: 'success'
  }, { transaction });
}

async function runAdminMutation(callback) {
  let transaction;
  try {
    transaction = await store.transaction();
  } catch (error) {
    if (error.statusCode === 503 && /replica set/i.test(error.message || '')) return callback(undefined);
    throw error;
  }
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    try { await transaction.rollback(); } catch { /* preserve the mutation error */ }
    throw error;
  }
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

exports.listUsers = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const where = userWhere(req.query);
    const page = pageParams(req.query);
    const [data, total] = await Promise.all([
      User.findAll({ where, attributes: ADMIN_USER_LIST_FIELDS, order: page.order, limit: page.limit, offset: page.offset }),
      User.count({ where })
    ]);
    const ids = data.map(user => user.id);
    const bookingCounts = ids.length ? await ServiceBooking.collection.aggregate([
      { $match: filter({ user_id: { [Op.in]: ids } }) },
      { $group: { _id: '$user_id', count: { $sum: 1 } } },
      { $unionWith: { coll: TourBooking.collectionName, pipeline: [
        { $match: filter({ user_id: { [Op.in]: ids } }) },
        { $group: { _id: '$user_id', count: { $sum: 1 } } }
      ] } },
      { $group: { _id: '$_id', count: { $sum: '$count' } } }
    ], User.store.options()).toArray() : [];
    const countByUser = new Map(bookingCounts.map(row => [row._id, row.count]));
    res.json({
      success: true,
      data: data.map(user => ({ ...safeUser(user), bookingCount: countByUser.get(user.id) || 0 })),
      pagination: { page: page.page, limit: page.limit, total, pages: Math.ceil(total / page.limit) }
    });
  } catch (error) { next(error); }
};

exports.getStats = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [counts = {}] = await User.collection.aggregate([{
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $and: [
          { $eq: ['$is_verified', true] },
          { $eq: [{ $ifNull: ['$account_status', 'active'] }, 'active'] }
        ] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$account_status', 'suspended'] }, 1, 0] } },
        deactivated: { $sum: { $cond: [{ $eq: ['$account_status', 'deactivated'] }, 1, 0] } },
        unverified: { $sum: { $cond: [{ $eq: ['$is_verified', false] }, 1, 0] } }
      }
    }], User.store.options()).toArray();
    const { total = 0, active = 0, suspended = 0, deactivated = 0, unverified = 0 } = counts;
    res.json({
      success: true,
      stats: {
        total, active, suspended, deactivated, unverified,
        activePercent: total ? Math.round(active / total * 1000) / 10 : 0,
        deletionRequests: { available: false, count: null }
      },
      roles: ['traveler', 'provider', 'admin'],
      statuses: ['active', 'suspended', 'deactivated', 'unverified']
    });
  } catch (error) { next(error); }
};

exports.getUser = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password_hash'] } });
    if (!user) return fail(res, 404, 'Không tìm thấy người dùng.');
    const [serviceBookings, tourBookings, reviewStats] = await Promise.all([
      ServiceBooking.count({ where: { user_id: user.id } }),
      TourBooking.count({ where: { user_id: user.id } }),
      CommentPost.ratingStats({ user_id: user.id, rating: { [Op.ne]: null } })
    ]);
    const rating = reviewStats?.[0]?.dataValues || {};
    res.json({
      success: true,
      user: safeUser(user),
      activityStats: {
        bookings: serviceBookings + tourBookings,
        averageRating: rating.avgRating || null,
        reviewCount: rating.votesCount || 0,
        favoriteServices: null
      }
    });
  } catch (error) { next(error); }
};

exports.getActivity = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const page = pageParams(req.query);
    const where = { target_user_id: req.params.id };
    const [data, total] = await Promise.all([
      AdminAuditLog.findAll({ where, order: [['createdAt', 'DESC']], limit: page.limit, offset: page.offset }),
      AdminAuditLog.count({ where })
    ]);
    res.json({ success: true, data, pagination: { page: page.page, limit: page.limit, total, pages: Math.ceil(total / page.limit) } });
  } catch (error) { next(error); }
};

exports.getBookings = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const page = pageParams(req.query);
    const data = await ServiceBooking.collection.aggregate([
      { $match: filter({ user_id: req.params.id }) },
      { $project: { _id: 0, id: 1, type: { $literal: 'service' }, name: { $ifNull: ['$name_service', 'Dịch vụ'] }, bookingDate: '$booking_date', createdAt: 1, amount: '$value', status: 1 } },
      { $unionWith: { coll: TourBooking.collectionName, pipeline: [
        { $match: filter({ user_id: req.params.id }) },
        { $project: { _id: 0, id: 1, type: { $literal: 'tour' }, name: { $ifNull: ['$tour_name', 'Tour'] }, bookingDate: '$booking_date', createdAt: 1, amount: '$value', status: 1 } }
      ] } },
      { $sort: { createdAt: -1, bookingDate: -1 } },
      { $skip: page.offset }, { $limit: page.limit }
    ], User.store.options()).toArray();
    const [serviceCount, tourCount] = await Promise.all([
      ServiceBooking.count({ where: { user_id: req.params.id } }), TourBooking.count({ where: { user_id: req.params.id } })
    ]);
    res.json({ success: true, data, pagination: { page: page.page, limit: page.limit, total: serviceCount + tourCount, pages: Math.ceil((serviceCount + tourCount) / page.limit) } });
  } catch (error) { next(error); }
};

exports.getUserEvents = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const userId = req.params.id;
    const page = pageParams(req.query);
    const [user, serviceBookings, tourBookings, serviceCount, tourCount] = await Promise.all([
      User.findByPk(userId, { attributes: ['id', 'createdAt', 'last_login_at'] }),
      ServiceBooking.collection.aggregate([
        { $match: filter({ user_id: userId }) },
        { $project: { _id: 0, id: 1, type: { $literal: 'service_booking' }, title: { $ifNull: ['$name_service', 'Đặt dịch vụ'] }, status: 1, createdAt: { $ifNull: ['$createdAt', '$booking_date'] } } },
        { $unionWith: { coll: TourBooking.collectionName, pipeline: [
          { $match: filter({ user_id: userId }) },
          { $project: { _id: 0, id: 1, type: { $literal: 'tour_booking' }, title: { $ifNull: ['$tour_name', 'Đặt tour'] }, status: 1, createdAt: { $ifNull: ['$createdAt', '$booking_date'] } } }
        ] } },
        { $sort: { createdAt: -1 } }, { $limit: page.offset + page.limit }
      ], User.store.options()).toArray(),
      ServiceBooking.count({ where: { user_id: userId } }),
      TourBooking.count({ where: { user_id: userId } })
    ]);
    const accountEvents = [
      ...(user?.createdAt ? [{ id: user.id + ':created', type: 'account_created', title: 'Tài khoản được tạo', createdAt: user.createdAt }] : []),
      ...(user?.last_login_at ? [{ id: user.id + ':login', type: 'login', title: 'Đăng nhập gần nhất', createdAt: user.last_login_at }] : [])
    ];
    const allEvents = [...accountEvents, ...serviceBookings].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const total = serviceCount + tourCount + accountEvents.length;
    res.json({
      success: true,
      data: allEvents.slice(page.offset, page.offset + page.limit),
      pagination: { page: page.page, limit: page.limit, total, pages: Math.ceil(total / page.limit) }
    });
  } catch (error) { next(error); }
};

exports.getProvider = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = await User.findByPk(req.params.userId, { attributes: { exclude: ['password_hash'] } });
    if (!user) return fail(res, 404, 'Không tìm thấy tài khoản nhà cung cấp.');
    const [provider, vender, contracts] = await Promise.all([
      Provider.findOne({ where: { user_id: user.id } }),
      Vender.findOne({ where: { user_id: user.id } }),
      VenderContract.findAll({ where: { user_id: user.id }, order: [['createdAt', 'DESC']] })
    ]);
    if (!provider) return fail(res, 404, 'Không tìm thấy hồ sơ nhà cung cấp.');
    const [serviceCount, serviceBookings, tourBookings] = await Promise.all([
      vender ? GreenService.count({ where: { vender_id: vender.id } }) : 0,
      vender ? ServiceBooking.collection.aggregate([
        { $lookup: { from: GreenService.collectionName, localField: 'service_id', foreignField: 'id', as: 'ownedService' } },
        { $match: filter({ 'ownedService.vender_id': vender.id }) },
        { $count: 'count' }
      ], User.store.options()).toArray().then(rows => rows[0]?.count || 0) : 0,
      ScheduleSample.count({ where: { provider_id: provider.id } })
    ]);
    res.json({
      success: true,
      user: safeUser(user),
      provider: { id: provider.id, name_provider: provider.name_provider, field: provider.field, destination: provider.destination, image_url: provider.image_url, provider_status: provider.provider_status, createdAt: provider.createdAt, updatedAt: provider.updatedAt },
      contracts: contracts.map(contract => ({ id: contract.id, name_contract: contract.name_contract, text: contract.text, createdAt: contract.createdAt })),
      businessStats: { services: serviceCount, serviceBookings, tourProducts: tourBookings }
    });
  } catch (error) { next(error); }
};

exports.getProviderServices = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = await User.findByPk(req.params.userId, { attributes: ['id'] });
    if (!user) return fail(res, 404, 'Không tìm thấy tài khoản nhà cung cấp.');
    const vender = await Vender.findOne({ where: { user_id: user.id } });
    if (!vender) return res.json({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
    const page = pageParams(req.query);
    const where = { vender_id: vender.id };
    const [data, total] = await Promise.all([
      GreenService.findAll({ where, attributes: ['id', 'name_service', 'type', 'destination', 'status', 'rating', 'bookings_count', 'createdAt'], order: [['createdAt', 'DESC']], limit: page.limit, offset: page.offset }),
      GreenService.count({ where })
    ]);
    res.json({
      success: true,
      data,
      pagination: { page: page.page, limit: page.limit, total, pages: Math.ceil(total / page.limit) }
    });
  } catch (error) { next(error); }
};

exports.updateProvider = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) return fail(res, 404, 'Không tìm thấy tài khoản nhà cung cấp.');
    const provider = await Provider.findOne({ where: { user_id: user.id } });
    if (!provider) return fail(res, 404, 'Không tìm thấy hồ sơ nhà cung cấp.');
    const reason = normalizeReason(req.body.reason);
    if (!reason) return fail(res, 400, 'Vui lòng nhập lý do cập nhật.');
    const fields = ['fullname', 'phone', 'address'];
    const providerFields = ['name_provider', 'field', 'destination'];
    const changes = {};
    for (const field of fields) if (req.body[field] !== undefined) changes[field] = String(req.body[field] || '').trim().slice(0, 500);
    const providerChanges = {};
    for (const field of providerFields) if (req.body[field] !== undefined) providerChanges[field] = String(req.body[field] || '').trim().slice(0, 500);
    if (!Object.keys(changes).length && !Object.keys(providerChanges).length) return fail(res, 400, 'Không có trường hợp lệ để cập nhật.');
    if ((providerChanges.name_provider !== undefined && !providerChanges.name_provider) || (providerChanges.destination !== undefined && !providerChanges.destination)) return fail(res, 400, 'Tên nhà cung cấp và địa điểm kinh doanh không được để trống.');
    const previousState = { user: auditState(user), provider: { name_provider: provider.name_provider, field: provider.field, destination: provider.destination } };
    Object.assign(user, changes);
    Object.assign(provider, providerChanges);
    await runAdminMutation(async transaction => {
      if (Object.keys(changes).length) await user.save({ transaction });
      if (Object.keys(providerChanges).length) await provider.save({ transaction });
      await writeAudit({ actorId: req.user.id, targetId: user.id, action: 'provider.profile.update', reason, previousState, newState: { user: auditState(user), provider: { name_provider: provider.name_provider, field: provider.field, destination: provider.destination } }, transaction });
    });
    res.json({ success: true });
  } catch (error) { next(error); }
};

async function changeProviderStatus(req, res, next, status) {
  if (!requireAdmin(req, res)) return;
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user || user.role === 'admin') return fail(res, 404, 'Không tìm thấy tài khoản nhà cung cấp.');
    const provider = await Provider.findOne({ where: { user_id: user.id } });
    if (!provider) return fail(res, 404, 'Không tìm thấy hồ sơ nhà cung cấp.');
    if (user.id === req.user.id) return fail(res, 409, 'Không thể khóa tài khoản của chính mình.');
    const reason = normalizeReason(req.body.reason);
    if (!reason) return fail(res, 400, 'Vui lòng nhập lý do thay đổi trạng thái.');
    const oldStatus = user.account_status || 'active';
    if ((status === 'suspended' && oldStatus !== 'active') || (status === 'active' && !['suspended', 'deactivated'].includes(oldStatus))) return fail(res, 409, 'Trạng thái tài khoản đã thay đổi. Hãy tải lại hồ sơ.');
    const previousState = auditState(user);
    user.account_status = status;
    user.account_status_reason = reason;
    user.account_status_changed_by = req.user.id;
    user.account_status_changed_at = new Date();
    await runAdminMutation(async transaction => {
      await user.save({ transaction });
      await writeAudit({ actorId: req.user.id, targetId: user.id, action: status === 'suspended' ? 'provider.account.suspend' : 'provider.account.unsuspend', reason, previousState, newState: auditState(user), transaction });
    });
    res.json({ success: true, user: safeUser(user) });
  } catch (error) { next(error); }
}

exports.suspendProvider = (req, res, next) => changeProviderStatus(req, res, next, 'suspended');
exports.unsuspendProvider = (req, res, next) => changeProviderStatus(req, res, next, 'active');

exports.exportUsers = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    let where = userWhere(req.query);
    const selectedIds = Array.isArray(req.query.id) ? req.query.id : req.query.id ? [req.query.id] : [];
    if (selectedIds.length) where = { [Op.and]: [where, { id: { [Op.in]: selectedIds.slice(0, 500).map(String) } }] };
    const cursor = User.collection.find(filter(where), User.store.options()).sort({ createdAt: -1 }).project({ password_hash: 0, _id: 0, _rev: 0 });
    await AdminAuditLog.create({ actor_id: req.user.id, target_user_id: '*', action: 'users.export', reason: 'Admin exported filtered user list', result: 'success' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="greensteps-users.csv"');
    res.write('\uFEFF' + ['Mã người dùng', 'Tên', 'Email', 'Điện thoại', 'Vai trò', 'Trạng thái', 'Ngày đăng ký'].map(csvCell).join(',') + '\r\n');
    for await (const user of cursor) {
      res.write([user.id, user.fullname, user.email, user.phone, user.role, user.account_status || 'active', user.createdAt].map(csvCell).join(',') + '\r\n');
    }
    res.end();
  } catch (error) { next(error); }
};

exports.createUser = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const fullname = String(req.body.fullname || '').trim().slice(0, 120);
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim().slice(0, 30);
    const reason = normalizeReason(req.body.reason);
    const role = String(req.body.role || 'traveler');
    if (!fullname || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Họ tên hoặc email không hợp lệ.');
    if (!reason) return fail(res, 400, 'Vui lòng nhập lý do tạo tài khoản.');
    if (role !== 'traveler') return fail(res, 400, 'Tài khoản nhà cung cấp phải được tạo qua quy trình đăng ký và xét duyệt hiện có.');
    if (await User.findOne({ where: { email } })) return fail(res, 409, 'Email đã được sử dụng.');

    const base = (email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || 'user');
    let username = base;
    if (await User.findOne({ where: { username } })) username = `${base}_${randomBytes(3).toString('hex')}`;
    const id = `UG${randomBytes(5).toString('hex').toUpperCase()}`;
    const password_hash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    let created;
    await store.transaction(async transaction => {
      created = await User.create({ id, username, password_hash, fullname, email, phone, role, is_verified: true, account_status: 'active' }, { transaction });
      await writeAudit({ actorId: req.user.id, targetId: id, action: 'user.create', reason, previousState: null, newState: auditState(created), transaction });
    });
    let inviteQueued = true;
    await otpService.createAndSendOtp(created, 'RESET_PASSWORD', undefined, { awaitDelivery: true }).catch(async error => {
      inviteQueued = false;
      await AdminAuditLog.create({ actor_id: req.user.id, target_user_id: id, action: 'user.invite_failed', reason: String(error.message || 'Email setup failed').slice(0, 500), previous_state: null, new_state: null, result: 'failure' });
    });
    res.status(201).json({ success: true, user: safeUser(created), inviteQueued, message: inviteQueued ? 'Tài khoản được tạo. Hệ thống đã gửi hướng dẫn đặt mật khẩu qua email.' : 'Tài khoản đã tạo nhưng chưa gửi được email hướng dẫn. Người dùng có thể dùng chức năng Quên mật khẩu.' });
  } catch (error) { next(error); }
};

exports.updateUser = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const reason = normalizeReason(req.body.reason);
    if (!reason) return fail(res, 400, 'Vui lòng nhập lý do cập nhật.');
    const user = await User.findByPk(req.params.id);
    if (!user) return fail(res, 404, 'Không tìm thấy người dùng.');
    if (user.role === 'admin') return fail(res, 409, 'Không thể chỉnh sửa hồ sơ quản trị viên tại đây.');
    const previousState = auditState(user);
    const changes = {};
    for (const field of MUTABLE_PROFILE_FIELDS) {
      if (req.body[field] !== undefined) {
        const value = typeof req.body[field] === 'string' ? req.body[field].trim().slice(0, 500) : req.body[field];
        changes[field] = value === '' && ['gender', 'dob'].includes(field) ? null : value;
      }
    }
    if (!Object.keys(changes).length) return fail(res, 400, 'Không có trường thông tin hợp lệ để cập nhật.');
    if (changes.fullname !== undefined && !changes.fullname) return fail(res, 400, 'Họ tên không được để trống.');
    if (changes.gender != null && !['Nam', 'Nữ', 'Khác'].includes(changes.gender)) return fail(res, 400, 'Giới tính không hợp lệ.');
    if (changes.dob != null && !isValidDateOnly(changes.dob)) return fail(res, 400, 'Ngày sinh không hợp lệ.');
    Object.assign(user, changes);
    await store.transaction(async transaction => {
      await user.save({ transaction });
      await writeAudit({ actorId: req.user.id, targetId: user.id, action: 'user.profile.update', reason, previousState, newState: auditState(user), transaction });
    });
    res.json({ success: true, user: safeUser(user) });
  } catch (error) { next(error); }
};

exports.changeRole = async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const role = String(req.body.role || '');
    const reason = normalizeReason(req.body.reason);
    if (!ROLES.has(role)) return fail(res, 400, 'Vai trò không hợp lệ.');
    if (!reason) return fail(res, 400, 'Vui lòng nhập lý do thay đổi vai trò.');
    if (role === 'admin') return fail(res, 403, 'Không thể cấp quyền quản trị viên qua chức năng này.');
    const user = await User.findByPk(req.params.id);
    if (!user) return fail(res, 404, 'Không tìm thấy người dùng.');
    if (user.id === req.user.id || user.role === 'admin') return fail(res, 409, 'Không thể thay đổi vai trò tài khoản quản trị viên.');
    if (role === 'provider') {
      const provider = await Provider.findOne({ where: { user_id: user.id } });
      if (!provider || provider.provider_status !== 'active') return fail(res, 409, 'Chỉ hồ sơ nhà cung cấp đã được duyệt mới có thể nhận vai trò này.');
    }
    const previousState = auditState(user);
    await store.transaction(async transaction => {
      user.role = role;
      await user.save({ transaction });
      await writeAudit({ actorId: req.user.id, targetId: user.id, action: 'user.role.change', reason, previousState, newState: auditState(user), transaction });
    });
    res.json({ success: true, user: safeUser(user) });
  } catch (error) { next(error); }
};

async function changeAccountStatus(req, res, next, status, action) {
  if (!requireAdmin(req, res)) return;
  try {
    const reason = normalizeReason(req.body.reason);
    if (!reason) return fail(res, 400, 'Vui lòng nhập lý do thay đổi trạng thái.');
    if (req.params.id === req.user.id) return fail(res, 409, 'Không thể thay đổi trạng thái tài khoản của chính mình.');
    const user = await User.findByPk(req.params.id);
    if (!user) return fail(res, 404, 'Không tìm thấy người dùng.');
    if (user.role === 'admin') return fail(res, 409, 'Không thể thay đổi trạng thái tài khoản quản trị viên.');
    const oldStatus = user.account_status || 'active';
    const validFrom = {
      suspended: ['active'], active: ['suspended', 'deactivated'], deactivated: ['active', 'suspended']
    };
    if (!validFrom[status]?.includes(oldStatus)) return fail(res, 409, `Không thể chuyển tài khoản từ ${oldStatus} sang ${status}.`);
    const previousState = auditState(user);
    await store.transaction(async transaction => {
      user.account_status = status;
      user.account_status_reason = reason;
      user.account_status_changed_by = req.user.id;
      user.account_status_changed_at = new Date();
      await user.save({ transaction });
      await writeAudit({ actorId: req.user.id, targetId: user.id, action, reason, previousState, newState: auditState(user), transaction });
    });
    res.json({ success: true, user: safeUser(user) });
  } catch (error) { next(error); }
}

exports.suspendUser = (req, res, next) => changeAccountStatus(req, res, next, 'suspended', 'user.suspend');
exports.unsuspendUser = (req, res, next) => changeAccountStatus(req, res, next, 'active', 'user.unsuspend');
exports.deactivateUser = (req, res, next) => changeAccountStatus(req, res, next, 'deactivated', 'user.deactivate');
exports.reactivateUser = (req, res, next) => changeAccountStatus(req, res, next, 'active', 'user.reactivate');
