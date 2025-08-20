const mongoose = require('mongoose');

const depositRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coin: { type: String, required: true },
  amount: { type: Number, required: true },
  address: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date }
});

module.exports = mongoose.model('DepositRequest', depositRequestSchema);