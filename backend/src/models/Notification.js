const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['Low Stock', 'Near Expiry', 'Expired', 'Outstanding Overdue', 'Purchase Created', 'Sales Created', 'Payment Received', 'System Alert'], required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
