const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  config_key: { type: String, required: true, unique: true },
  config_value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String, default: '' },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
