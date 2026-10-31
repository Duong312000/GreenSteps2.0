const { randomUUID } = require('node:crypto');

const {
  User,
  Vender,
  GreenService,
  PartnerCampaign: Campaign,
} = require('../models');

const TYPES = ['promotion', 'flash_sale', 'voucher'];

const PACKAGES = { discovery: 50000, featured: 150000, premium: 300000 };

let indexes;

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function state(row, now = Date.now()) {
  if (row.status === 'cancelled') return 'cancelled';
  if (new Date(row.end_at).getTime() <= now) return 'expired';
  if (row.type !== 'promotion' && row.used_count >= row.usage_limit)
    return 'exhausted';
  if (row.status === 'paused') return 'paused';
  return new Date(row.start_at).getTime() > now ? 'scheduled' : 'active';
}

function dto(row, services = []) {
  const { _id, _rev, ...data } = row;
  const service = services.find((s) => s.id === row.service_id);
  return {
    ...data,
    version: _rev || 0,
    effective_status: state(row),
    service: service
      ? {
          id: service.id,
          name: service.name_service,
          image: service.image_url,
          cost: service.cost,
          destination: service.destination,
          type: service.type,
          status: service.status,
          days: service.days,
          bookings_count: service.bookings_count,
        }
      : null,
  };
}

exports.authorize = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || user.role !== 'provider' || !user.is_verified)
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhà cung cấp đã xác thực được quản lý khuyến mãi.',
      });
    indexes ||= Promise.all([
      Campaign.collection.createIndex(
        { code: 1 },
        {
          unique: true,
          partialFilterExpression: { code: { $type: 'string' } },
          name: 'promotion_code_unique',
        },
      ),
      Campaign.collection.createIndex({
        user_id: 1,
        archived_at: 1,
        createdAt: -1,
      }),
    ]).catch((error) => {
      indexes = null;
      throw error;
    });
    await indexes;
    next();
  } catch (error) {
    next(error);
  }
};

async function owned(req) {
  const row = await Campaign.collection.findOne({
    id: req.params.id,
    user_id: req.user.id,
    archived_at: null,
  });
  if (!row) fail('Không tìm thấy chiến dịch.', 404);
  return row;
}

function number(value, label, min, max = 1e12, integer = false) {
  if (
    value === '' ||
    value == null ||
    typeof value === 'boolean' ||
    !['string', 'number'].includes(typeof value)
  )
    fail(`${label} không hợp lệ.`);
  const result = Number(value);
  if (
    !Number.isFinite(result) ||
    result < min ||
    result > max ||
    (integer && !Number.isInteger(result))
  )
    fail(`${label} không hợp lệ.`);
  return result;
}

async function validate(body, userId, existing) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    fail('Dữ liệu không hợp lệ.');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 3 || name.length > 120)
    fail('Tên chiến dịch cần từ 3 đến 120 ký tự.');
  if (!TYPES.includes(body.type)) fail('Loại chiến dịch không hợp lệ.');
  if (existing && body.type !== existing.type)
    fail('Không thể thay đổi loại chiến dịch.');
  if (typeof body.start_at !== 'string' || typeof body.end_at !== 'string')
    fail('Vui lòng nhập thời gian.');
  const start_at = new Date(body.start_at),
    end_at = new Date(body.end_at);
  if (
    !Number.isFinite(+start_at) ||
    !Number.isFinite(+end_at) ||
    end_at <= start_at
  )
    fail('Thời gian kết thúc phải sau thời gian bắt đầu.');
  if (+end_at <= Date.now()) fail('Thời hạn phải nằm trong tương lai.');
  if (
    (!existing || +start_at !== +new Date(existing.start_at)) &&
    +start_at < Date.now() - 60000
  )
    fail('Thời gian bắt đầu không được ở quá khứ.');
  const vender = await Vender.findOne({ where: { user_id: userId } });
  const service_id =
    typeof body.service_id === 'string' ? body.service_id : null;
  let service;
  if (service_id) {
    service = await GreenService.findByPk(service_id);
    if (!service || !vender || service.vender_id !== vender.id)
      fail('Dịch vụ không thuộc nhà cung cấp hiện tại.', 403);
    if (service.status !== 'active')
      fail('Chỉ được chọn dịch vụ đang hoạt động.');
  } else if (body.type !== 'voucher') fail('Vui lòng chọn dịch vụ.');
  const data = {
    name,
    type: body.type,
    start_at,
    end_at,
    service_id,
    vender_id: vender?.id || null,
    package: null,
    budget: 0,
    discount_type: 'percent',
    discount_value: 0,
    min_order: 0,
    usage_limit: 1,
  };
  if (body.type === 'promotion') {
    if (!Object.hasOwn(PACKAGES, body.package))
      fail('Gói quảng bá không hợp lệ.');
    data.package = body.package;
    const days = Math.ceil((end_at - start_at) / 86400000);
    data.budget = number(
      body.budget,
      'Ngân sách',
      PACKAGES[data.package] * days,
    );
    if (data.budget < (existing?.spent || 0))
      fail('Ngân sách không thể thấp hơn chi phí đã sử dụng.');
  } else {
    if (!['percent', 'fixed'].includes(body.discount_type))
      fail('Loại giảm giá không hợp lệ.');
    data.discount_type = body.discount_type;
    data.discount_value = number(
      body.discount_value,
      'Giá trị giảm',
      1,
      body.discount_type === 'percent' ? 100 : 1e12,
    );
    if (
      service &&
      data.discount_type === 'fixed' &&
      data.discount_value > service.cost
    )
      fail('Mức giảm không được vượt giá dịch vụ.');
    data.min_order = number(body.min_order ?? 0, 'Đơn tối thiểu', 0);
    data.usage_limit = number(
      body.usage_limit,
      'Giới hạn sử dụng',
      Math.max(1, existing?.used_count || 0),
      1000000000,
      true,
    );
    if (body.type === 'voucher') {
      const code =
        typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9_-]{3,32}$/.test(code))
        fail('Mã gồm 3–32 ký tự: chữ không dấu, số, _ hoặc -.');
      data.code = code;
    }
  }
  if (
    existing &&
    (existing.used_count > 0 || existing.bookings > 0 || existing.spent > 0)
  ) {
    for (const key of [
      'service_id',
      'code',
      'discount_type',
      'discount_value',
      'min_order',
      'package',
    ]) {
      if ((data[key] ?? null) !== (existing[key] ?? null))
        fail(
          'Chiến dịch đã phát sinh giao dịch: không được đổi dịch vụ, mã hoặc điều kiện ưu đãi.',
        );
    }
  }
  return data;
}

async function update(row, body, changes) {
  if (!Number.isInteger(body?.version) || body.version !== (row._rev || 0))
    fail('Dữ liệu đã thay đổi. Vui lòng tải lại.', 409);
  const result = await Campaign.collection.updateOne(
    {
      id: row.id,
      user_id: row.user_id,
      _rev: row._rev ?? { $exists: false },
      archived_at: null,
    },
    { $set: { ...changes, updatedAt: new Date() }, $inc: { _rev: 1 } },
  );
  if (!result.matchedCount) fail('Dữ liệu đã thay đổi. Vui lòng tải lại.', 409);
}

function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error.code === 11000)
        return res.status(409).json({
          success: false,
          message: 'Mã ưu đãi đã tồn tại. Hãy chọn mã khác.',
        });
      if (error.statusCode && error.statusCode < 500)
        return res
          .status(error.statusCode)
          .json({ success: false, message: error.message });
      next(error);
    }
  };
}

exports.options = wrap(async (req, res) => {
  const vender = await Vender.findOne({ where: { user_id: req.user.id } });
  const services = vender
    ? await GreenService.collection
        .find(
          { vender_id: vender.id, status: 'active' },
          { projection: { id: 1, name_service: 1, cost: 1, image_url: 1 } },
        )
        .toArray()
    : [];
  res.json({
    success: true,
    services: services.map((s) => ({
      id: s.id,
      name: s.name_service,
      cost: s.cost,
      image: s.image_url,
    })),
    packages: PACKAGES,
  });
});

exports.list = wrap(async (req, res) => {
  const query = { user_id: req.user.id, archived_at: null };
  if (req.query.type) {
    if (!TYPES.includes(req.query.type)) fail('Loại không hợp lệ.');
    query.type = req.query.type;
  }
  if (req.query.q) {
    if (typeof req.query.q !== 'string' || req.query.q.length > 120)
      fail('Tìm kiếm tối đa 120 ký tự.');
    const regex = {
      $regex: req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i',
    };
    const vender = await Vender.findOne({ where: { user_id: req.user.id } });
    const matches = vender
      ? await GreenService.collection
          .find(
            { vender_id: vender.id, name_service: regex },
            { projection: { id: 1 } },
          )
          .toArray()
      : [];
    query.$or = [
      { name: regex },
      { code: regex },
      { service_id: { $in: matches.map((s) => s.id) } },
    ];
  }
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(req.query.from) : null,
      to = req.query.to ? new Date(req.query.to) : null;
    if (
      (from && !Number.isFinite(+from)) ||
      (to && !Number.isFinite(+to)) ||
      (from && to && to < from)
    )
      fail('Khoảng ngày không hợp lệ.');
    if (from) query.end_at = { $gte: from };
    if (to) query.start_at = { $lte: to };
  }
  const now = new Date();
  const status = req.query.status;
  if (status) {
    if (
      ![
        'active',
        'scheduled',
        'paused',
        'expired',
        'cancelled',
        'exhausted',
      ].includes(status)
    )
      fail('Trạng thái không hợp lệ.');
    query.$and = [];
    const and = (value) => query.$and.push(value);
    if (status === 'cancelled') and({ status: 'cancelled' });
    else {
      and({ status: { $ne: 'cancelled' } });
      if (status === 'expired') and({ end_at: { $lte: now } });
      else {
        and({ end_at: { $gt: now } });
        const exhausted = {
          $and: [
            { type: { $ne: 'promotion' } },
            { $expr: { $gte: ['$used_count', '$usage_limit'] } },
          ],
        };
        if (status === 'exhausted') and(exhausted);
        else {
          and({ $nor: [exhausted] });
          and({ status: status === 'paused' ? 'paused' : 'active' });
          if (status !== 'paused')
            and({
              start_at: status === 'scheduled' ? { $gt: now } : { $lte: now },
            });
        }
      }
    }
  }
  const page = number(req.query.page || 1, 'Trang', 1, 1000000, true);
  const limit = number(req.query.limit || 10, 'Số dòng', 1, 50, true);
  const total = await Campaign.collection.countDocuments(query);
  const items = await Campaign.collection
    .find(query)
    .sort({ createdAt: -1, id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
  const services = await GreenService.collection
    .find({ id: { $in: items.map((c) => c.service_id).filter(Boolean) } })
    .toArray();
  res.json({
    success: true,
    items: items.map((row) => dto(row, services)),
    total,
    page,
    limit,
  });
});

// Customer facing feed. Only live campaigns attached to approved, active services are shown.
exports.publicList = wrap(async (req, res) => {
  const now = new Date();
  const rows = await Campaign.collection.find({
    archived_at: null,
    status: 'active',
    start_at: { $lte: now },
    end_at: { $gt: now },
    type: { $in: ['flash_sale', 'voucher'] },
    discount_value: { $gt: 0 },
    $expr: { $lt: ['$used_count', '$usage_limit'] },
  }).sort({ bookings: -1, clicks: -1, createdAt: -1 }).toArray();
  const serviceIds = rows.map((row) => row.service_id).filter(Boolean);
  const venderIds = rows
    .filter((row) => !row.service_id && row.type === 'voucher' && row.vender_id)
    .map((row) => row.vender_id);
  const serviceOr = [];
  if (serviceIds.length) serviceOr.push({ id: { $in: serviceIds } });
  if (venderIds.length) serviceOr.push({ vender_id: { $in: venderIds } });
  const services = serviceOr.length
    ? await GreenService.collection.find({ status: 'active', $or: serviceOr }).toArray()
    : [];
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const items = [];
  for (const row of rows) {
    const linked = row.service_id
      ? [servicesById.get(row.service_id)].filter(Boolean)
      : row.type === 'voucher'
        ? services.filter((service) => service.vender_id === row.vender_id)
        : [];
    for (const service of linked) {
      items.push(dto({
        ...row,
        service_id: service.id,
        offer_id: row.service_id ? row.id : `${row.id}:${service.id}`,
        campaign_id: row.id,
        applies_to_all: !row.service_id,
      }, [service]));
    }
  }
  res.json({ success: true, items, total: items.length });
});

exports.create = wrap(async (req, res) => {
  const data = await validate(req.body, req.user.id);
  const created = await Campaign.create({
    ...data,
    id: 'PC-' + randomUUID(),
    user_id: req.user.id,
  });
  res.status(201).json({
    success: true,
    item: dto(await Campaign.collection.findOne({ id: created.id })),
  });
});

exports.detail = wrap(async (req, res) => {
  const row = await owned(req);
  const services = row.service_id
    ? await GreenService.collection.find({ id: row.service_id }).toArray()
    : [];
  res.json({ success: true, item: dto(row, services) });
});

exports.report = wrap(async (req, res) => {
  const row = await owned(req);
  res.json({
    success: true,
    report: {
      name: row.name,
      views: row.views,
      clicks: row.clicks,
      bookings: row.bookings,
      revenue: row.revenue,
      spent: row.spent,
      used_count: row.used_count,
      usage_limit: row.usage_limit,
      ctr: row.views ? (row.clicks / row.views) * 100 : 0,
      note: 'Chỉ hiển thị số liệu được ghi nhận cho chiến dịch. Chưa có dữ liệu phân bổ thì các chỉ số bằng 0.',
    },
  });
});

exports.update = wrap(async (req, res) => {
  const row = await owned(req);
  if (['cancelled', 'expired', 'exhausted'].includes(state(row)))
    fail('Chiến dịch đã kết thúc hoặc hủy không thể chỉnh sửa.', 409);
  const data = await validate(req.body, req.user.id, row);
  await update(row, req.body, data);
  res.json({ success: true });
});

exports.status = wrap(async (req, res) => {
  const row = await owned(req);
    if (!['active', 'paused', 'cancelled'].includes(req.body?.status))
    fail('Trạng thái không hợp lệ.');
  if (['cancelled', 'expired', 'exhausted'].includes(state(row)))
    fail('Chiến dịch đã kết thúc hoặc hủy.', 409);
  if (req.body.status === 'active' && row.status !== 'paused')
    fail('Chỉ có thể tiếp tục chiến dịch đang tạm dừng.', 409);
  if (req.body.status === 'paused' && row.status !== 'active')
    fail('Chiến dịch không đang hoạt động.', 409);
  if (req.body.status === 'active') {
    const service = row.service_id
      ? await GreenService.findByPk(row.service_id)
      : null;
    const vender = await Vender.findOne({ where: { user_id: req.user.id } });
    if (
      row.service_id &&
      (!service ||
        service.status !== 'active' ||
        service.vender_id !== vender?.id)
    )
      fail('Dịch vụ không còn đủ điều kiện.');
    if (row.type === 'promotion' && row.spent >= row.budget)
      fail('Ngân sách đã sử dụng hết.');
  }
  await update(row, req.body, { status: req.body.status });
  res.json({ success: true });
});

exports.remove = wrap(async (req, res) => {
  const row = await owned(req);
  // Always retain history, including campaigns with redemptions, bookings or spend.
  await update(row, req.body, {
    archived_at: new Date(),
    status: 'cancelled',
  });
  res.json({ success: true, archived: true });
});
