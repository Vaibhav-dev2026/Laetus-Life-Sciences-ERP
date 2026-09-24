const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // PRD-000001
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  genericName: { type: String, default: '' },
  brand: { type: String, default: '' },
  manufacturer: { type: String, default: '' },
  category: { type: String, default: '' },
  productType: { type: String, default: 'Tablet' },
  hsn: { type: String, required: true },
  gstRate: { type: Number, enum: [0, 5, 12, 18, 28], default: 12 },
  unit: { type: String, default: 'Strip' },
  pack: { type: String, default: '' },
  mrp: { type: Number, required: true, min: 0 },
  purchaseRate: { type: Number, default: 0, min: 0 },
  saleRate: { type: Number, required: true, min: 0 },
  minStock: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 }, // denormalized sum of active batch qty, kept in sync by stock service
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

productSchema.index({ name: 'text', genericName: 'text', sku: 'text', hsn: 'text' });

module.exports = mongoose.model('Product', productSchema);
