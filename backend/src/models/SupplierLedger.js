const mongoose = require('mongoose');

const supplierLedgerSchema = new mongoose.Schema({
  partyId: { type: String, required: true, index: true }, // Supplier.id
  date: { type: Date, required: true },
  type: { type: String, enum: ['Opening', 'Purchase', 'Payment', 'Return', 'Adjustment', 'Cancellation', 'Purchase Edit'], required: true },

  refId: { type: String, required: true },
  refNo: { type: String, default: '' },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, required: true },
  // Monotonically-increasing sequence number per party ensures deterministic
  // ordering even when multiple entries land in the same millisecond.
  seq: { type: Number, default: 0 },
}, { timestamps: true });

supplierLedgerSchema.index({ partyId: 1, seq: 1 });
supplierLedgerSchema.index({ partyId: 1, date: 1, createdAt: 1 });

module.exports = mongoose.model('SupplierLedger', supplierLedgerSchema);
