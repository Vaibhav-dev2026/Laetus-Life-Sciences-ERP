const { createCrudController } = require('./genericCrud.controller');
const { Product } = require('../models');
const { checkProductDependencies } = require('../services/dependency.service');

module.exports = createCrudController({
  Model: Product,
  idPrefix: 'PRD',
  counterKey: 'product',
  moduleName: 'Products',
  entityName: 'Product',
  searchFields: ['sku', 'name', 'genericName', 'hsn'],
  dependencyCheckFn: checkProductDependencies,
});
