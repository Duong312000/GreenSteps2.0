const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  day_number: { type: Number, required: true },
  time: { type: String, default: '08:00' },
  name: { type: String, required: true },
  cost: { type: Number, default: 0 },
  carbon: { type: Number, default: 0 },
  type: { type: String, enum: ['lodging', 'dining', 'transport', 'attraction'], default: 'attraction' },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  coordinates: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  is_shared: { type: Boolean, default: false }
}, { _id: true });

const scheduleSchema = new mongoose.Schema({
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tour_name: { type: String, required: true },
  destination: { type: String, required: true },
  days: { type: Number, required: true, min: 1 },
  total_cost: { type: Number, default: 0 },
  total_carbon: { type: Number, default: 0 },
  is_sample: { type: Boolean, default: false }, // true: Tour trọn gói của hệ thống, false: Lịch trình cá nhân
  sample_details: {
    old_cost: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
    votes_count: { type: Number, default: 0 },
    image_url: { type: String, default: '' },
    tour_description: { type: String, default: '' }
  },
  custom_details: {
    status: { type: String, enum: ['draft', 'deposited', 'completed', 'cancelled'], default: 'draft' },
    start_date: { type: String, default: '' },
    end_date: { type: String, default: '' },
    companion_email: { type: String, default: '' },
    deposit_deadline: { type: Date }
  },
  activities: [activitySchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

scheduleSchema.index({ owner_id: 1, is_sample: 1 });
scheduleSchema.index({ destination: 1, is_sample: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
