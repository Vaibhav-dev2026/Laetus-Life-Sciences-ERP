const dayjs = require('dayjs');
const ApiError = require('../utils/ApiError');
const { ProductBatch, Product, StockMovement } = require('../models');

const NEAR_EXPIRY_DAYS = 90;

function computeBatchStatus(batch) {
  if (batch.currentQty <= 0) return 'Out of Stock';
  const daysToExpiry = dayjs(batch.expDate).diff(dayjs(), 'day');
  if (daysToExpiry < 0) return 'Expired';
  if (daysToExpiry <= NEAR_EXPIRY_DAYS) return 'Near Expiry';
  return 'Healthy';
}

// Increases batch stock (purchase or purchase-return-of-a-sale-return-style
// increase). Creates or updates the ProductBatch and always writes a
// StockMovement row. Must be called inside an active mongoose session.
async function increaseStock({ productId, batchId, batchNo, mfgDate, expDate, qty, purchaseRate, saleRate, mrp, supplierId, refType, refId, createdBy, session }) {
  const cleanBatchNo = String(batchNo || '').trim();
  const opts = session ? { session } : {};

  // 1. First search by explicit batchId or by (productId + cleanBatchNo)
  let batch = (batchId ? await ProductBatch.findOne({ id: batchId }, null, opts) : null) ||
              (productId && cleanBatchNo ? await ProductBatch.findOne({ productId, batchNo: cleanBatchNo }, null, opts) : null);

  if (batch) {
    // Reuse existing ProductBatch for the SAME product and accumulate stock
    batch.currentQty += qty;
    if (purchaseRate != null) batch.purchaseRate = purchaseRate;
    if (saleRate != null) batch.saleRate = saleRate;
    if (mrp != null) batch.mrp = mrp;
    if (expDate != null) batch.expDate = expDate;
    batch.status = computeBatchStatus(batch);
    await batch.save(opts);
  } else {
    // Create new ProductBatch — generate next non-colliding internal ID (BAT-000001, BAT-000002 ...)
    const { generateId } = require('../utils/idGenerator');
    const id = await generateId('BAT', 'batch', 6, session, ProductBatch);
    const pRate = Number(purchaseRate) || 0;
    const sRate = Number(saleRate) || pRate;
    const mRate = Number(mrp) || sRate;
    const eDate = expDate || dayjs().add(1, 'year').toDate();
    const [created] = await ProductBatch.create([{
      id,
      productId,
      batchNo: cleanBatchNo || 'B1',
      mfgDate,
      expDate: eDate,
      purchaseRate: pRate,
      saleRate: sRate,
      mrp: mRate,
      currentQty: qty,
      supplierId,
      purchaseInvoiceRef: refId,
      status: computeBatchStatus({ currentQty: qty, expDate: eDate }),
    }], opts);

    batch = created;
  }

  await StockMovement.create([{
    productId, batchId: batch.id, type: refType, qty, refId, refType, balanceAfter: batch.currentQty, createdBy,
  }], opts);

  await syncProductStock(productId, session);
  return batch;
}

// Deducts stock from the EXACT batch referenced by the sale line. Rejects if
// insufficient stock — caller is expected to run this inside a transaction
// and abort on error.
async function decreaseStock({ productId, batchId, qty, refType, refId, createdBy, session }) {
  const opts = session ? { session } : {};
  const batch = await ProductBatch.findOne({ id: batchId }, null, opts);
  if (!batch) throw ApiError.notFound(`Batch ${batchId} not found`);
  if (batch.currentQty < qty) {
    throw ApiError.badRequest(`Insufficient stock for batch ${batch.batchNo} (available ${batch.currentQty}, requested ${qty})`);
  }

  batch.currentQty -= qty;
  batch.status = computeBatchStatus(batch);
  await batch.save(opts);

  await StockMovement.create([{
    productId, batchId: batch.id, type: refType, qty: -qty, refId, refType, balanceAfter: batch.currentQty, createdBy,
  }], opts);

  await syncProductStock(productId, session);
  return batch;
}

async function syncProductStock(productId, session) {
  const opts = session ? { session } : {};
  const batches = await ProductBatch.find({ productId }, null, opts);
  const total = batches.reduce((a, b) => a + b.currentQty, 0);
  await Product.updateOne({ id: productId }, { $set: { currentStock: total } }, opts);
}

function assertExpiryPolicy(batch, policy) {
  const status = computeBatchStatus(batch);
  if (status === 'Expired' && policy === 'Block') {
    throw ApiError.badRequest(`Batch ${batch.batchNo} has expired and cannot be sold under the current expiry policy.`);
  }
}

module.exports = { increaseStock, decreaseStock, syncProductStock, computeBatchStatus, assertExpiryPolicy, NEAR_EXPIRY_DAYS };
