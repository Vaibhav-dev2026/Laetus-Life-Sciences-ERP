const { createCrudController } = require('./genericCrud.controller');
const { Customer } = require('../models');
const { lastCustomerBalance } = require('../services/ledger.service');
const { checkCustomerDependencies } = require('../services/dependency.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');

const crud = createCrudController({
  Model: Customer,
  idPrefix: 'CUST',
  counterKey: 'customer',
  moduleName: 'Customers',
  entityName: 'Customer',
  searchFields: ['partyName', 'doctorName', 'organization', 'mobile', 'gstin', 'id'],
  dependencyCheckFn: checkCustomerDependencies,
});

const getOutstanding = asyncHandler(async (req, res) => {
  const outstanding = await lastCustomerBalance(req.params.id);
  return ApiResponse.success(res, { data: { customerId: req.params.id, outstanding } });
});

module.exports = { ...crud, getOutstanding };
