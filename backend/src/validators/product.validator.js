const { body } = require('express-validator');

const productRules = [
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('hsn').trim().notEmpty().withMessage('HSN code is required'),
  body('mrp').isFloat({ gt: 0 }).withMessage('MRP must be greater than zero'),
  body('saleRate').isFloat({ gt: 0 }).withMessage('Sale rate must be greater than zero'),
  body('gstRate').isIn([0, 5, 12, 18, 28]).withMessage('Invalid GST rate'),
];

module.exports = { productRules };
