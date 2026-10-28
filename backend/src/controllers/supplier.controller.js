const { createCrudController } = require('./genericCrud.controller');
const { Supplier, SupplierLedger } = require('../models');
const { lastSupplierBalance } = require('../services/ledger.service');
const { checkSupplierDependencies } = require('../services/dependency.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const crud = createCrudController({
  Model: Supplier,
  idPrefix: 'SUPP',
  counterKey: 'supplier',
  moduleName: 'Suppliers',
  entityName: 'Supplier',
  searchFields: ['company', 'mobile', 'gstin', 'id'],
  dependencyCheckFn: checkSupplierDependencies,
});

const list = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 100 } = req.query;
  const query = {};
  if (status && status !== 'All') query.status = status;
  if (search) {
    const searchFields = ['company', 'mobile', 'gstin', 'id'];
    query.$or = searchFields.map((f) => ({ [f]: { $regex: search, $options: 'i' } }));
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(5000, Math.max(1, Number(limit)));
  const [data, total] = await Promise.all([
    Supplier.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Supplier.countDocuments(query),
  ]);

  const suppIds = data.map((s) => s.id);
  const ledgerBalances = await SupplierLedger.aggregate([
    { $match: { partyId: { $in: suppIds } } },
    { $sort: { _id: 1 } },
    { $group: { _id: '$partyId', lastBalance: { $last: '$balance' } } },
  ]);
  const balanceMap = new Map(ledgerBalances.map((l) => [l._id, l.lastBalance]));

  const enriched = data.map((s) => {
    const obj = s.toObject();
    obj.currentPayable = balanceMap.has(s.id)
      ? balanceMap.get(s.id)
      : (s.currentPayable !== undefined && s.currentPayable !== null ? s.currentPayable : (s.openingPayable || 0));
    return obj;
  });

  return ApiResponse.success(res, {
    data: enriched,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

const getById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ id: req.params.id });
  if (!supplier) throw ApiError.notFound('Supplier not found');
  const obj = supplier.toObject();
  obj.currentPayable = await lastSupplierBalance(req.params.id);
  return ApiResponse.success(res, { data: obj });
});

const getOutstanding = asyncHandler(async (req, res) => {
  const outstanding = await lastSupplierBalance(req.params.id);
  return ApiResponse.success(res, { data: { supplierId: req.params.id, outstanding } });
});

const create = asyncHandler(async (req, res, next) => {
  if (req.body.openingPayable) {
    req.body.currentPayable = Number(req.body.openingPayable) || 0;
  }
  return crud.create(req, res, next);
});

module.exports = { ...crud, list, getById, getOutstanding, create };
