const { campaignState } = require('./campaign-state.service');
function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }

function validateFlashUpdate(row, body, service, now = Date.now()) {
  if (!body || !Number.isSafeInteger(body.version) || body.version !== (row._rev || 0)) fail('Dữ liệu đã thay đổi. Đóng và mở lại để tải bản mới nhất.', 409);
  if (row.type !== 'flash_sale' || row.archived_at) fail('Không tìm thấy Flash Sale.', 404);
  if (['cancelled', 'expired'].includes(campaignState(row, now))) fail('Không thể sửa chương trình đã kết thúc hoặc hủy.', 409);
  if (!Number.isSafeInteger(body.usage_limit) || body.usage_limit < Math.max(1, row.used_count || 0) || body.usage_limit > 1e9) fail('Tổng số suất phải là số nguyên, không nhỏ hơn số suất đã sử dụng.');
  if (!['percent', 'fixed'].includes(body.discount_type) || !Number.isSafeInteger(body.discount_value) || body.discount_value < 1
      || body.discount_value > (body.discount_type === 'percent' ? 100 : Number(service?.cost || 0))) fail('Mức giảm không hợp lệ hoặc vượt giá dịch vụ.');
  if ((row.used_count > 0 || row.bookings > 0 || row.spent > 0) && (row.discount_type !== body.discount_type || row.discount_value !== body.discount_value)) fail('Không thể đổi mức giảm sau khi đã phát sinh giao dịch.', 409);
  const start_at = new Date(body.start_at), end_at = new Date(body.end_at);
  if (typeof body.start_at !== 'string' || typeof body.end_at !== 'string' || !Number.isFinite(+start_at) || !Number.isFinite(+end_at) || +end_at <= now || +end_at <= +start_at) fail('Thời gian kết thúc phải sau thời gian bắt đầu và ở tương lai.');
  if (+start_at !== +new Date(row.start_at) && +start_at < now - 60000) fail('Thời gian bắt đầu mới không được ở quá khứ.');
  if (!['active', 'paused', 'cancelled'].includes(body.status)) fail('Trạng thái không hợp lệ.');
  if (body.status === 'active' && (!service || service.status !== 'active' || service.vender_id !== row.vender_id)) fail('Dịch vụ không còn đủ điều kiện hoạt động.');
  return { usage_limit: body.usage_limit, discount_type: body.discount_type, discount_value: body.discount_value, start_at, end_at, status: body.status };
}
module.exports = { validateFlashUpdate };
