const mongoose = require('mongoose');

const purchaseReturnSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // PR-000001
  purchaseId: { type: String, required: true, index: true },
  purchaseInvoiceNo: { type: String, required: true },
  supplierId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  batchId: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  reason: { type: String, default: '' },
  payableAdjustment: { type: Number, required: true },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
