const { Sale, Purchase, SalesReturn, PurchaseReturn, Payment, CustomerLedger, SupplierLedger, StockMovement, ProductBatch } = require('../models');

/**
 * Inspects all transactional references for a Customer before allowing deletion.
 * @param {string} customerId 
 * @returns {Promise<{ isReferenced: boolean, details: object, message: string }>}
 */
async function checkCustomerDependencies(customerId) {
  const [salesCount, salesReturnCount, paymentCount, ledgerCount] = await Promise.all([
    Sale.countDocuments({ customerId }),
    SalesReturn.countDocuments({ customerId }),
    Payment.countDocuments({ partyId: customerId, partyType: 'Customer' }),
    CustomerLedger.countDocuments({ partyId: customerId }),
  ]);

  const totalReferences = salesCount + salesReturnCount + paymentCount + ledgerCount;
  const isReferenced = totalReferences > 0;

  let message = '';
  if (isReferenced) {
    const parts = [];
    if (salesCount > 0) parts.push(`${salesCount} sales invoice(s)`);
    if (salesReturnCount > 0) parts.push(`${salesReturnCount} sales return(s)`);
    if (paymentCount > 0) parts.push(`${paymentCount} payment receipt(s)`);
    if (ledgerCount > 0) parts.push(`${ledgerCount} ledger entry/entries`);
    message = `Cannot delete customer ${customerId} because it is referenced in: ${parts.join(', ')}. Please deactivate or archive this customer instead.`;
  }

  return {
    isReferenced,
    details: { salesCount, salesReturnCount, paymentCount, ledgerCount, totalReferences },
    message,
  };
}

/**
 * Inspects all transactional references for a Supplier before allowing deletion.
 * @param {string} supplierId 
 * @returns {Promise<{ isReferenced: boolean, details: object, message: string }>}
 */
async function checkSupplierDependencies(supplierId) {
  const [purchasesCount, purchaseReturnCount, paymentCount, ledgerCount] = await Promise.all([
    Purchase.countDocuments({ supplierId }),
    PurchaseReturn.countDocuments({ supplierId }),
    Payment.countDocuments({ partyId: supplierId, partyType: 'Supplier' }),
    SupplierLedger.countDocuments({ partyId: supplierId }),
  ]);

  const totalReferences = purchasesCount + purchaseReturnCount + paymentCount + ledgerCount;
  const isReferenced = totalReferences > 0;

  let message = '';
  if (isReferenced) {
    const parts = [];
    if (purchasesCount > 0) parts.push(`${purchasesCount} purchase bill(s)`);
    if (purchaseReturnCount > 0) parts.push(`${purchaseReturnCount} purchase return(s)`);
    if (paymentCount > 0) parts.push(`${paymentCount} supplier payment(s)`);
    if (ledgerCount > 0) parts.push(`${ledgerCount} ledger entry/entries`);
    message = `Cannot delete supplier ${supplierId} because it is referenced in: ${parts.join(', ')}. Please deactivate or archive this supplier instead.`;
  }

  return {
    isReferenced,
    details: { purchasesCount, purchaseReturnCount, paymentCount, ledgerCount, totalReferences },
    message,
  };
}

/**
 * Inspects all transactional and inventory references for a Product before allowing deletion.
 * @param {string} productId 
 * @returns {Promise<{ isReferenced: boolean, details: object, message: string }>}
 */
async function checkProductDependencies(productId) {
  const [salesCount, purchasesCount, salesReturnCount, purchaseReturnCount, batchCount, stockMovementCount] = await Promise.all([
    Sale.countDocuments({ 'lines.productId': productId }),
    Purchase.countDocuments({ 'lines.productId': productId }),
    SalesReturn.countDocuments({ productId }),
    PurchaseReturn.countDocuments({ productId }),
    ProductBatch.countDocuments({ productId }),
    StockMovement.countDocuments({ productId }),
  ]);

  const totalReferences = salesCount + purchasesCount + salesReturnCount + purchaseReturnCount + batchCount + stockMovementCount;
  const isReferenced = totalReferences > 0;

  let message = '';
  if (isReferenced) {
    const parts = [];
    if (salesCount > 0) parts.push(`${salesCount} sales invoice(s)`);
    if (purchasesCount > 0) parts.push(`${purchasesCount} purchase bill(s)`);
    if (salesReturnCount > 0) parts.push(`${salesReturnCount} sales return(s)`);
    if (purchaseReturnCount > 0) parts.push(`${purchaseReturnCount} purchase return(s)`);
    if (batchCount > 0) parts.push(`${batchCount} product batch(es)`);
    if (stockMovementCount > 0) parts.push(`${stockMovementCount} stock movement(s)`);
    message = `Cannot delete product ${productId} because it is referenced in: ${parts.join(', ')}. Please deactivate or archive this product instead.`;
  }

  return {
    isReferenced,
    details: { salesCount, purchasesCount, salesReturnCount, purchaseReturnCount, batchCount, stockMovementCount, totalReferences },
    message,
  };
}

/**
 * Inspects all transactional and inventory references for a ProductBatch before allowing deletion.
 * @param {string} batchId 
 * @returns {Promise<{ isReferenced: boolean, details: object, message: string }>}
 */
async function checkBatchDependencies(batchId) {
  const [salesCount, purchasesCount, salesReturnCount, purchaseReturnCount, stockMovementCount] = await Promise.all([
    Sale.countDocuments({ 'lines.batchId': batchId }),
    Purchase.countDocuments({ 'lines.batchId': batchId }),
    SalesReturn.countDocuments({ batchId }),
    PurchaseReturn.countDocuments({ batchId }),
    StockMovement.countDocuments({ batchId }),
  ]);

  const totalReferences = salesCount + purchasesCount + salesReturnCount + purchaseReturnCount + stockMovementCount;
  const isReferenced = totalReferences > 0;

  let message = '';
  if (isReferenced) {
    const parts = [];
    if (salesCount > 0) parts.push(`${salesCount} sales invoice(s)`);
    if (purchasesCount > 0) parts.push(`${purchasesCount} purchase bill(s)`);
    if (salesReturnCount > 0) parts.push(`${salesReturnCount} sales return(s)`);
    if (purchaseReturnCount > 0) parts.push(`${purchaseReturnCount} purchase return(s)`);
    if (stockMovementCount > 0) parts.push(`${stockMovementCount} stock movement(s)`);
    message = `Cannot delete batch ${batchId} because it is referenced in: ${parts.join(', ')}.`;
  }

  return {
    isReferenced,
    details: { salesCount, purchasesCount, salesReturnCount, purchaseReturnCount, stockMovementCount, totalReferences },
    message,
  };
}

module.exports = {
  checkCustomerDependencies,
  checkSupplierDependencies,
  checkProductDependencies,
  checkBatchDependencies,
};
