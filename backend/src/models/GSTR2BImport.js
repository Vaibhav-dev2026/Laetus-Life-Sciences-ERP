const mongoose = require('mongoose');

const gstr2bImportSchema = new mongoose.Schema({
  taxPeriod: { type: String, required: true, index: true }, // e.g. "2026-08" or "08/2026"
  financialYear: { type: String, required: true, index: true }, // e.g. "2026-27"
  supplierGstin: { type: String, required: true, trim: true, index: true },
  supplierName: { type: String, default: '' },
  invoiceNo: { type: String, required: true, trim: true },
  invoiceDate: { type: Date, required: true },
  invoiceValue: { type: Number, required: true },
  taxableValue: { type: Number, required: true },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  isRcm: { type: Boolean, default: false },
  itcAvailability: { type: String, enum: ['Available', 'Ineligible', 'Blocked'], default: 'Available' },
  source: { type: String, enum: ['Portal Import', 'Manual Upload'], default: 'Portal Import' },
  importTimestamp: { type: Date, default: Date.now },
  importedBy: { type: String, default: 'System' },
}, { timestamps: true });

gstr2bImportSchema.index({ taxPeriod: 1, supplierGstin: 1, invoiceNo: 1 }, { unique: true });

module.exports = mongoose.model('GSTR2BImport', gstr2bImportSchema);
