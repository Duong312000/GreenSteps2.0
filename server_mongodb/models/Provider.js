const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  company_name: { type: String, required: true },
  field: { type: String, default: 'Lưu trú' },
  destinations: { type: [String], default: [] },
  business_license: { type: String, default: '' },
  contact_info: {
    hotline: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    website: { type: String, default: '' }
  },
  contract: {
    name: { type: String, default: 'Hợp đồng đối tác du lịch xanh GreenSteps' },
    text: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'active', 'terminated'], default: 'pending' }
  },
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
  rejection_reason: { type: String, default: '' },
  revenue: [{
    monthyear: { type: String, required: true }, // 'MM/YYYY'
    total_booking: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 },
    service_fee: { type: Number, default: 0 },
    final_profit: { type: Number, default: 0 }
  }],
  registration_date: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Provider', providerSchema);
