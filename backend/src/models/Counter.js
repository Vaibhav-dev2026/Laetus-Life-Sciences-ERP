const mongoose = require('mongoose');

// Generic atomic counter used for CUST-/SUPP-/PRD- style IDs (see idGenerator.js)
// and reused, with a composite key, for FY-aware invoice numbering.
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
