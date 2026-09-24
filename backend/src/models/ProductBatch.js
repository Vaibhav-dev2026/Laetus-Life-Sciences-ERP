const mongoose = require('mongoose');

const productBatchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // BAT-000001
  productId: { type: String, required: true, index: true }, // Product.id
  batchNo: { type: String, required: true, trim: true },
  mfgDate: { type: Date },
  expDate: { type: Date, required: true, index: true },
  mrp: { type: Number, required: true, min: 0 },
  purchaseRate: { type: Number, required: true, min: 0 },
  saleRate: { type: Number, required: true, min: 0 },
  currentQty: { type: Number, required: true, min: 0, default: 0 },
  supplierId: { type: String, default: '' }, // Supplier.id
  purchaseInvoiceRef: { type: String, default: '' },
  status: { type: String, enum: ['Healthy', 'Low Stock', 'Near Expiry', 'Expired', 'Out of Stock'], default: 'Healthy' },
}, { timestamps: true });

// Mandatory pharmaceutical inventory rule: one product cannot have two
// batches sharing the same batch number.
productBatchSchema.index({ productId: 1, batchNo: 1 }, { unique: true });

module.exports = mongoose.model('ProductBatch', productBatchSchema);
