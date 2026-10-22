const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['stay', 'food', 'transport', 'attraction'], required: true },
  destination: { type: String, required: true },
  address: { type: String, default: '' },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  cost: { type: Number, required: true, min: 0 },
  carbon: { type: Number, default: 0 },
  capacity: { type: Number, default: 10 },
  description: { type: String, default: '' },
  amenities: { type: [String], default: [] },
  images: { type: [String], default: [] },
  green_criteria: {
    energy: { type: Boolean, default: false },
    waste: { type: Boolean, default: false },
    local: { type: Boolean, default: false }
  },
  badges: { type: [String], default: [] },
  rating: { type: Number, default: 5.0, min: 1, max: 5 },
  reviews_count: { type: Number, default: 0 },
  bookings_count: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'pending', 'rejected'], default: 'active' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

serviceSchema.index({ destination: 1, type: 1, cost: 1 });
serviceSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Service', serviceSchema);
