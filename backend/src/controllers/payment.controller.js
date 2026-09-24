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

// Server is the final authority on "payment <= outstanding" — never trusts
// the frontend's own outstanding calculation.
const create = asyncHandler(async (req, res) => {
  const { partyId, partyType, invoiceId, amount, mode, reference, remarks, date } = req.body;
  const numAmount = Number(amount);
  if (!partyId || !partyType || !numAmount || isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    throw ApiError.badRequest('partyId, partyType and a positive numeric amount are required');
  }

  const saved = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Validate party existence and authoritative outstanding balance from DB
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

    if (invoiceId) {
      if (partyType === 'Customer') {
        const sale = await Sale.findOne({ id: invoiceId }, null, opts);
        if (!sale) throw ApiError.notFound('Invoice not found');
        if (numAmount > sale.balance + 0.01) throw ApiError.badRequest(`Payment amount (₹${numAmount.toFixed(2)}) cannot exceed the outstanding balance for invoice ${sale.invoiceNo} (₹${sale.balance.toFixed(2)})`);
        sale.amountReceived = round2(sale.amountReceived + numAmount);
        sale.balance = round2(sale.grandTotal - sale.amountReceived);
        sale.paymentStatus = sale.balance <= 0 ? 'Paid' : 'Partial';
        await sale.save(opts);
      } else {
        const purchase = await Purchase.findOne({ id: invoiceId }, null, opts);
        if (!purchase) throw ApiError.notFound('Purchase not found');
        const outstanding = round2(purchase.grandTotal - purchase.amountPaid);
        if (numAmount > outstanding + 0.01) throw ApiError.badRequest(`Payment amount (₹${numAmount.toFixed(2)}) cannot exceed the outstanding payable for purchase ${purchase.purchaseInvoiceNo} (₹${outstanding.toFixed(2)})`);
        purchase.amountPaid = round2(purchase.amountPaid + numAmount);
        purchase.paymentStatus = purchase.amountPaid >= purchase.grandTotal ? 'Paid' : 'Partial';
        await purchase.save(opts);
      }
    }

    const id = await generateId('PAY', 'payment', 6, session, Payment);
    const [payment] = await Payment.create([{ id, partyId, partyType, invoiceId, amount: numAmount, mode, date: date || new Date(), reference, remarks, createdBy: req.user?.name }], opts);

    if (partyType === 'Customer') {
      await postCustomerEntry({ partyId, date: payment.date, type: 'Payment', refId: payment.id, refNo: reference || payment.id, credit: numAmount, session });
    } else {
      await postSupplierEntry({ partyId, date: payment.date, type: 'Payment', refId: payment.id, refNo: reference || payment.id, debit: numAmount, session });
    }

    await logAudit({ user: req.user?.name, action: 'Create', module: 'Payments', reference: id, after: payment.toObject(), session });
    return payment;
  });
  return ApiResponse.created(res, { message: 'Payment recorded successfully', data: saved });
});

module.exports = { list, create };
