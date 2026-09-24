const { createCrudController } = require('./genericCrud.controller');
const { Supplier } = require('../models');
const { lastSupplierBalance } = require('../services/ledger.service');
const { checkSupplierDependencies } = require('../services/dependency.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');

const crud = createCrudController({
  Model: Supplier,
  idPrefix: 'SUPP',
  counterKey: 'supplier',
  moduleName: 'Suppliers',
  entityName: 'Supplier',
  searchFields: ['company', 'mobile', 'gstin', 'id'],
  dependencyCheckFn: checkSupplierDependencies,
});

const getOutstanding = asyncHandler(async (req, res) => {
  const outstanding = await lastSupplierBalance(req.params.id);
  return ApiResponse.success(res, { data: { supplierId: req.params.id, outstanding } });
});

module.exports = { ...crud, getOutstanding };
