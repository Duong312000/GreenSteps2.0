const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  icon_url: { type: String, default: '' },
  description: { type: String, default: '' },
  scope: { type: String, enum: ['user', 'service', 'schedule'], default: 'service' },
  awards: [{
    target_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    awarded_at: { type: Date, default: Date.now }
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Badge', badgeSchema);
