const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { CustomerLedger, SupplierLedger, Customer, Supplier } = require('../models');

const customerLedger = asyncHandler(async (req, res) => {
  const { customerId, from, to } = req.query;
  if (!customerId) {
    return ApiResponse.success(res, { data: { customer: null, entries: [] } });
  }

  const queryOr = [{ id: customerId }];
  if (mongoose.Types.ObjectId.isValid(customerId)) {
    queryOr.push({ _id: customerId });
  }

  const customer = await Customer.findOne({ $or: queryOr });
  if (!customer) {
    return ApiResponse.success(res, { data: { customer: null, entries: [] } });
  }

  const query = { partyId: customer.id || customerId };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  const entries = await CustomerLedger.find(query).sort({ _id: 1 });
  return ApiResponse.success(res, { data: { customer, entries } });
});

const supplierLedger = asyncHandler(async (req, res) => {
  const { supplierId, from, to } = req.query;
  if (!supplierId) {
    return ApiResponse.success(res, { data: { supplier: null, entries: [] } });
  }

  const queryOr = [{ id: supplierId }];
  if (mongoose.Types.ObjectId.isValid(supplierId)) {
    queryOr.push({ _id: supplierId });
  }

  const supplier = await Supplier.findOne({ $or: queryOr });
  if (!supplier) {
    return ApiResponse.success(res, { data: { supplier: null, entries: [] } });
  }

  const query = { partyId: supplier.id || supplierId };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  const entries = await SupplierLedger.find(query).sort({ _id: 1 });
  return ApiResponse.success(res, { data: { supplier, entries } });
});

module.exports = { customerLedger, supplierLedger };
