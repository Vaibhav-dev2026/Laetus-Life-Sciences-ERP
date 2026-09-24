const mongoose = require('mongoose');

// Every stock change MUST create one of these — nothing mutates
// ProductBatch.currentQty without a traceable movement row.
const stockMovementSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  batchId: { type: String, required: true, index: true },
  type: { type: String, enum: ['Purchase', 'Sale', 'SalesReturn', 'PurchaseReturn', 'Adjustment', 'Sale Cancellation', 'Sale Reversal', 'Purchase Cancellation', 'Purchase Reversal', 'Sale Edit', 'Purchase Edit'], required: true },


  qty: { type: Number, required: true }, // positive = stock in, negative = stock out
  refId: { type: String, required: true },
  refType: { type: String, required: true },
  date: { type: Date, default: Date.now },
  balanceAfter: { type: Number, required: true },
  remarks: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

stockMovementSchema.index({ date: -1 });
stockMovementSchema.index({ productId: 1, date: -1 });
stockMovementSchema.index({ batchId: 1, date: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
