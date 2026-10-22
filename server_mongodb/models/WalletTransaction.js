const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  transaction_code: { type: String, required: true, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['deposit', 'payment', 'refund', 'withdrawal', 'escrow_hold', 'escrow_release'],
    required: true
  },
  amount: { type: Number, required: true, min: 0.01 },
  description: { type: String, required: true },
  status: { type: String, enum: ['success', 'pending', 'failed'], default: 'success' },
  reference_id: { type: String, default: '' },
  bank_info: {
    bank_name: { type: String, default: '' },
    account_number: { type: String, default: '' },
    account_holder: { type: String, default: '' }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

walletTransactionSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
