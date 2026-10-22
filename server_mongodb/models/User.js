const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  facebook_id: { type: String, unique: true, sparse: true },
  auth_provider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },
  profile: {
    fullname: { type: String, default: '' },
    phone: { type: String, default: '' },
    dob: { type: String, default: '' },
    gender: { type: String, enum: ['Nam', 'Nữ', 'Khác'], default: 'Khác' },
    address: { type: String, default: '' },
    job: { type: String, default: '' },
    avatarUrl: { type: String, default: '' }
  },
  roles: { type: [String], enum: ['traveler', 'provider', 'admin'], default: ['traveler'] },
  interests: { type: [String], default: [] },
  favorites: {
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    tours: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' }]
  },
  verified: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'banned', 'pending'], default: 'active' },
  banned_reason: { type: String, default: '' },
  wallet: {
    balance: { type: Number, default: 0, min: 0 },
    green_points: { type: Number, default: 0, min: 0 },
    registered: { type: Boolean, default: false }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('User', userSchema);
