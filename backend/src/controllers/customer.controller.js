const { createCrudController } = require('./genericCrud.controller');
const { Customer, CustomerLedger } = require('../models');
const { lastCustomerBalance } = require('../services/ledger.service');
const { checkCustomerDependencies } = require('../services/dependency.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const crud = createCrudController({
  Model: Customer,
  idPrefix: 'CUST',
  counterKey: 'customer',
  moduleName: 'Customers',
  entityName: 'Customer',
  searchFields: ['partyName', 'doctorName', 'organization', 'mobile', 'gstin', 'id'],
  dependencyCheckFn: checkCustomerDependencies,
});

const list = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 100 } = req.query;
  const query = {};
  if (status && status !== 'All') query.status = status;
  if (search) {
    const searchFields = ['partyName', 'doctorName', 'organization', 'mobile', 'gstin', 'id'];
    query.$or = searchFields.map((f) => ({ [f]: { $regex: search, $options: 'i' } }));
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(5000, Math.max(1, Number(limit)));
  const [data, total] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Customer.countDocuments(query),
  ]);

  const custIds = data.map((c) => c.id);
  const ledgerBalances = await CustomerLedger.aggregate([
    { $match: { partyId: { $in: custIds } } },
    { $sort: { _id: 1 } },
    { $group: { _id: '$partyId', lastBalance: { $last: '$balance' } } },
  ]);
  const balanceMap = new Map(ledgerBalances.map((l) => [l._id, l.lastBalance]));

  const enriched = data.map((c) => {
    const obj = c.toObject();
    obj.currentBalance = balanceMap.has(c.id)
      ? balanceMap.get(c.id)
      : (c.currentBalance !== undefined && c.currentBalance !== null ? c.currentBalance : (c.openingOutstanding || 0));
    return obj;
  });

  return ApiResponse.success(res, {
    data: enriched,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

const getById = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ id: req.params.id });
  if (!customer) throw ApiError.notFound('Customer not found');
  const obj = customer.toObject();
  obj.currentBalance = await lastCustomerBalance(req.params.id);
  return ApiResponse.success(res, { data: obj });
});

const getOutstanding = asyncHandler(async (req, res) => {
  const outstanding = await lastCustomerBalance(req.params.id);
  return ApiResponse.success(res, { data: { customerId: req.params.id, outstanding } });
});

const create = asyncHandler(async (req, res, next) => {
  if (req.body.openingOutstanding) {
    req.body.currentBalance = Number(req.body.openingOutstanding) || 0;
  }
  return crud.create(req, res, next);
});

module.exports = { ...crud, list, getById, getOutstanding, create };
