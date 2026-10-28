const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { generateId } = require('../utils/idGenerator');
const { Payment, Sale, Purchase, Customer, Supplier } = require('../models');
const { postCustomerEntry, postSupplierEntry, lastCustomerBalance, lastSupplierBalance } = require('../services/ledger.service');
const { logAudit } = require('../services/audit.service');
const { round2 } = require('../utils/money');
const { withTransaction } = require('../utils/transaction.util');

const list = asyncHandler(async (req, res) => {
  const { partyId, partyType } = req.query;
  const query = {};
  if (partyId) query.partyId = partyId;
  if (partyType) query.partyType = partyType;
  const data = await Payment.find(query).sort({ date: -1 });
  return ApiResponse.success(res, { data });
});

// ---------------------------------------------------------------------------
// FIFO invoice allocation helpers
// ---------------------------------------------------------------------------

/**
 * Allocate `amount` across open customer Sales (sorted oldest-first).
 * If `priorityInvoiceId` is provided that invoice is settled first; any
 * remaining amount then flows FIFO across other open invoices.
 * Returns an array of { sale, appliedAmount } for the caller to save.
 */
async function allocateCustomerFifo(partyId, amount, priorityInvoiceId, opts) {
  // Sale always had `balance` field (it's required:true), so a simple $gt filter
  // is safe. Sort oldest-date, oldest-ObjectId for deterministic FIFO.
  const openSales = await Sale.find(
    { customerId: partyId, status: 'Active', balance: { $gt: 0.009 } },
    null,
    opts,
  ).sort({ date: 1, _id: 1 });

  // Re-order so priority invoice comes first
  let ordered = openSales;
  if (priorityInvoiceId) {
    const idx = openSales.findIndex((s) => s.id === priorityInvoiceId);
    if (idx > 0) {
      ordered = [openSales[idx], ...openSales.slice(0, idx), ...openSales.slice(idx + 1)];
    }
  }

  let remaining = amount;
  const allocations = [];

  for (const sale of ordered) {
    if (remaining <= 0.009) break;
    const apply = Math.min(remaining, sale.balance);
    if (apply <= 0.009) continue;
    sale.amountReceived = round2(sale.amountReceived + apply);
    sale.balance = round2(sale.grandTotal - sale.amountReceived);
    sale.paymentStatus = sale.balance <= 0.009 ? 'Paid' : 'Partial';
    remaining = round2(remaining - apply);
    allocations.push({ sale, appliedAmount: apply });
  }

  return allocations;
}

/**
 * Allocate `amount` across open supplier Purchases (sorted oldest-first).
 * If `priorityInvoiceId` is provided that invoice is settled first.
 */
async function allocateSupplierFifo(partyId, amount, priorityInvoiceId, opts) {
  // Include legacy purchases where balance field may be 0 or undefined but
  // the derived (grandTotal - amountPaid) is positive.
  const openPurchases = await Purchase.find(
    {
      supplierId: partyId,
      status: 'Active',
      $or: [
        { balance: { $gt: 0.009 } },
        // Legacy records: no balance field yet but still unpaid
        { balance: { $exists: false }, paymentStatus: { $ne: 'Paid' } },
        { balance: null, paymentStatus: { $ne: 'Paid' } },
      ],
    },
    null,
    opts,
  ).sort({ purchaseDate: 1, _id: 1 });

  // Re-order so priority invoice comes first
  let ordered = openPurchases;
  if (priorityInvoiceId) {
    const idx = openPurchases.findIndex((p) => p.id === priorityInvoiceId);
    if (idx > 0) {
      ordered = [openPurchases[idx], ...openPurchases.slice(0, idx), ...openPurchases.slice(idx + 1)];
    }
  }

  let remaining = amount;
  const allocations = [];

  for (const purchase of ordered) {
    if (remaining <= 0.009) break;
    // balance field may not exist on legacy records; derive it
    const currentBalance = purchase.balance !== undefined
      ? purchase.balance
      : round2(purchase.grandTotal - purchase.amountPaid);
    if (currentBalance <= 0.009) continue;
    const apply = Math.min(remaining, currentBalance);
    purchase.amountPaid = round2(purchase.amountPaid + apply);
    purchase.balance = round2(purchase.grandTotal - purchase.amountPaid);
    purchase.paymentStatus = purchase.balance <= 0.009 ? 'Paid' : 'Partial';
    remaining = round2(remaining - apply);
    allocations.push({ purchase, appliedAmount: apply });
  }

  return allocations;
}

// ---------------------------------------------------------------------------
// Server is the final authority on "payment <= outstanding" — never trusts
// the frontend's own outstanding calculation.
// ---------------------------------------------------------------------------
const create = asyncHandler(async (req, res) => {
  const { partyId, partyType, invoiceId, amount, mode, reference, remarks, date } = req.body;
  const numAmount = Number(amount);
  if (!partyId || !partyType || !numAmount || isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    throw ApiError.badRequest('partyId, partyType and a positive numeric amount are required');
  }

  const saved = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // ------------------------------------------------------------------
    // 1. Validate party existence and authoritative outstanding balance
    // ------------------------------------------------------------------
    if (partyType === 'Customer') {
      const customer = await Customer.findOne({ id: partyId }, null, opts);
      if (!customer) throw ApiError.badRequest(`Customer with ID "${partyId}" does not exist in Customer Master`);
      const currentOutstanding = await lastCustomerBalance(partyId, session);
      if (currentOutstanding <= 0.01) {
        throw ApiError.badRequest(`Cannot receive payment: Customer "${customer.partyName}" has no positive outstanding balance (Current: ₹${currentOutstanding.toFixed(2)})`);
      }
      if (numAmount > currentOutstanding + 0.01) {
        throw ApiError.badRequest(`Payment amount (₹${numAmount.toFixed(2)}) cannot exceed customer's current outstanding balance (₹${currentOutstanding.toFixed(2)})`);
      }
    } else if (partyType === 'Supplier') {
      const supplier = await Supplier.findOne({ id: partyId }, null, opts);
      if (!supplier) throw ApiError.badRequest(`Supplier with ID "${partyId}" does not exist in Supplier Master`);
      const currentOutstanding = await lastSupplierBalance(partyId, session);
      if (currentOutstanding <= 0.01) {
        throw ApiError.badRequest(`Cannot make payment: Supplier "${supplier.company}" has no positive outstanding payable (Current: ₹${currentOutstanding.toFixed(2)})`);
      }
      if (numAmount > currentOutstanding + 0.01) {
        throw ApiError.badRequest(`Payment amount (₹${numAmount.toFixed(2)}) cannot exceed supplier's current outstanding payable (₹${currentOutstanding.toFixed(2)})`);
      }
    } else {
      throw ApiError.badRequest('Invalid partyType. Must be Customer or Supplier');
    }

    // ------------------------------------------------------------------
    // 2. Invoice-level validation when a specific invoice is selected
    // ------------------------------------------------------------------
    if (invoiceId) {
      if (partyType === 'Customer') {
        const sale = await Sale.findOne({ id: invoiceId }, null, opts);
        if (!sale) throw ApiError.notFound('Invoice not found');
        if (numAmount > sale.balance + 0.01) {
          throw ApiError.badRequest(`Payment amount (₹${numAmount.toFixed(2)}) cannot exceed the outstanding balance for invoice ${sale.invoiceNo} (₹${sale.balance.toFixed(2)})`);
        }
      } else {
        const purchase = await Purchase.findOne({ id: invoiceId }, null, opts);
        if (!purchase) throw ApiError.notFound('Purchase not found');
        const purchaseBalance = purchase.balance !== undefined
          ? purchase.balance
          : round2(purchase.grandTotal - purchase.amountPaid);
        if (numAmount > purchaseBalance + 0.01) {
          throw ApiError.badRequest(`Payment amount (₹${numAmount.toFixed(2)}) cannot exceed the outstanding payable for purchase ${purchase.purchaseInvoiceNo} (₹${purchaseBalance.toFixed(2)})`);
        }
      }
    }

    // ------------------------------------------------------------------
    // 3. FIFO allocation across open invoices
    // ------------------------------------------------------------------
    let allocationSummary = [];

    if (partyType === 'Customer') {
      // Allocate FIFO across open Sales (priority invoice first if selected)
      const allocations = await allocateCustomerFifo(partyId, numAmount, invoiceId || null, opts);
      for (const { sale } of allocations) {
        await sale.save(opts);
      }
      allocationSummary = allocations.map(({ sale, appliedAmount }) => ({
        invoiceId: sale.id,
        invoiceNo: sale.invoiceNo,
        appliedAmount,
      }));
    } else {
      // Allocate FIFO across open Purchases (priority invoice first if selected)
      const allocations = await allocateSupplierFifo(partyId, numAmount, invoiceId || null, opts);
      for (const { purchase } of allocations) {
        await purchase.save(opts);
      }
      allocationSummary = allocations.map(({ purchase, appliedAmount }) => ({
        invoiceId: purchase.id,
        invoiceNo: purchase.purchaseInvoiceNo,
        appliedAmount,
      }));
    }

    // ------------------------------------------------------------------
    // 4. Persist the Payment record
    // ------------------------------------------------------------------
    const id = await generateId('PAY', 'payment', 6, session, Payment);
    const [payment] = await Payment.create([{
      id,
      partyId,
      partyType,
      invoiceId: invoiceId || '',
      amount: numAmount,
      mode,
      date: date || new Date(),
      reference,
      remarks,
      createdBy: req.user?.name,
    }], opts);

    // ------------------------------------------------------------------
    // 5. Post running-balance ledger entry
    // ------------------------------------------------------------------
    if (partyType === 'Customer') {
      await postCustomerEntry({ partyId, date: payment.date, type: 'Payment', refId: payment.id, refNo: reference || payment.id, credit: numAmount, session });
    } else {
      await postSupplierEntry({ partyId, date: payment.date, type: 'Payment', refId: payment.id, refNo: reference || payment.id, debit: numAmount, session });
    }

    await logAudit({ user: req.user?.name, action: 'Create', module: 'Payments', reference: id, after: { ...payment.toObject(), allocationSummary }, session });
    return payment;
  });

  return ApiResponse.created(res, { message: 'Payment recorded successfully', data: saved });
});

module.exports = { list, create };
