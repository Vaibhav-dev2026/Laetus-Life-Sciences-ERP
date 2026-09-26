const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { generateId } = require('../utils/idGenerator');
const { Purchase, Supplier, ProductBatch, Product, Payment } = require('../models');
const { calcLine, calcDocumentTotals } = require('../services/gstCalculation.service');
const { increaseStock, decreaseStock } = require('../services/stock.service');
const { postSupplierEntry } = require('../services/ledger.service');
const { logAudit } = require('../services/audit.service');
const { currentFinancialYear, nextInvoiceNumber } = require('../services/invoiceNumber.service');
const { round2 } = require('../utils/money');
const { withTransaction } = require('../utils/transaction.util');

const list = asyncHandler(async (req, res) => {
  const { search, supplierId, page = 1, limit = 100 } = req.query;
  const query = { status: 'Active' };
  if (supplierId) query.supplierId = supplierId;
  if (search) query.$or = [{ purchaseInvoiceNo: { $regex: search, $options: 'i' } }, { supplierInvoiceNo: { $regex: search, $options: 'i' } }];
  const pageNum = Math.max(1, Number(page)); const limitNum = Math.min(500, Number(limit));
  const [data, total] = await Promise.all([
    Purchase.find(query).sort({ purchaseDate: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Purchase.countDocuments(query),
  ]);
  return ApiResponse.success(res, { data, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
});

const getById = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({ id: req.params.id });
  if (!purchase) throw ApiError.notFound('Purchase not found');
  return ApiResponse.success(res, { data: purchase });
});

const create = asyncHandler(async (req, res) => {
  const { purchaseInvoiceNo, purchaseDate, supplierId, supplierInvoiceNo, dueDate, lines, amountPaid, paymentStatus } = req.body;

  if (!supplierId) throw ApiError.badRequest('supplierId is required');
  if (!Array.isArray(lines) || lines.length === 0) throw ApiError.badRequest('At least one product line is required');

  const isSuppObjId = require('mongoose').Types.ObjectId.isValid(supplierId);
  const supplier = await Supplier.findOne({ $or: [{ id: supplierId }, ...(isSuppObjId ? [{ _id: supplierId }] : [])] });
  if (!supplier) throw ApiError.notFound('Supplier not found');

  const productIds = lines.map((l) => l.productId).filter(Boolean);
  const validProdObjIds = productIds.filter(id => require('mongoose').Types.ObjectId.isValid(id));
  const products = await Product.find({ $or: [{ id: { $in: productIds } }, { _id: { $in: validProdObjIds } }] });
  const productMap = new Map();
  products.forEach(p => { productMap.set(p.id, p); productMap.set(p._id.toString(), p); });

  const computedLines = lines.map((l) => {
    const cleanBatchNo = String(l.batchNo || '').trim();
    if (!l.productId || !cleanBatchNo || !l.expDate || l.qty == null || l.rate == null) {
      throw ApiError.badRequest('Each line requires productId, batchNo, expDate, qty and rate (PTS)');
    }
    if (Number(l.qty) <= 0) throw ApiError.badRequest('Quantity must be greater than zero');
    if (Number(l.rate) < 0) throw ApiError.badRequest('Rate cannot be negative');
    const prod = productMap.get(l.productId);
    const c = calcLine({ qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate, isInterState: false });
    return {
      productId: l.productId,
      productName: l.productName || prod?.name || '',
      pack: l.pack || prod?.pack || '',
      mfg: l.mfg || prod?.mfg || '',
      batchNo: cleanBatchNo,
      mfgDate: l.mfgDate,
      expDate: l.expDate,
      hsn: l.hsn || prod?.hsn || '',
      mrp: Number(l.mrp !== undefined ? l.mrp : (prod?.mrp || 0)),
      pts: Number(l.pts !== undefined ? l.pts : l.rate),
      rate: Number(l.rate),
      qty: Number(l.qty),
      freeQty: Number(l.freeQty) || 0,
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

  // Request-Key Based & Line-Item Fingerprint Idempotency Protection
  const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey || req.body?.requestId;

  if (idempotencyKey && String(idempotencyKey).trim()) {
    const keyStr = String(idempotencyKey).trim();
    const existing = await Purchase.findOne({ idempotencyKey: keyStr });
    if (existing) {
      if (existing.supplierId !== supplierId || Math.abs(existing.grandTotal - totals.grandTotal) > 0.01) {
        return res.status(409).json({ success: false, message: 'Idempotency key conflict: key already used for a different payload' });
      }
      return ApiResponse.success(res, { message: 'Purchase already processed (idempotent request)', data: existing });
    }
  } else {
    // Fast double-click suppression (within 5 seconds) matching EXACT supplier, total, and line item fingerprint
    const fiveSecsAgo = new Date(Date.now() - 5000);
    const lineFingerprint = lines.map(l => `${l.productId}_${l.batchNo}_${l.qty}_${l.rate}`).sort().join('|');
    const recentCandidates = await Purchase.find({
      supplierId,
      grandTotal: totals.grandTotal,
      status: { $ne: 'Cancelled' },
      createdAt: { $gte: fiveSecsAgo },
    });
    const exactDuplicate = recentCandidates.find(p => {
      const candidateFingerprint = (p.lines || []).map(l => `${l.productId}_${l.batchNo}_${l.qty}_${l.rate}`).sort().join('|');
      return candidateFingerprint === lineFingerprint;
    });
    if (exactDuplicate) {
      return ApiResponse.success(res, { message: 'Purchase already processed (duplicate request suppressed)', data: exactDuplicate });
    }
  }

  if (supplierInvoiceNo && String(supplierInvoiceNo).trim()) {
    const existingSuppInv = await Purchase.findOne({
      supplierId,
      supplierInvoiceNo: String(supplierInvoiceNo).trim(),
      status: { $ne: 'Cancelled' },
      createdAt: { $gte: new Date(Date.now() - 300000) },
    });
    if (existingSuppInv && (!idempotencyKey || existingSuppInv.idempotencyKey !== String(idempotencyKey).trim())) {
      return ApiResponse.success(res, { message: 'Purchase with this supplier invoice already saved', data: existingSuppInv });
    }
  }

  // Determine effective amount paid and payment status
  let effectiveAmountPaid = 0;
  if (paymentStatus === 'Paid') {
    effectiveAmountPaid = totals.grandTotal;
  } else if (amountPaid !== undefined && amountPaid !== null && amountPaid !== '') {
    effectiveAmountPaid = Math.max(0, Number(amountPaid) || 0);
  } else if (paymentStatus === 'Partial' && req.body.partialAmount) {
    effectiveAmountPaid = Math.max(0, Number(req.body.partialAmount) || 0);
  }

  let effectivePaymentStatus = 'Unpaid';
  if (effectiveAmountPaid >= totals.grandTotal && totals.grandTotal > 0) {
    effectivePaymentStatus = 'Paid';
    effectiveAmountPaid = totals.grandTotal;
  } else if (effectiveAmountPaid > 0) {
    effectivePaymentStatus = 'Partial';
  }

  const saved = await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const id = await generateId('PUR', 'purchase', 6, session, Purchase);
    const financialYear = currentFinancialYear(purchaseDate);

    let finalPurchaseInvoiceNo = purchaseInvoiceNo ? String(purchaseInvoiceNo).trim() : null;
    if (!finalPurchaseInvoiceNo) {
      const invInfo = await nextInvoiceNumber({ series: 'PUR', financialYear, format: 'PUR-{SEQ}', session });
      finalPurchaseInvoiceNo = invInfo.invoiceNo;
    }

    // 1. Upsert stock batches first so batchId is assigned
    for (const line of computedLines) {
      const prod = productMap.get(line.productId);
      const batch = await increaseStock({
        productId: line.productId,
        batchNo: line.batchNo,
        mfgDate: line.mfgDate,
        expDate: line.expDate,
        qty: Number(line.qty) + Number(line.freeQty || 0),
        purchaseRate: line.rate,
        saleRate: line.saleRate || prod?.saleRate || prod?.ptr || line.mrp || line.rate,
        mrp: line.mrp || prod?.mrp || line.rate,
        supplierId,
        refType: 'Purchase',
        refId: id,
        createdBy: req.user?.name,
        session,
      });
      if (batch && batch.id) {
        line.batchId = batch.id;
      }
    }

    // 2. Create Purchase document
    const [purchase] = await Purchase.create([{
      id,
      purchaseInvoiceNo: finalPurchaseInvoiceNo,
      purchaseDate: purchaseDate || new Date(),
      supplierId,
      supplierInvoiceNo: supplierInvoiceNo || '',
      dueDate,
      lines: computedLines.map(({ gross, discountAmt, ...rest }) => rest),
      ...totals,
      amountPaid: effectiveAmountPaid,
      paymentStatus: effectivePaymentStatus,
      financialYear,
      createdBy: req.user?.name,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
    }], opts);

    await postSupplierEntry({ partyId: supplierId, date: purchaseDate || new Date(), type: 'Purchase', refId: purchase.id, refNo: finalPurchaseInvoiceNo, credit: totals.grandTotal, session });

    if (effectiveAmountPaid > 0) {
      const paymentId = await generateId('PAY', 'payment', 6, session, Payment);
      await Payment.create([{ id: paymentId, partyId: supplierId, partyType: 'Supplier', invoiceId: purchase.id, amount: effectiveAmountPaid, mode: req.body.paymentMode || 'Bank Transfer', date: purchaseDate || new Date(), createdBy: req.user?.name }], opts);
      await postSupplierEntry({ partyId: supplierId, date: purchaseDate || new Date(), type: 'Payment', refId: paymentId, refNo: paymentId, debit: effectiveAmountPaid, session });
    }

    await logAudit({ user: req.user?.name, action: 'Create', module: 'Purchases', reference: purchase.id, after: purchase.toObject(), session });
    return purchase;
  });
  return ApiResponse.created(res, { message: 'Purchase saved successfully', data: saved });
});

const update = asyncHandler(async (req, res) => {
  const isObjId = require('mongoose').Types.ObjectId.isValid(req.params.id);
  const purchase = await Purchase.findOne({ $or: [{ id: req.params.id }, { purchaseInvoiceNo: req.params.id }, ...(isObjId ? [{ _id: req.params.id }] : [])] });
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (purchase.status === 'Cancelled') throw ApiError.badRequest('Cannot edit a cancelled purchase');

  const before = purchase.toObject();
  const { purchaseInvoiceNo = purchase.purchaseInvoiceNo, purchaseDate = purchase.purchaseDate, supplierId = purchase.supplierId, supplierInvoiceNo = purchase.supplierInvoiceNo, dueDate = purchase.dueDate, lines = purchase.lines, amountPaid, paymentStatus } = req.body;

  const supplier = await Supplier.findOne({ $or: [{ id: supplierId }, ...(require('mongoose').Types.ObjectId.isValid(supplierId) ? [{ _id: supplierId }] : [])] });
  if (!supplier) throw ApiError.notFound('Supplier not found');

  const productIds = lines.map((l) => l.productId).filter(Boolean);
  const products = await Product.find({ id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const computedLines = lines.map((l) => {
    const cleanBatchNo = String(l.batchNo || '').trim();
    if (!l.productId || !cleanBatchNo || !l.expDate || l.qty == null || l.rate == null) {
      throw ApiError.badRequest('Each line requires productId, batchNo, expDate, qty and rate (PTS)');
    }
    if (Number(l.qty) <= 0) throw ApiError.badRequest('Quantity must be greater than zero');
    if (Number(l.rate) < 0) throw ApiError.badRequest('Rate cannot be negative');
    const prod = productMap.get(l.productId);
    const c = calcLine({ qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate, isInterState: false });
    return {
      productId: l.productId,
      productName: l.productName || prod?.name || '',
      pack: l.pack || prod?.pack || '',
      mfg: l.mfg || prod?.mfg || '',
      batchNo: cleanBatchNo,
      mfgDate: l.mfgDate,
      expDate: l.expDate,
      hsn: l.hsn || prod?.hsn || '',
      mrp: Number(l.mrp !== undefined ? l.mrp : (prod?.mrp || 0)),
      pts: Number(l.pts !== undefined ? l.pts : l.rate),
      rate: Number(l.rate),
      qty: Number(l.qty),
      freeQty: Number(l.freeQty) || 0,
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

  // Determine effective amount paid and payment status for update
  let effectiveAmountPaid = 0;
  if (paymentStatus === 'Paid') {
    effectiveAmountPaid = totals.grandTotal;
  } else if (paymentStatus === 'Unpaid') {
    effectiveAmountPaid = 0;
  } else if (amountPaid !== undefined && amountPaid !== null && amountPaid !== '') {
    effectiveAmountPaid = Math.max(0, Number(amountPaid) || 0);
  } else {
    effectiveAmountPaid = before.amountPaid || 0;
  }

  let effectivePaymentStatus = 'Unpaid';
  if (effectiveAmountPaid >= totals.grandTotal && totals.grandTotal > 0) {
    effectivePaymentStatus = 'Paid';
    effectiveAmountPaid = totals.grandTotal;
  } else if (effectiveAmountPaid > 0) {
    effectivePaymentStatus = 'Partial';
  }

  const updatedPurchase = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // 1. Reconcile stock: decrease stock by old lines first
    for (const oldLine of purchase.lines) {
      const batch = await ProductBatch.findOne({ productId: oldLine.productId, batchNo: oldLine.batchNo }, null, opts);
      if (batch) {
        await decreaseStock({
          productId: oldLine.productId,
          batchId: batch.id,
          qty: Number(oldLine.qty) + Number(oldLine.freeQty || 0),
          refType: 'Purchase Reversal',
          refId: purchase.id,
          createdBy: req.user?.name,
          session,
        });
      }
    }

    // 2. Increase stock for new lines
    for (const line of computedLines) {
      const prod = productMap.get(line.productId);
      const batch = await increaseStock({
        productId: line.productId,
        batchNo: line.batchNo,
        mfgDate: line.mfgDate,
        expDate: line.expDate,
        qty: Number(line.qty) + Number(line.freeQty || 0),
        purchaseRate: line.rate,
        saleRate: line.saleRate || prod?.saleRate || prod?.ptr || line.mrp || line.rate,
        mrp: line.mrp || prod?.mrp || line.rate,
        supplierId,
        refType: 'Purchase Edit',
        refId: purchase.id,
        createdBy: req.user?.name,
        session,
      });
      if (batch && batch.id) {
        line.batchId = batch.id;
      }
    }

    // 3. Post SupplierLedger entries for adjustment & new purchase amount
    const entryDate = purchaseDate ? new Date(purchaseDate) : new Date();
    await postSupplierEntry({ partyId: purchase.supplierId, date: entryDate, type: 'Adjustment', refId: purchase.id, refNo: purchase.purchaseInvoiceNo, debit: before.grandTotal, session });
    await postSupplierEntry({ partyId: supplierId, date: entryDate, type: 'Purchase Edit', refId: purchase.id, refNo: purchase.purchaseInvoiceNo, credit: totals.grandTotal, session });

    // Handle payment difference if effectiveAmountPaid changed
    const prevAmountPaid = before.amountPaid || 0;
    if (effectiveAmountPaid > prevAmountPaid) {
      const paidDiff = round2(effectiveAmountPaid - prevAmountPaid);
      const paymentId = await generateId('PAY', 'payment', 6, session, Payment);
      await Payment.create([{ id: paymentId, partyId: supplierId, partyType: 'Supplier', invoiceId: purchase.id, amount: paidDiff, mode: req.body.paymentMode || 'Bank Transfer', date: entryDate, createdBy: req.user?.name }], opts);
      await postSupplierEntry({ partyId: supplierId, date: entryDate, type: 'Payment', refId: paymentId, refNo: paymentId, debit: paidDiff, session });
    } else if (effectiveAmountPaid < prevAmountPaid) {
      const refundDiff = round2(prevAmountPaid - effectiveAmountPaid);
      await postSupplierEntry({ partyId: supplierId, date: entryDate, type: 'Adjustment', refId: purchase.id, refNo: purchase.purchaseInvoiceNo, credit: refundDiff, session });
    }

    // 4. Update Purchase document
    purchase.purchaseDate = purchaseDate || purchase.purchaseDate;
    purchase.supplierId = supplierId;
    purchase.supplierInvoiceNo = supplierInvoiceNo || purchase.supplierInvoiceNo;
    purchase.dueDate = dueDate || purchase.dueDate;
    purchase.lines = computedLines.map(({ gross, discountAmt, ...rest }) => rest);
    purchase.taxableTotal = totals.taxableTotal;
    purchase.cgstTotal = totals.cgstTotal;
    purchase.sgstTotal = totals.sgstTotal;
    purchase.igstTotal = totals.igstTotal;
    purchase.grandTotal = totals.grandTotal;
    purchase.amountPaid = effectiveAmountPaid;
    purchase.paymentStatus = effectivePaymentStatus;

    await purchase.save(opts);

    await logAudit({
      user: req.user?.name,
      action: 'Update',
      module: 'Purchases',
      reference: purchase.id,
      before,
      after: purchase.toObject(),
      session,
    });
    return purchase;
  });

  return ApiResponse.success(res, { message: 'Purchase updated and stock/ledger re-reconciled successfully', data: updatedPurchase });
});

const cancel = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({ id: req.params.id });
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (purchase.status === 'Cancelled') return ApiResponse.success(res, { message: 'Purchase already cancelled', data: purchase });

  const before = purchase.toObject();

  const saved = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    for (const line of purchase.lines) {
      const batch = await ProductBatch.findOne({ productId: line.productId, batchNo: line.batchNo }, null, opts);
      if (batch) {
        await decreaseStock({
          productId: line.productId,
          batchId: batch.id,
          qty: Number(line.qty) + Number(line.freeQty || 0),
          refType: 'Purchase Cancellation',
          refId: purchase.id,
          createdBy: req.user?.name,
          session,
        });
      }
    }

    await postSupplierEntry({
      partyId: purchase.supplierId,
      date: new Date(),
      type: 'Cancellation',
      refId: purchase.id,
      refNo: purchase.purchaseInvoiceNo,
      debit: purchase.grandTotal,
      session,
    });

    purchase.status = 'Cancelled';
    purchase.cancelReason = req.body.reason || 'Cancelled by user';
    await purchase.save(opts);

    await logAudit({ user: req.user?.name, action: 'Cancel', module: 'Purchases', reference: purchase.id, before, after: purchase.toObject(), session });
    return purchase;
  });

  return ApiResponse.success(res, { message: 'Purchase cancelled and stock/ledger reversed successfully', data: saved });
});

module.exports = { list, getById, create, update, cancel };
