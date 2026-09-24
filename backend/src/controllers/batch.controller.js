const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ProductBatch, StockMovement, Product } = require('../models');
const { logAudit } = require('../services/audit.service');
const { computeBatchStatus } = require('../services/stock.service');
const { checkBatchDependencies } = require('../services/dependency.service');
const { withTransaction } = require('../utils/transaction.util');

const list = asyncHandler(async (req, res) => {
  const { search, status, productId, supplierId } = req.query;
  const query = {};
  if (productId) query.productId = productId;
  if (supplierId) query.supplierId = supplierId;
  if (status && status !== 'All') query.status = status;
  if (search) query.batchNo = { $regex: search, $options: 'i' };
  const data = await ProductBatch.find(query).sort({ expDate: 1 });
  return ApiResponse.success(res, { data });
});

const getById = asyncHandler(async (req, res) => {
  const batch = await ProductBatch.findOne({ id: req.params.id });
  if (!batch) throw ApiError.notFound('Batch not found');
  return ApiResponse.success(res, { data: batch });
});

// Manual stock adjustment (physical count correction, damage, sample, etc.)
// Always produces a StockMovement row — never a silent quantity edit.
const adjust = asyncHandler(async (req, res) => {
  const { batchId, type, qty, reason, remarks } = req.body;
  if (!batchId || !qty || Number(qty) <= 0) throw ApiError.badRequest('batchId and a positive qty are required');

  const updatedBatch = await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const batch = await ProductBatch.findOne({ id: batchId }, null, opts);
    if (!batch) throw ApiError.notFound('Batch not found');

    const delta = type === 'Decrease' ? -Number(qty) : Number(qty);
    if (batch.currentQty + delta < 0) throw ApiError.badRequest('Adjustment would result in negative stock');

    batch.currentQty += delta;
    batch.status = computeBatchStatus(batch);
    await batch.save(opts);

    await StockMovement.create([{
      productId: batch.productId, batchId: batch.id, type: 'Adjustment', qty: delta,
      refId: batch.id, refType: 'Adjustment', balanceAfter: batch.currentQty,
      remarks: `${reason || 'Manual adjustment'}${remarks ? ' — ' + remarks : ''}`, createdBy: req.user?.name,
    }], opts);

    const allBatches = await ProductBatch.find({ productId: batch.productId }, null, opts);
    const total = allBatches.reduce((a, b) => a + b.currentQty, 0);
    await Product.updateOne({ id: batch.productId }, { $set: { currentStock: total } }, opts);

    await logAudit({ user: req.user?.name, action: 'Update', module: 'Inventory', reference: batchId, before: { qty: batch.currentQty - delta }, after: { qty: batch.currentQty }, session });
    return batch;
  });

  return ApiResponse.success(res, { message: 'Stock adjustment recorded', data: updatedBatch });
});

const remove = asyncHandler(async (req, res) => {
  const batch = await ProductBatch.findOne({ id: req.params.id });
  if (!batch) throw ApiError.notFound('Batch not found');

  const depCheck = await checkBatchDependencies(req.params.id);
  if (depCheck.isReferenced) {
    throw ApiError.conflict(depCheck.message);
  }

  const beforeObj = batch.toObject();
  await ProductBatch.deleteOne({ id: req.params.id });

  // Recalculate product currentStock
  const allBatches = await ProductBatch.find({ productId: batch.productId });
  const total = allBatches.reduce((a, b) => a + b.currentQty, 0);
  await Product.updateOne({ id: batch.productId }, { $set: { currentStock: total } });

  await logAudit({ user: req.user?.name, action: 'Delete', module: 'Inventory', reference: req.params.id, before: beforeObj });
  return ApiResponse.success(res, { message: 'Batch deleted permanently', data: { id: req.params.id } });
});

module.exports = { list, getById, adjust, remove };
