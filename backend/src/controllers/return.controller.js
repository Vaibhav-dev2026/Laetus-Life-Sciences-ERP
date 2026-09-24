const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { generateId } = require('../utils/idGenerator');
const { Sale, Purchase, SalesReturn, PurchaseReturn, StockMovement, ProductBatch, Product } = require('../models');
const { postCustomerEntry, postSupplierEntry } = require('../services/ledger.service');
const { logAudit } = require('../services/audit.service');
const { computeBatchStatus } = require('../services/stock.service');
const { round2 } = require('../utils/money');

const { withTransaction } = require('../utils/transaction.util');

const listSalesReturns = asyncHandler(async (req, res) => {
  const data = await SalesReturn.find().sort({ createdAt: -1 });
  return ApiResponse.success(res, { data });
});

const listPurchaseReturns = asyncHandler(async (req, res) => {
  const data = await PurchaseReturn.find().sort({ createdAt: -1 });
  return ApiResponse.success(res, { data });
});

// Increases stock back into the exact batch, posts a customer ledger credit,
// and reduces the original sale's outstanding proportionally.
const createSalesReturn = asyncHandler(async (req, res) => {
  const { saleId, lineIndex, qty, reason } = req.body;
  const numQty = Number(qty);
  if (!saleId || lineIndex == null || !numQty || isNaN(numQty) || !isFinite(numQty) || numQty <= 0) {
    throw ApiError.badRequest('saleId, lineIndex and a positive numeric qty are required');
  }

  const saved = await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const sale = await Sale.findOne({ id: saleId }, null, opts);
    if (!sale) throw ApiError.notFound('Original sale not found');
    const line = sale.lines[lineIndex];
    if (!line) throw ApiError.notFound('Invoice line not found');

    const previousReturns = await SalesReturn.find({ saleId, productId: line.productId, batchId: line.batchId }, null, opts);
    const alreadyReturnedQty = previousReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
    const maxReturnable = line.qty - alreadyReturnedQty;

    if (numQty > maxReturnable) {
      throw ApiError.badRequest(`Return quantity (${numQty}) exceeds maximum returnable quantity (${maxReturnable}). Previously returned: ${alreadyReturnedQty}/${line.qty}`);
    }

    const refundAmount = round2((line.total / line.qty) * numQty);

    const batch = await ProductBatch.findOne({ id: line.batchId }, null, opts);
    if (!batch) throw ApiError.notFound('Batch not found');
    batch.currentQty += numQty;
    batch.status = computeBatchStatus(batch);
    await batch.save(opts);

    const id = await generateId('SR', 'salesReturn', 6, session, SalesReturn);
    await StockMovement.create([{ productId: line.productId, batchId: batch.id, type: 'SalesReturn', qty: numQty, refId: id, refType: 'SalesReturn', balanceAfter: batch.currentQty, createdBy: req.user?.name }], opts);

    const allBatches = await ProductBatch.find({ productId: line.productId }, null, opts);
    await Product.updateOne({ id: line.productId }, { $set: { currentStock: allBatches.reduce((a, b) => a + b.currentQty, 0) } }, opts);

    const [ret] = await SalesReturn.create([{ id, saleId, invoiceNo: sale.invoiceNo, customerId: sale.customerId, productId: line.productId, batchId: line.batchId, qty: numQty, reason, refundAmount, createdBy: req.user?.name }], opts);

    await postCustomerEntry({ partyId: sale.customerId, date: new Date(), type: 'Return', refId: id, refNo: sale.invoiceNo, credit: refundAmount, session });

    sale.balance = round2(Math.max(0, sale.balance - refundAmount));
    if (sale.balance <= 0) sale.paymentStatus = 'Paid';
    await sale.save(opts);

    await logAudit({ user: req.user?.name, action: 'Create', module: 'Sales Return', reference: id, after: ret.toObject(), session });
    return ret;
  });

  return ApiResponse.created(res, { message: 'Sales return recorded — credit note effect applied', data: saved });
});

const createPurchaseReturn = asyncHandler(async (req, res) => {
  const { purchaseId, lineIndex, qty, reason } = req.body;
  const numQty = Number(qty);
  if (!purchaseId || lineIndex == null || !numQty || isNaN(numQty) || !isFinite(numQty) || numQty <= 0) {
    throw ApiError.badRequest('purchaseId, lineIndex and a positive numeric qty are required');
  }

  const saved = await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const purchase = await Purchase.findOne({ id: purchaseId }, null, opts);
    if (!purchase) throw ApiError.notFound('Original purchase not found');
    const line = purchase.lines[lineIndex];
    if (!line) throw ApiError.notFound('Purchase line not found');

    const batch = await ProductBatch.findOne({ productId: line.productId, batchNo: line.batchNo }, null, opts);
    if (!batch) throw ApiError.notFound('Batch not found');

    const previousReturns = await PurchaseReturn.find({ purchaseId, productId: line.productId, batchId: batch.id }, null, opts);
    const alreadyReturnedQty = previousReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
    const maxReturnable = line.qty - alreadyReturnedQty;

    if (numQty > maxReturnable) {
      throw ApiError.badRequest(`Return quantity (${numQty}) exceeds maximum returnable quantity (${maxReturnable}). Previously returned: ${alreadyReturnedQty}/${line.qty}`);
    }

    if (batch.currentQty < numQty) {
      throw ApiError.badRequest(`Insufficient stock in batch ${batch.batchNo} (available: ${batch.currentQty}, requested return: ${numQty})`);
    }

    const payableAdjustment = round2((line.total / line.qty) * numQty);

    batch.currentQty -= numQty;
    batch.status = computeBatchStatus(batch);
    await batch.save(opts);

    const id = await generateId('PR', 'purchaseReturn', 6, session, PurchaseReturn);
    await StockMovement.create([{ productId: line.productId, batchId: batch.id, type: 'PurchaseReturn', qty: -numQty, refId: id, refType: 'PurchaseReturn', balanceAfter: batch.currentQty, createdBy: req.user?.name }], opts);

    const allBatches = await ProductBatch.find({ productId: line.productId }, null, opts);
    await Product.updateOne({ id: line.productId }, { $set: { currentStock: allBatches.reduce((a, b) => a + b.currentQty, 0) } }, opts);

    const [ret] = await PurchaseReturn.create([{ id, purchaseId, purchaseInvoiceNo: purchase.purchaseInvoiceNo, supplierId: purchase.supplierId, productId: line.productId, batchId: batch.id, qty: numQty, reason, payableAdjustment, createdBy: req.user?.name }], opts);

    await postSupplierEntry({ partyId: purchase.supplierId, date: new Date(), type: 'Return', refId: id, refNo: purchase.purchaseInvoiceNo, debit: payableAdjustment, session });

    await logAudit({ user: req.user?.name, action: 'Create', module: 'Purchase Return', reference: id, after: ret.toObject(), session });
    return ret;
  });

  return ApiResponse.created(res, { message: 'Purchase return recorded — payable adjustment applied', data: saved });
});

module.exports = { listSalesReturns, listPurchaseReturns, createSalesReturn, createPurchaseReturn };
