const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['booking', 'wallet', 'community', 'system'],
    default: 'system'
  },
  read: { type: Boolean, default: false },
  link_url: { type: String, default: '' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

notificationSchema.index({ user_id: 1, read: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
