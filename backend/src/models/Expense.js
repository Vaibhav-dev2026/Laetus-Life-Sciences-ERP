const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true }, // EXP-000001
  date: { type: Date, required: true },
  category: { type: String, enum: ['Rent', 'Salary', 'Transport', 'Electricity', 'Marketing', 'Office', 'Other'], required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque'], default: 'Cash' },
  reference: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
