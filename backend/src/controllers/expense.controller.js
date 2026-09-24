const { createCrudController } = require('./genericCrud.controller');
const { Expense } = require('../models');

const base = createCrudController({
  Model: Expense, idPrefix: 'EXP', counterKey: 'expense', moduleName: 'Expenses', entityName: 'Expense',
  searchFields: ['description', 'category', 'reference'],
});

module.exports = base;
