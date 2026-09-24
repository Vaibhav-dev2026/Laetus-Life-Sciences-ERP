const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // PAY-000001
  partyId: { type: String, required: true, index: true }, // Customer.id or Supplier.id
  partyType: { type: String, enum: ['Customer', 'Supplier'], required: true },
  invoiceId: { type: String, default: '' }, // Sale.id or Purchase.id this payment is applied to, optional
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'], default: 'Cash' },
  date: { type: Date, required: true },
  reference: { type: String, default: '' },
  remarks: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

paymentSchema.index({ partyId: 1, date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
