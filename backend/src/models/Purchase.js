const mongoose = require('mongoose');

const purchaseLineSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, default: '' },
  pack: { type: String, default: '' },
  mfg: { type: String, default: '' },
  batchNo: { type: String, required: true },
  batchId: { type: String, default: '' }, // ProductBatch.id created/updated by this line
  mfgDate: { type: Date },
  expDate: { type: Date, required: true },
  hsn: { type: String, default: '' },
  mrp: { type: Number, default: 0 },
  pts: { type: Number, default: 0 },
  rate: { type: Number, required: true, min: 0 },
  qty: { type: Number, required: true, min: 1 },
  freeQty: { type: Number, default: 0, min: 0 },
  discountPct: { type: Number, default: 0, min: 0, max: 100 },
  gstRate: { type: Number, required: true },
  taxableValue: { type: Number, required: true },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  total: { type: Number, required: true },
}, { _id: false });


const purchaseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // PUR-000001
  purchaseInvoiceNo: { type: String, required: true },
  purchaseDate: { type: Date, required: true },
  supplierId: { type: String, required: true, index: true },
  supplierInvoiceNo: { type: String, default: '' },
  dueDate: { type: Date },
  lines: { type: [purchaseLineSchema], validate: (v) => v.length > 0 },
  grossTotal: { type: Number, required: true },
  discountTotal: { type: Number, required: true },
  taxableTotal: { type: Number, required: true },
  cgstTotal: { type: Number, required: true },
  sgstTotal: { type: Number, required: true },
  igstTotal: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['Unpaid', 'Partial', 'Paid'], default: 'Unpaid' },
  status: { type: String, enum: ['Active', 'Cancelled'], default: 'Active' },
  cancelReason: { type: String, default: '' },
  financialYear: { type: String, required: true },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ supplierId: 1, purchaseDate: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
