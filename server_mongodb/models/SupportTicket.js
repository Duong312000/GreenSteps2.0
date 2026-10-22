const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['customer', 'agent', 'ai_bot'], default: 'customer' },
  content: { type: String, required: true },
  sent_at: { type: Date, default: Date.now }
}, { _id: true });

const supportTicketSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  subject: { type: String, required: true },
  category: {
    type: String,
    enum: ['booking_issue', 'wallet_issue', 'ai_chat', 'other'],
    default: 'booking_issue'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  messages: [messageSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
