const mongoose = require('mongoose');

const salesReturnSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // SR-000001
  saleId: { type: String, required: true, index: true },
  invoiceNo: { type: String, required: true },
  customerId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  batchId: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  reason: { type: String, default: '' },
  refundAmount: { type: Number, required: true },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SalesReturn', salesReturnSchema);
