const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { Sale, Purchase, Product, ProductBatch, Customer, Supplier, SalesReturn } = require('../models');
const { round2 } = require('../utils/money');
const { buildDateQuery } = require('../utils/dateRange.util');

// All dashboard numbers are computed via authoritative MongoDB aggregations
const summary = asyncHandler(async (req, res) => {
  const fromParam = req.query.from || req.query.startDate;
  const toParam = req.query.to || req.query.endDate;
  const fyParam = req.query.financialYear || req.query.fy;

  const customDateRange = buildDateQuery({ from: fromParam, to: toParam, financialYear: fyParam });

  const startOfToday = dayjs().startOf('day').toDate();
  const endOfToday = dayjs().endOf('day').toDate();

  const startOfMonth = dayjs().startOf('month').toDate();
  const endOfMonth = dayjs().endOf('month').toDate();

  // 1. Sales Today: strictly current calendar day
  const [todaySalesAgg] = await Sale.aggregate([
    { $match: { status: 'Active', date: { $gte: startOfToday, $lte: endOfToday } } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]);

  // 2. Monthly Sales: current calendar month (or custom date range if selected)
  const monthSaleDateMatch = customDateRange || { $gte: startOfMonth, $lte: endOfMonth };
  const [monthlySalesAgg] = await Sale.aggregate([
    { $match: { status: 'Active', date: monthSaleDateMatch } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]);

  // 3. Purchase Today: strictly current calendar day
  const [todayPurchaseAgg] = await Purchase.aggregate([
    { $match: { status: 'Active', purchaseDate: { $gte: startOfToday, $lte: endOfToday } } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]);

  // Total Purchases (all-time active)
  const [totalPurchasesAgg] = await Purchase.aggregate([
    { $match: { status: 'Active' } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]);

  // 4. Outstanding Receivable: open invoices + remaining opening balances
  const [outstandingAgg] = await Sale.aggregate([
    { $match: { status: 'Active', balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);

  const [customerBalAgg] = await Customer.aggregate([
    { $match: { status: 'Active', currentBalance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$currentBalance' } } },
  ]);

  const totalOutstandingReceivable = round2(
    Math.max(outstandingAgg?.total || 0, customerBalAgg?.total || 0)
  );

  // 5. Supplier Payable: open purchase balances + remaining opening payables
  const [purchasePayableAgg] = await Purchase.aggregate([
    { $match: { status: 'Active', balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);

  const [supplierBalAgg] = await Supplier.aggregate([
    { $match: { status: 'Active', currentPayable: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$currentPayable' } } },
  ]);

  const [payableAgg] = await Supplier.aggregate([
    { $match: { status: 'Active' } },
    { $group: { _id: null, total: { $sum: '$openingPayable' } } },
  ]);

  const totalSupplierPayable = round2(
    Math.max(
      (payableAgg?.total || 0) + (purchasePayableAgg?.total || 0),
      supplierBalAgg?.total || 0
    )
  );

  // 6. Inventory metrics
  const [stockValueAgg] = await ProductBatch.aggregate([
    { $group: { _id: null, total: { $sum: { $multiply: ['$currentQty', '$purchaseRate'] } } } },
  ]);

  const lowStock = await Product.countDocuments({
    status: 'Active',
    $expr: {
      $and: [
        { $gt: ['$currentStock', 0] },
        { $lte: ['$currentStock', { $ifNull: ['$reorderLevel', '$minStock', 10] }] },
      ],
    },
  });

  const outOfStock = await Product.countDocuments({
    status: 'Active',
    currentStock: { $lte: 0 },
  });

  const nearExpiry = await ProductBatch.countDocuments({ status: 'Near Expiry' });
  const expired = await ProductBatch.countDocuments({ status: 'Expired' });
  const totalCustomers = await Customer.countDocuments({ status: 'Active' });
  const totalSuppliers = await Supplier.countDocuments({ status: 'Active' });

  return ApiResponse.success(res, {
    data: {
      salesToday: round2(todaySalesAgg?.total || 0),
      monthlySales: round2(monthlySalesAgg?.total || 0),
      purchaseToday: round2(todayPurchaseAgg?.total || 0),
      totalPurchases: round2(totalPurchasesAgg?.total || 0),
      outstandingReceivable: totalOutstandingReceivable,
      supplierPayable: totalSupplierPayable,
      stockValue: round2(stockValueAgg?.total || 0),
      lowStock,
      outOfStock,
      nearExpiry,
      expired,
      totalCustomers,
      totalSuppliers,
    },
  });
});

const salesTrend = asyncHandler(async (req, res) => {
  const fromParam = req.query.from || req.query.startDate;
  const toParam = req.query.to || req.query.endDate;
  const fyParam = req.query.financialYear || req.query.fy;

  const customDateRange = buildDateQuery({ from: fromParam, to: toParam, financialYear: fyParam });
  const since = customDateRange || { $gte: dayjs().subtract(13, 'day').startOf('day').toDate() };

  const rows = await Sale.aggregate([
    { $match: { status: 'Active', date: since } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, sales: { $sum: '$grandTotal' } } },
    { $sort: { _id: 1 } },
  ]);

  const purchaseRows = await Purchase.aggregate([
    { $match: { status: 'Active', purchaseDate: since } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } }, purchase: { $sum: '$grandTotal' } } },
  ]);

  const purchaseMap = new Map(purchaseRows.map((r) => [r._id, r.purchase]));
  const data = rows.map((r) => ({
    date: dayjs(r._id).format('DD MMM'),
    sales: round2(r.sales),
    purchase: round2(purchaseMap.get(r._id) || 0),
  }));

  return ApiResponse.success(res, { data });
});

const purchaseVsSales = asyncHandler(async (req, res) => salesTrend(req, res));

const topProducts = asyncHandler(async (req, res) => {
  const fromParam = req.query.from || req.query.startDate;
  const toParam = req.query.to || req.query.endDate;
  const fyParam = req.query.financialYear || req.query.fy;

  const customDateRange = buildDateQuery({ from: fromParam, to: toParam, financialYear: fyParam });
  const saleMatch = { status: 'Active', ...(customDateRange ? { date: customDateRange } : {}) };

  const rows = await Sale.aggregate([
    { $match: saleMatch },
    { $unwind: '$lines' },
    { $group: { _id: '$lines.productId', name: { $first: '$lines.productName' }, value: { $sum: '$lines.total' } } },
    { $sort: { value: -1 } },
    { $limit: 5 },
  ]);
  return ApiResponse.success(res, { data: rows.map((r) => ({ name: r.name || r._id, value: round2(r.value) })) });
});

const outstandingAgeing = asyncHandler(async (req, res) => {
  const sales = await Sale.find({ status: 'Active', balance: { $gt: 0.5 } });
  const totals = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  sales.forEach((s) => {
    const days = Math.max(0, dayjs().diff(dayjs(s.dueDate || s.date), 'day'));
    const bucket = days > 90 ? '90+' : days > 60 ? '61-90' : days > 30 ? '31-60' : '0-30';
    totals[bucket] = round2(totals[bucket] + s.balance);
  });
  return ApiResponse.success(res, { data: Object.entries(totals).map(([bucket, amount]) => ({ bucket, amount })) });
});

const gstSummary = asyncHandler(async (req, res) => {
  const fromParam = req.query.from || req.query.startDate;
  const toParam = req.query.to || req.query.endDate;
  const fyParam = req.query.financialYear || req.query.fy;

  const customDateRange = buildDateQuery({ from: fromParam, to: toParam, financialYear: fyParam });
  const saleMatch = { status: 'Active', ...(customDateRange ? { date: customDateRange } : {}) };

  const [agg] = await Sale.aggregate([
    { $match: saleMatch },
    { $group: { _id: null, cgst: { $sum: '$cgstTotal' }, sgst: { $sum: '$sgstTotal' }, igst: { $sum: '$igstTotal' } } },
  ]);
  const data = [
    { name: 'CGST', value: round2(agg?.cgst || 0) },
    { name: 'SGST', value: round2(agg?.sgst || 0) },
    { name: 'IGST', value: round2(agg?.igst || 0) },
  ];
  return ApiResponse.success(res, { data });
});

module.exports = { summary, salesTrend, purchaseVsSales, topProducts, outstandingAgeing, gstSummary };
