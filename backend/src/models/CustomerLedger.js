const mongoose = require('mongoose');

// Append-only. Never update or delete a posted ledger row — corrections are
// posted as new offsetting entries so history stays traceable.
const customerLedgerSchema = new mongoose.Schema({
  partyId: { type: String, required: true, index: true }, // Customer.id
  date: { type: Date, required: true },
  type: { type: String, enum: ['Opening', 'Sale', 'Payment', 'Return', 'Adjustment', 'Cancellation', 'Sale Edit'], required: true },

  refId: { type: String, required: true },
  refNo: { type: String, default: '' },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, required: true }, // running balance after this entry
  // Monotonically-increasing sequence number per party ensures deterministic
  // ordering even when multiple entries land in the same millisecond.
  seq: { type: Number, default: 0 },
}, { timestamps: true });

customerLedgerSchema.index({ partyId: 1, seq: 1 });
customerLedgerSchema.index({ partyId: 1, date: 1, createdAt: 1 });

module.exports = mongoose.model('CustomerLedger', customerLedgerSchema);
