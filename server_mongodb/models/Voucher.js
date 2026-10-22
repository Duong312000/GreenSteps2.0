const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }, // null: Toàn sàn
  discount_type: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  discount_value: { type: Number, required: true, min: 0 },
  min_order_value: { type: Number, default: 0 },
  max_discount: { type: Number, default: 0 },
  quantity: { type: Number, default: 100 },
  used_count: { type: Number, default: 0 },
  expires_at: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'disabled'], default: 'active' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Voucher', voucherSchema);
