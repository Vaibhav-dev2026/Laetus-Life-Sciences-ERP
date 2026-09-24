const mongoose = require('mongoose');

// Single-company ERP: exactly one Company document is expected to exist.
const companySchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'L LAETUS LIFE SCIENCES' },
  logo: { type: String, default: '/logo.png' },
  addressLine1: { type: String, default: '' },
  addressLine2: { type: String, default: '' },
  state: { type: String, default: 'Gujarat' },
  stateCode: { type: String, default: '24' },
  pin: { type: String, default: '' },
  phone: { type: String, default: '9662031042' },
  email: { type: String, default: '' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  drugLicence: { type: String, default: '' },
  bank: {
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifsc: { type: String, default: '' },
  },
  invoice: {
    prefix: { type: String, default: 'LLS' },
    numberFormat: { type: String, default: 'LLS/{FY}/{SEQ}' },
    financialYearStart: { type: String, default: 'April' },
    startNumber: { type: Number, default: 1001 },
    dueDateDays: { type: Number, default: 30 },
    expiryPolicy: { type: String, enum: ['Block', 'Warn'], default: 'Warn' },
  },
  terms: { type: [String], default: [] },
  signatoryLabel: { type: String, default: 'for L LAETUS LIFE SCIENCES' },
  currentFinancialYear: { type: String, default: '2026-27' },
  availableFinancialYears: {
    type: [String],
    default: ['2024-25', '2025-26', '2026-27', '2027-28', '2028-29', '2029-30']
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

companySchema.virtual('mobile').get(function() {
  return this.phone || '9662031042';
});

module.exports = mongoose.model('Company', companySchema);
