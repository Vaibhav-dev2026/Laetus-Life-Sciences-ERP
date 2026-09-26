const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { Sale, Purchase, ProductBatch, Product, Customer, Supplier, Payment, Expense } = require('../models');
const { round2 } = require('../utils/money');
const { buildDateQuery } = require('../utils/dateRange.util');

const salesReport = asyncHandler(async (req, res) => {
  const { from, to, financialYear } = req.query;
  const dateFilter = buildDateQuery({ from, to, financialYear });
  const query = { status: { $ne: 'Cancelled' } };
  if (dateFilter) query.date = dateFilter;

  const sales = await Sale.find(query).sort({ date: -1 });
  const customers = await Customer.find({ id: { $in: sales.map((s) => s.customerId) } });
  const map = new Map(customers.map((c) => [c.id, c.partyName]));
  const data = sales.map((s) => ({
    id: s.id,
    invoiceNo: s.invoiceNo,
    date: s.date,
    customer: map.get(s.customerId) || s.customerId,
    items: Array.isArray(s.lines) ? s.lines.length : 0,
    amount: round2(s.grandTotal || 0),
    status: s.paymentStatus || s.status || 'Active',
  }));
  return ApiResponse.success(res, { data });
});

const purchaseReport = asyncHandler(async (req, res) => {
  const { from, to, financialYear } = req.query;
  const dateFilter = buildDateQuery({ from, to, financialYear });
  const query = { status: { $ne: 'Cancelled' } };
  if (dateFilter) query.purchaseDate = dateFilter;

  const purchases = await Purchase.find(query).sort({ purchaseDate: -1 });
  const suppliers = await Supplier.find({ id: { $in: purchases.map((p) => p.supplierId) } });
  const map = new Map(suppliers.map((s) => [s.id, s.company]));
  const data = purchases.map((p) => ({
    id: p.id,
    purchaseInvoiceNo: p.purchaseInvoiceNo,
    date: p.purchaseDate,
    supplier: map.get(p.supplierId) || p.supplierId,
    items: Array.isArray(p.lines) ? p.lines.length : 0,
    amount: round2(p.grandTotal || 0),
    status: p.paymentStatus || p.status || 'Active',
  }));
  return ApiResponse.success(res, { data });
});

const stockReport = asyncHandler(async (req, res) => {
  const { from, to, financialYear } = req.query;
  const dateFilter = buildDateQuery({ from, to, financialYear });
  const query = {};
  if (dateFilter) query.createdAt = dateFilter;

  const batches = await ProductBatch.find(query).sort({ expDate: 1 });
  const products = await Product.find({ id: { $in: batches.map((b) => b.productId) } });
  const map = new Map(products.map((p) => [p.id, p.name]));
  const data = batches.map((b) => ({
    id: b.id,
    product: map.get(b.productId) || b.productId,
    batchNo: b.batchNo,
    expiry: b.expDate,
    qty: b.currentQty || 0,
    value: round2((b.currentQty || 0) * (b.purchaseRate || 0)),
    status: b.status || 'Healthy',
  }));
  return ApiResponse.success(res, { data });
});

const financialReport = asyncHandler(async (req, res) => {
  const { from, to, financialYear } = req.query;
  const dateFilter = buildDateQuery({ from, to, financialYear });

  const saleMatch = { status: { $ne: 'Cancelled' } };
  const paymentMatch = {};
  const expenseMatch = {};

  if (dateFilter) {
    saleMatch.date = dateFilter;
    paymentMatch.date = dateFilter;
    expenseMatch.date = dateFilter;
  }

  const [receivableAgg] = await Sale.aggregate([{ $match: saleMatch }, { $group: { _id: null, total: { $sum: '$balance' } } }]);
  const [payableAgg] = await Supplier.aggregate([{ $group: { _id: null, total: { $sum: '$openingPayable' } } }]);
  const [paymentsAgg] = await Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const [expensesAgg] = await Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]);

  return ApiResponse.success(res, {
    data: {
      receivable: round2(receivableAgg?.total || 0),
      payable: round2(payableAgg?.total || 0),
      totalPayments: round2(paymentsAgg?.total || 0),
      totalExpenses: round2(expensesAgg?.total || 0),
    },
  });
});

module.exports = { salesReport, purchaseReport, stockReport, financialReport };
