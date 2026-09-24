const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // CUST-000001 (frontend-facing id)
  partyName: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Doctor', 'Clinic', 'Hospital', 'Medical Store', 'Distributor', 'Other'], default: 'Medical Store' },
  doctorName: { type: String, default: '' },
  organization: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: 'Gujarat' },
  stateCode: { type: String, default: '24' },
  pin: { type: String, default: '' },
  mobile: { type: String, required: true },
  altMobile: { type: String, default: '' },
  email: { type: String, default: '' },
  gstin: { type: String, default: '', index: true },
  pan: { type: String, default: '' },
  drugLicence: { type: String, default: '' },
  paymentTerms: { type: String, default: '30 Days' },
  creditLimit: { type: Number, default: 0 },
  openingOutstanding: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

customerSchema.index({ partyName: 'text', doctorName: 'text', organization: 'text', mobile: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
