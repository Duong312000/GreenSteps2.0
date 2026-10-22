const mongoose = require('mongoose');

const adCampaignSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  campaign_name: { type: String, required: true },
  campaign_type: {
    type: String,
    enum: ['top_recommend', 'flash_sale', 'seasonal_banner'],
    default: 'top_recommend'
  },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  cost: { type: Number, default: 0 },
  duration_days: { type: Number, default: 7 },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  discount_percent: { type: Number, default: 0 },
  views_count: { type: Number, default: 0 },
  bookings_count: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'expired', 'paused'], default: 'active' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('AdCampaign', adCampaignSchema);
