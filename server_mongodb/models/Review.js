const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  images: { type: [String], default: [] },
  provider_reply: {
    reply_text: { type: String, default: '' },
    replied_at: { type: Date }
  },
  internal_notes: { type: String, default: '' },
  is_reported: { type: Boolean, default: false },
  report_reason: { type: String, default: '' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

reviewSchema.index({ service_id: 1, created_at: -1 });
reviewSchema.index({ schedule_id: 1, created_at: -1 });

module.exports = mongoose.model('Review', reviewSchema);
