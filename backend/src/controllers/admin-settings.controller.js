const crypto = require('node:crypto');
const models = require('../models');
const { createServiceCategoryService, categoryIdForName } = require('../services/service-category.service');
const { createBookingPricingService, DEFAULT_SETTINGS } = require('../services/booking-pricing.service');

const PAYMENT_METHODS = new Set(['wallet', 'bank_transfer', 'card', 'counter']);

function httpError(statusCode, message, code, details = {}) {
  return Object.assign(new Error(message), { statusCode, code, details });
}

function requireAdmin(req, res) {
  if (req.user?.role === 'admin' && req.user?.id) return true;
  res.status(req.user ? 403 : 401).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
  return false;
}

function readReason(body = {}) {
  const reason = String(body.reason || '').trim();
  if (!reason || reason.length > 1000) throw httpError(400, 'Vui lòng nhập lý do thay đổi (tối đa 1000 ký tự).');
  return reason;
}

function validatePercentage(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100 || Math.round(parsed * 100) !== parsed * 100) {
    throw httpError(400, `${label} phải từ 0 đến 100 và tối đa 2 chữ số thập phân.`);
  }
  return parsed;
}

function validatePrice(value, label = 'Giá') {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw httpError(400, `${label} phải là số VND nguyên không âm.`);
  return parsed;
}

function safeJson(value) {
  return value ? JSON.parse(JSON.stringify(typeof value.toJSON === 'function' ? value.toJSON() : value)) : null;
}

function createAdminSettingsController({
  ServiceCategory = models.ServiceCategory,
  GreenService = models.GreenService,
  BookingSetting = models.BookingSetting,
  BookingAddon = models.BookingAddon,
  AdminConfigAuditLog = models.AdminConfigAuditLog,
  serviceCategoryService = createServiceCategoryService(),
  pricingService = createBookingPricingService(),
  store = models.store,
  now = () => new Date()
} = {}) {
  async function recordAudit({ req, transaction, action, targetType, targetId, reason, previousState, newState }) {
    const timestamp = now();
    await AdminConfigAuditLog.create({
      id: crypto.randomUUID(),
      actor_id: req.user.id,
      action,
      target_type: targetType,
      target_id: String(targetId),
      reason,
      previous_state: safeJson(previousState),
      new_state: safeJson(newState),
      config_version: newState?.version ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    }, { transaction });
  }

  function fail(res, error) {
    const status = Number(error?.statusCode) || 500;
    return res.status(status).json({
      success: false,
      ...(error?.code ? { code: error.code } : {}),
      message: error?.message || 'Không thể xử lý cấu hình Admin.',
      ...error?.details
    });
  }

  async function listCategories(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const categories = await serviceCategoryService.ensureServiceCategories();
      const counts = await serviceCategoryService.countServicesByCategory(categories);
      return res.json({ success: true, categories: categories.map(category => ({ ...safeJson(category), serviceCount: counts[category.id] || 0 })) });
    } catch (error) { return next(error); }
  }

  async function createCategory(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const name = String(req.body?.name || '').trim();
      if (!name || name.length > 100) throw httpError(400, 'Tên danh mục bắt buộc và tối đa 100 ký tự.');
      const reason = readReason(req.body);
      const existing = await ServiceCategory.findAll();
      if (existing.some(category => String(category.name || '').trim().toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) {
        throw httpError(409, 'Tên danh mục đã tồn tại.', 'CATEGORY_EXISTS');
      }
      const requestedId = String(req.body.id || '').trim();
      const id = requestedId || categoryIdForName(name);
      if (await ServiceCategory.findByPk(id)) throw httpError(409, 'Mã danh mục đã tồn tại.', 'CATEGORY_EXISTS');
      const sortOrder = req.body.sort_order === undefined
        ? existing.reduce((max, category) => Math.max(max, Number(category.sort_order) || 0), -1) + 1
        : Number(req.body.sort_order);
      if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) throw httpError(400, 'Thứ tự hiển thị phải là số nguyên không âm.');
      const category = { id, name, active: true, sort_order: sortOrder, icon: String(req.body.icon || '').trim() || null };
      await store.transaction(async transaction => {
        await ServiceCategory.create(category, { transaction });
        await recordAudit({ req, transaction, action: 'category.create', targetType: 'service_category', targetId: id, reason, previousState: null, newState: category });
      });
      return res.status(201).json({ success: true, category });
    } catch (error) { return fail(res, error); }
  }

  async function updateCategory(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const current = await ServiceCategory.findByPk(req.params.id);
      if (!current) throw httpError(404, 'Không tìm thấy danh mục.');
      const reason = readReason(req.body);
      const previousState = safeJson(current);
      const patch = {};
      if (req.body.name !== undefined) {
        const name = String(req.body.name || '').trim();
        if (!name || name.length > 100) throw httpError(400, 'Tên danh mục bắt buộc và tối đa 100 ký tự.');
        const duplicate = (await ServiceCategory.findAll()).some(category => category.id !== current.id && String(category.name || '').trim().toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'));
        if (duplicate) throw httpError(409, 'Tên danh mục đã tồn tại.', 'CATEGORY_EXISTS');
        patch.name = name;
      }
      if (req.body.sort_order !== undefined) {
        const sortOrder = Number(req.body.sort_order);
        if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) throw httpError(400, 'Thứ tự hiển thị phải là số nguyên không âm.');
        patch.sort_order = sortOrder;
      }
      if (req.body.icon !== undefined) patch.icon = String(req.body.icon || '').trim() || null;
      if (req.body.active !== undefined) {
        if (typeof req.body.active !== 'boolean') throw httpError(400, 'Trạng thái danh mục không hợp lệ.');
        patch.active = req.body.active;
      }
      const newState = { ...previousState, ...patch };
      await store.transaction(async transaction => {
        await current.update(patch, { transaction });
        await recordAudit({ req, transaction, action: 'category.update', targetType: 'service_category', targetId: current.id, reason, previousState, newState });
      });
      return res.json({ success: true, category: newState });
    } catch (error) { return fail(res, error); }
  }

  async function archiveCategory(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const current = await ServiceCategory.findByPk(req.params.id);
      if (!current) throw httpError(404, 'Không tìm thấy danh mục.');
      const reason = readReason(req.body);
      const activeServices = await GreenService.findAll({ where: { status: 'active' } });
      const activeReferences = new Set(activeServices.filter(service => service.category_id === current.id
        || (!service.category_id && String(service.current_data?.category || '').trim() === String(current.name || '').trim())).map(service => String(service.id)));
      if (activeReferences.size) throw httpError(409, 'Hãy chuyển hoặc ngừng các dịch vụ đang hoạt động trước khi lưu trữ danh mục.', 'CATEGORY_IN_USE', { serviceCount: activeReferences.size });
      const previousState = safeJson(current);
      const newState = { ...previousState, active: false };
      await store.transaction(async transaction => {
        await current.update({ active: false }, { transaction });
        await recordAudit({ req, transaction, action: 'category.archive', targetType: 'service_category', targetId: current.id, reason, previousState, newState });
      });
      return res.json({ success: true, category: newState });
    } catch (error) { return fail(res, error); }
  }

  async function getBookingSettings(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const [settings, addons] = await Promise.all([
        pricingService.getBookingPricingSettings(),
        BookingAddon.findAll({ order: [['name', 'ASC']] })
      ]);
      return res.json({ success: true, settings, addons });
    } catch (error) { return next(error); }
  }

  async function updateBookingPricing(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const body = req.body || {};
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw httpError(400, 'Phiên bản cấu hình không hợp lệ.');
      const reason = readReason(body);
      const patch = {};
      if (body.discount_percent !== undefined) patch.discount_percent = validatePercentage(body.discount_percent, 'Mức giảm giá');
      if (body.service_fee_vnd !== undefined) patch.service_fee_vnd = validatePrice(body.service_fee_vnd, 'Phí dịch vụ');
      if (body.service_fee_per_guest !== undefined) {
        if (typeof body.service_fee_per_guest !== 'boolean') throw httpError(400, 'Cách tính phí dịch vụ không hợp lệ.');
        patch.service_fee_per_guest = body.service_fee_per_guest;
      }
      if (body.deposit_percent !== undefined) patch.deposit_percent = validatePercentage(body.deposit_percent, 'Tỷ lệ đặt cọc');
      if (body.collect_deposit_for !== undefined) {
        if (!Array.isArray(body.collect_deposit_for) || body.collect_deposit_for.some(method => !PAYMENT_METHODS.has(method)) || new Set(body.collect_deposit_for).size !== body.collect_deposit_for.length) {
          throw httpError(400, 'Danh sách phương thức đặt cọc không hợp lệ.');
        }
        patch.collect_deposit_for = body.collect_deposit_for;
      }
      if (!Object.keys(patch).length) throw httpError(400, 'Không có cấu hình nào được gửi để cập nhật.');

      let updated;
      await store.transaction(async transaction => {
        const existing = await BookingSetting.findByPk('booking_pricing', { transaction });
        const previousState = existing ? { ...DEFAULT_SETTINGS, ...safeJson(existing) } : { ...DEFAULT_SETTINGS };
        if (previousState.version !== expectedVersion) throw httpError(409, 'Cấu hình đã được Admin khác cập nhật. Hãy tải lại trước khi lưu.', 'CONFIG_VERSION_CONFLICT');
        const timestamp = now();
        const newState = { ...previousState, ...patch, version: expectedVersion + 1, updated_at: timestamp, updated_by: req.user.id };
        if (!existing) {
          await BookingSetting.create(newState, { transaction });
        } else {
          const result = await BookingSetting.collection.updateOne(
            { id: 'booking_pricing', version: expectedVersion },
            { $set: { ...patch, updated_at: timestamp, updated_by: req.user.id }, $inc: { version: 1 } },
            store.options({ transaction })
          );
          if (!result.modifiedCount) throw httpError(409, 'Cấu hình đã được Admin khác cập nhật. Hãy tải lại trước khi lưu.', 'CONFIG_VERSION_CONFLICT');
        }
        await recordAudit({ req, transaction, action: 'booking_pricing.update', targetType: 'booking_pricing', targetId: 'booking_pricing', reason, previousState, newState });
        updated = newState;
      });
      return res.json({ success: true, settings: updated });
    } catch (error) {
      if (error.code === 'CONFIG_VERSION_CONFLICT') {
        try { error.details = { settings: await pricingService.getBookingPricingSettings() }; }
        catch { /* keep the original conflict response */ }
      }
      return fail(res, error);
    }
  }

  async function createAddon(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const name = String(req.body?.name || '').trim();
      if (!name || name.length > 120) throw httpError(400, 'Tên dịch vụ bổ sung bắt buộc và tối đa 120 ký tự.');
      const reason = readReason(req.body);
      const id = String(req.body.id || '').trim();
      if (!id || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(id)) throw httpError(400, 'Mã dịch vụ bổ sung không hợp lệ.');
      if (await BookingAddon.findByPk(id)) throw httpError(409, 'Mã dịch vụ bổ sung đã tồn tại.', 'ADDON_EXISTS');
      const addon = { id, name, unit_price: validatePrice(req.body.unit_price, 'Giá dịch vụ bổ sung'), active: req.body.active !== false };
      await store.transaction(async transaction => {
        await BookingAddon.create(addon, { transaction });
        await recordAudit({ req, transaction, action: 'booking_addon.create', targetType: 'booking_addon', targetId: id, reason, previousState: null, newState: addon });
      });
      return res.status(201).json({ success: true, addon });
    } catch (error) { return fail(res, error); }
  }

  async function updateAddon(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const current = await BookingAddon.findByPk(req.params.id);
      if (!current) throw httpError(404, 'Không tìm thấy dịch vụ bổ sung.');
      const reason = readReason(req.body);
      const previousState = safeJson(current);
      const patch = {};
      if (req.body.name !== undefined) {
        const name = String(req.body.name || '').trim();
        if (!name || name.length > 120) throw httpError(400, 'Tên dịch vụ bổ sung bắt buộc và tối đa 120 ký tự.');
        patch.name = name;
      }
      if (req.body.unit_price !== undefined) patch.unit_price = validatePrice(req.body.unit_price, 'Giá dịch vụ bổ sung');
      if (req.body.active !== undefined) {
        if (typeof req.body.active !== 'boolean') throw httpError(400, 'Trạng thái dịch vụ bổ sung không hợp lệ.');
        patch.active = req.body.active;
      }
      if (!Object.keys(patch).length) throw httpError(400, 'Không có thông tin nào được gửi để cập nhật.');
      const newState = { ...previousState, ...patch };
      await store.transaction(async transaction => {
        await current.update(patch, { transaction });
        await recordAudit({ req, transaction, action: 'booking_addon.update', targetType: 'booking_addon', targetId: current.id, reason, previousState, newState });
      });
      return res.json({ success: true, addon: newState });
    } catch (error) { return fail(res, error); }
  }

  async function listAudit(req, res, next) {
    if (!requireAdmin(req, res)) return;
    try {
      const page = Math.max(1, Math.floor(Number(req.query?.page) || 1));
      const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query?.limit) || 20)));
      const [rows, total] = await Promise.all([
        AdminConfigAuditLog.findAll({ order: [['createdAt', 'DESC']], offset: (page - 1) * limit, limit }),
        AdminConfigAuditLog.count()
      ]);
      return res.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) { return next(error); }
  }

  return { listCategories, createCategory, updateCategory, archiveCategory, getBookingSettings, updateBookingPricing, createAddon, updateAddon, listAudit };
}

module.exports = { createAdminSettingsController, ...createAdminSettingsController() };
