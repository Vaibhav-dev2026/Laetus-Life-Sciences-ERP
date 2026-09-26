const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { generateId } = require('../utils/idGenerator');
const { Sale, Customer, ProductBatch, Product, Payment, Company } = require('../models');
const { calcLine, calcDocumentTotals, isInterState } = require('../services/gstCalculation.service');
const { decreaseStock, increaseStock, assertExpiryPolicy } = require('../services/stock.service');
const { postCustomerEntry } = require('../services/ledger.service');
const { logAudit } = require('../services/audit.service');
const { nextInvoiceNumber } = require('../services/invoiceNumber.service');
const { round2 } = require('../utils/money');
const { withTransaction } = require('../utils/transaction.util');

const list = asyncHandler(async (req, res) => {
  const { search, customerId, page = 1, limit = 100 } = req.query;
  const query = { status: 'Active' };
  if (customerId) query.customerId = customerId;
  if (search) query.invoiceNo = { $regex: search, $options: 'i' };
  const pageNum = Math.max(1, Number(page)); const limitNum = Math.min(500, Number(limit));
  const [data, total] = await Promise.all([
    Sale.find(query).sort({ date: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Sale.countDocuments(query),
  ]);
  return ApiResponse.success(res, { data, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
});

const getById = asyncHandler(async (req, res) => {
  const isObjId = require('mongoose').Types.ObjectId.isValid(req.params.id);
  const sale = await Sale.findOne({ $or: [{ id: req.params.id }, ...(isObjId ? [{ _id: req.params.id }] : []), { invoiceNo: req.params.id }] });
  if (!sale) throw ApiError.notFound('Invoice not found');
  return ApiResponse.success(res, { data: sale });
});

const create = asyncHandler(async (req, res) => {
  const { customerId, date, lines, amountReceived = 0, paymentMode } = req.body;

  if (!customerId) throw ApiError.badRequest('customerId is required');
  if (!Array.isArray(lines) || lines.length === 0) throw ApiError.badRequest('At least one product line is required');

  const isCustObjId = require('mongoose').Types.ObjectId.isValid(customerId);
  const customer = await Customer.findOne({ $or: [{ id: customerId }, ...(isCustObjId ? [{ _id: customerId }] : [])] });
  if (!customer) throw ApiError.notFound('Customer not found');
  if (customer.status !== 'Active') throw ApiError.badRequest('Cannot bill an inactive customer');

  const company = (await Company.findOne()) || { stateCode: '24', invoice: { numberFormat: 'LLS/{FY}/{SEQ}', expiryPolicy: 'Warn' } };
  const interState = isInterState(company.stateCode, customer.stateCode);

  const batchIds = lines.map((l) => l.batchId).filter(Boolean);
  const productIds = lines.map((l) => l.productId).filter(Boolean);
  const validBatchObjIds = batchIds.filter(id => require('mongoose').Types.ObjectId.isValid(id));
  const validProdObjIds = productIds.filter(id => require('mongoose').Types.ObjectId.isValid(id));

  const [batches, products] = await Promise.all([
    ProductBatch.find({ $or: [{ id: { $in: batchIds } }, { _id: { $in: validBatchObjIds } }] }),
    Product.find({ $or: [{ id: { $in: productIds } }, { _id: { $in: validProdObjIds } }] }),
  ]);
  const batchMap = new Map();
  batches.forEach(b => { batchMap.set(b.id, b); batchMap.set(b._id.toString(), b); });

  const productMap = new Map();
  products.forEach(p => { productMap.set(p.id, p); productMap.set(p._id.toString(), p); });

  const computedLines = lines.map((l) => {
    if (!l.productId || !l.batchId || l.qty == null || l.rate == null) {
      throw ApiError.badRequest('Each line requires productId, batchId, qty and rate');
    }
    if (Number(l.qty) <= 0) throw ApiError.badRequest('Quantity must be greater than zero');
    if (Number(l.rate) < 0) throw ApiError.badRequest('Rate cannot be negative');
    const batch = batchMap.get(l.batchId);
    if (!batch) throw ApiError.notFound(`Batch ${l.batchId} not found`);
    const prod = productMap.get(l.productId);

    const totalQtyToDeduct = Number(l.qty) + (Number(l.freeQty) || 0);
    if (batch.currentQty < totalQtyToDeduct) {
      throw ApiError.badRequest(`Insufficient stock for batch ${batch.batchNo} (available ${batch.currentQty}, requested ${totalQtyToDeduct})`);
    }
    assertExpiryPolicy(batch, company.invoice?.expiryPolicy || 'Warn');

    const c = calcLine({ qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate, isInterState: interState });
    return {
      productId: l.productId,
      productName: l.productName || prod?.name || '',
      pack: l.pack || prod?.pack || '',
      mfg: l.mfg || prod?.mfg || batch.mfg || '',
      batchId: batch.id,
      batchNo: batch.batchNo,
      expDate: batch.expDate,
      hsn: l.hsn || prod?.hsn || '',
      mrp: l.mrp !== undefined ? l.mrp : batch.mrp,
      ptr: l.ptr !== undefined ? l.ptr : (batch.ptr || batch.saleRate || 0),
      qty: Number(l.qty),
      freeQty: Number(l.freeQty) || 0,
      rate: Number(l.rate),
      discountPct: Number(l.discountPct) || 0,
      gstRate: Number(l.gstRate) || 0,
      taxableValue: c.taxableValue,
      cgst: c.cgst,
      sgst: c.sgst,
      igst: c.igst,
      total: c.total,
      gross: c.gross,
      discountAmt: c.discountAmt,
    };
  });
  const totals = calcDocumentTotals(computedLines);

  // Idempotency check: prevent duplicate sale invoice creation from rapid double-clicks or retries
  const fifteenSecsAgo = new Date(Date.now() - 15000);
  const existingRecentSale = await Sale.findOne({
    customerId,
    grandTotal: totals.grandTotal,
    status: { $ne: 'Cancelled' },
    createdAt: { $gte: fifteenSecsAgo },
  });
  if (existingRecentSale) {
    return ApiResponse.success(res, { message: 'Invoice already created (duplicate request suppressed)', data: existingRecentSale });
  }

  const saved = await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const { invoiceNo, financialYear } = await nextInvoiceNumber({
      series: 'SALE', format: company.invoice?.numberFormat, session,
      model: Sale, modelField: 'invoiceNo',
    });

    const id = await generateId('INV', 'sale', 6, session, Sale);
    const balance = round2(totals.grandTotal - Number(amountReceived || 0));
    const paymentStatus = balance <= 0 ? 'Paid' : Number(amountReceived) > 0 ? 'Partial' : 'Unpaid';

    const [sale] = await Sale.create([{
      id, invoiceNo, date: date || new Date(), dueDate: req.body.dueDate,
      customerId, placeOfSupply: customer.state, isInterState: interState,
      lines: computedLines.map(({ gross, discountAmt, ...rest }) => rest),
      ...totals, amountReceived, balance, paymentStatus, paymentMode: paymentMode || '',
      financialYear, createdBy: req.user?.name,
    }], opts);

    for (const line of computedLines) {
      await decreaseStock({ productId: line.productId, batchId: line.batchId, qty: Number(line.qty) + Number(line.freeQty || 0), refType: 'Sale', refId: sale.id, createdBy: req.user?.name, session });
    }

    await postCustomerEntry({ partyId: customerId, date: sale.date, type: 'Sale', refId: sale.id, refNo: invoiceNo, debit: totals.grandTotal, session });

    if (Number(amountReceived) > 0) {
      const paymentId = await generateId('PAY', 'payment', 6, session, Payment);
      await Payment.create([{ id: paymentId, partyId: customerId, partyType: 'Customer', invoiceId: sale.id, amount: amountReceived, mode: paymentMode || 'Cash', date: sale.date, createdBy: req.user?.name }], opts);
      await postCustomerEntry({ partyId: customerId, date: sale.date, type: 'Payment', refId: paymentId, refNo: paymentId, credit: amountReceived, session });
    }

    await logAudit({ user: req.user?.name, action: 'Create', module: 'Sales', reference: sale.id, after: sale.toObject(), session });
    return sale;
  });
  return ApiResponse.created(res, { message: 'Invoice saved successfully', data: saved });
});

const update = asyncHandler(async (req, res) => {
  const isObjId = require('mongoose').Types.ObjectId.isValid(req.params.id);
  const sale = await Sale.findOne({ $or: [{ id: req.params.id }, ...(isObjId ? [{ _id: req.params.id }] : []), { invoiceNo: req.params.id }] });
  if (!sale) throw ApiError.notFound('Invoice not found');
  if (sale.status === 'Cancelled') throw ApiError.badRequest('Cannot edit a cancelled invoice');

  const before = sale.toObject();
  const { customerId = sale.customerId, date = sale.date, lines = sale.lines, amountReceived } = req.body;

  const isCustObjId = require('mongoose').Types.ObjectId.isValid(customerId);
  const customer = await Customer.findOne({ $or: [{ id: customerId }, ...(isCustObjId ? [{ _id: customerId }] : [])] });
  if (!customer) throw ApiError.notFound('Customer not found');

  const company = (await Company.findOne()) || { stateCode: '24', invoice: { numberFormat: 'LLS/{FY}/{SEQ}', expiryPolicy: 'Warn' } };
  const interState = isInterState(company.stateCode, customer.stateCode);

  const batchIds = lines.map((l) => l.batchId).filter(Boolean);
  const productIds = lines.map((l) => l.productId).filter(Boolean);
  const validBatchObjIds = batchIds.filter(id => require('mongoose').Types.ObjectId.isValid(id));
  const validProdObjIds = productIds.filter(id => require('mongoose').Types.ObjectId.isValid(id));

  const [batches, products] = await Promise.all([
    ProductBatch.find({ $or: [{ id: { $in: batchIds } }, { _id: { $in: validBatchObjIds } }] }),
    Product.find({ $or: [{ id: { $in: productIds } }, { _id: { $in: validProdObjIds } }] }),
  ]);
  const batchMap = new Map();
  batches.forEach(b => { batchMap.set(b.id, b); batchMap.set(b._id.toString(), b); });

  const productMap = new Map();
  products.forEach(p => { productMap.set(p.id, p); productMap.set(p._id.toString(), p); });

  const computedLines = lines.map((l) => {
    if (!l.productId || !l.batchId || l.qty == null || l.rate == null) {
      throw ApiError.badRequest('Each line requires productId, batchId, qty and rate');
    }
    if (Number(l.qty) <= 0) throw ApiError.badRequest('Quantity must be greater than zero');
    if (Number(l.rate) < 0) throw ApiError.badRequest('Rate cannot be negative');
    const batch = batchMap.get(l.batchId);
    if (!batch) throw ApiError.notFound(`Batch ${l.batchId} not found`);
    const prod = productMap.get(l.productId);

    const c = calcLine({ qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate, isInterState: interState });
    return {
      productId: l.productId,
      productName: l.productName || prod?.name || '',
      pack: l.pack || prod?.pack || '',
      mfg: l.mfg || prod?.mfg || batch.mfg || '',
      batchId: batch.id,
      batchNo: batch.batchNo,
      expDate: batch.expDate,
      hsn: l.hsn || prod?.hsn || '',
      mrp: l.mrp !== undefined ? l.mrp : batch.mrp,
      ptr: l.ptr !== undefined ? l.ptr : (batch.ptr || batch.saleRate || 0),
      qty: Number(l.qty),
      freeQty: Number(l.freeQty) || 0,
      rate: Number(l.rate),
      discountPct: Number(l.discountPct) || 0,
      gstRate: Number(l.gstRate) || 0,
      taxableValue: c.taxableValue,
      cgst: c.cgst,
      sgst: c.sgst,
      igst: c.igst,
      total: c.total,
      gross: c.gross,
      discountAmt: c.discountAmt,
    };
  });
  const totals = calcDocumentTotals(computedLines);

  const newAmountReceived = amountReceived !== undefined ? Number(amountReceived) : sale.amountReceived;
  const newBalance = round2(totals.grandTotal - newAmountReceived);
  const paymentStatus = newBalance <= 0 ? 'Paid' : newAmountReceived > 0 ? 'Partial' : 'Unpaid';

  const updatedSale = await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    for (const oldLine of sale.lines) {
      await increaseStock({
        productId: oldLine.productId,
        batchId: oldLine.batchId,
        batchNo: oldLine.batchNo,
        qty: Number(oldLine.qty) + Number(oldLine.freeQty || 0),
        refType: 'Sale Reversal',
        refId: sale.id,
        createdBy: req.user?.name,
        session,
      });
    }

    for (const line of computedLines) {
      await decreaseStock({
        productId: line.productId,
        batchId: line.batchId,
        qty: Number(line.qty) + Number(line.freeQty || 0),
        refType: 'Sale Edit',
        refId: sale.id,
        createdBy: req.user?.name,
        session,
      });
    }

    const entryDate = date ? new Date(date) : new Date();
    await postCustomerEntry({ partyId: sale.customerId, date: entryDate, type: 'Adjustment', refId: sale.id, refNo: sale.invoiceNo, credit: before.grandTotal, session });
    await postCustomerEntry({ partyId: customerId, date: entryDate, type: 'Sale Edit', refId: sale.id, refNo: sale.invoiceNo, debit: totals.grandTotal, session });

    sale.customerId = customerId;
    sale.date = date || sale.date;
    sale.placeOfSupply = customer.state;
    sale.isInterState = interState;
    sale.lines = computedLines.map(({ gross, discountAmt, ...rest }) => rest);
    sale.taxableTotal = totals.taxableTotal;
    sale.cgstTotal = totals.cgstTotal;
    sale.sgstTotal = totals.sgstTotal;
    sale.igstTotal = totals.igstTotal;
    sale.grandTotal = totals.grandTotal;
    sale.amountReceived = newAmountReceived;
    sale.balance = newBalance;
    sale.paymentStatus = paymentStatus;

    await sale.save(opts);

    await logAudit({
      user: req.user?.name,
      action: 'Update',
      module: 'Sales',
      reference: sale.id,
      before,
      after: sale.toObject(),
      session,
    });
    return sale;
  });

  return ApiResponse.success(res, { message: 'Invoice updated and stock/ledger re-reconciled successfully', data: updatedSale });
});

const cancel = asyncHandler(async (req, res) => {
  const isObjId = require('mongoose').Types.ObjectId.isValid(req.params.id);
  const sale = await Sale.findOne({ $or: [{ id: req.params.id }, ...(isObjId ? [{ _id: req.params.id }] : []), { invoiceNo: req.params.id }] });
  if (!sale) throw ApiError.notFound('Invoice not found');
  if (sale.status === 'Cancelled') return ApiResponse.success(res, { message: 'Invoice already cancelled', data: sale });

  const before = sale.toObject();
  const cancelledSale = await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    for (const line of sale.lines) {
      await increaseStock({
        productId: line.productId,
        batchId: line.batchId,
        batchNo: line.batchNo,
        qty: Number(line.qty) + Number(line.freeQty || 0),
        refType: 'Sale Cancellation',
        refId: sale.id,
        createdBy: req.user?.name,
        session,
      });
    }

    await postCustomerEntry({ partyId: sale.customerId, date: new Date(), type: 'Cancellation', refId: sale.id, refNo: sale.invoiceNo, credit: sale.grandTotal, session });

    sale.status = 'Cancelled';
    sale.cancelReason = req.body.reason || 'Cancelled by user';
    await sale.save(opts);

    await logAudit({ user: req.user?.name, action: 'Cancel', module: 'Sales', reference: sale.id, before, after: sale.toObject(), session });
    return sale;
  });

  return ApiResponse.success(res, { message: 'Invoice cancelled and stock/ledger reversed successfully', data: cancelledSale });
});

module.exports = { list, getById, create, update, cancel };
