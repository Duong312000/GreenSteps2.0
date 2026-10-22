const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true, lowercase: true, trim: true },
  purpose: { type: String, enum: ['REGISTER', 'RESET_PASSWORD'], required: true },
  otp_hash: { type: String, required: true },
  expires_at: { type: Date, required: true },
  consumed_at: { type: Date },
  attempt_count: { type: Number, default: 0 },
  resend_available_at: { type: Date, required: true },
  reset_token_hash: { type: String },
  reset_token_expires_at: { type: Date },
  ip_address: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// TTL Index tự xóa document sau khi hết hạn 1 ngày
authSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('AuthSession', authSessionSchema);
