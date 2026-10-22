const mongoose = require('mongoose');

const changeRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['date_change', 'time_change', 'guests_change', 'info_change', 'package_change', 'cancel_booking', 'refund'],
    required: true
  },
  old_data: { type: mongoose.Schema.Types.Mixed },
  new_data: { type: mongoose.Schema.Types.Mixed },
  price_diff: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed'],
    default: 'pending'
  },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
}, { _id: true });

const bookingSchema = new mongoose.Schema({
  evoucher_code: { type: String, required: true, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  kind: { type: String, enum: ['service', 'tour'], default: 'service' },
  target_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  customer: {
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }
  },
  booking_date: { type: String, required: true },
  check_out_date: { type: String, default: '' },
  guests: { type: Number, default: 1, min: 1 },
  value: { type: Number, required: true, min: 0 },
  voucher_code: { type: String, default: '' },
  payment: {
    method: { type: String, enum: ['wallet', 'bank_transfer', 'card'], default: 'wallet' },
    status: { type: String, enum: ['pending', 'deposit', 'paid', 'refunded'], default: 'pending' },
    paid_at: { type: Date }
  },
  escrow: {
    status: { type: String, enum: ['none', 'holding', 'released', 'refunded'], default: 'none' },
    released_at: { type: Date }
  },
  booking_status: {
    type: String,
    enum: ['new', 'confirmed', 'deposit', 'completed', 'cancelled', 'rejected'],
    default: 'new'
  },
  operation: {
    assigned_staff: { type: String, default: '' },
    assigned_vehicle: { type: String, default: '' },
    status: { type: String, enum: ['preparing', 'ongoing', 'finished', 'incident'], default: 'preparing' }
  },
  change_requests: [changeRequestSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

bookingSchema.index({ user_id: 1, created_at: -1 });
bookingSchema.index({ provider_id: 1, booking_status: 1 });
bookingSchema.index({ 'customer.phone': 1 });

module.exports = mongoose.model('Booking', bookingSchema);
