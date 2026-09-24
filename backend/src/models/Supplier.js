const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // SUPP-000001
  company: { type: String, required: true, trim: true },
  contact: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: 'Gujarat' },
  stateCode: { type: String, default: '24' },
  pin: { type: String, default: '' },
  mobile: { type: String, required: true },
  email: { type: String, default: '' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  drugLicence: { type: String, default: '' },
  paymentTerms: { type: String, default: '30 Days' },
  openingPayable: { type: Number, default: 0 },
  bankName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

supplierSchema.index({ company: 'text', mobile: 'text', gstin: 'text' });

module.exports = mongoose.model('Supplier', supplierSchema);
