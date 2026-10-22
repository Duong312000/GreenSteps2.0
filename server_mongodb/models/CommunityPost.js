const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parent_id: { type: mongoose.Schema.Types.ObjectId },
  text: { type: String, required: true },
  rating: { type: Number },
  is_reported: { type: Boolean, default: false },
  report_reason: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
}, { _id: true });

const communityPostSchema = new mongoose.Schema({
  author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  destination: { type: String, required: true },
  days: { type: Number, default: 1 },
  text: { type: String, required: true },
  image_url: { type: String, default: '' },
  itinerary_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
  likes_count: { type: Number, default: 0 },
  comments_count: { type: Number, default: 0 },
  liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [commentSchema],
  status: { type: String, enum: ['published', 'pending', 'hidden'], default: 'published' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

communityPostSchema.index({ destination: 1, created_at: -1 });
communityPostSchema.index({ author_id: 1 });

module.exports = mongoose.model('CommunityPost', communityPostSchema);
