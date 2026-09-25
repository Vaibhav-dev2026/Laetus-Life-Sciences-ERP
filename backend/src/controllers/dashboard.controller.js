const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { Sale, Purchase, Product, ProductBatch, Customer, Supplier } = require('../models');
const { round2 } = require('../utils/money');
const { buildDateQuery } = require('../utils/dateRange.util');

// All dashboard numbers are computed via MongoDB aggregation — the frontend
// never receives raw Sale/Purchase collections to sum client-side.

const summary = asyncHandler(async (req, res) => {
  const fromParam = req.query.from || req.query.startDate;
  const toParam = req.query.to || req.query.endDate;
  const fyParam = req.query.financialYear || req.query.fy;

  const customDateRange = buildDateQuery({ from: fromParam, to: toParam, financialYear: fyParam });

  const startOfToday = dayjs().startOf('day').toDate();
  const endOfToday = dayjs().endOf('day').toDate();

  const saleMatch = { status: 'Active', ...(customDateRange ? { date: customDateRange } : {}) };
  const purchaseMatch = { status: 'Active', ...(customDateRange ? { purchaseDate: customDateRange } : {}) };

  const [todaySalesAgg] = await Sale.aggregate([
    { $match: { status: 'Active', date: { $gte: startOfToday, $lte: endOfToday } } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]);

  const [monthlySalesAgg] = await Sale.aggregate([
    { $match: saleMatch },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]);

  const [todayPurchaseAgg] = await Purchase.aggregate([
    { $match: purchaseMatch },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } },
  ]);

  const [outstandingAgg] = await Sale.aggregate([
    { $match: { status: 'Active', balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);

  const [purchasePayableAgg] = await Purchase.aggregate([
    { $match: { status: 'Active', balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);

  const [payableAgg] = await Supplier.aggregate([
    { $group: { _id: null, total: { $sum: '$openingPayable' } } },
  ]);

  const totalSupplierPayable = round2((payableAgg?.total || 0) + (purchasePayableAgg?.total || 0));

  const [stockValueAgg] = await ProductBatch.aggregate([
    { $group: { _id: null, total: { $sum: { $multiply: ['$currentQty', '$purchaseRate'] } } } },
  ]);

  const lowStock = await Product.countDocuments({ $expr: { $lte: ['$currentStock', '$reorderLevel'] } });
  const nearExpiry = await ProductBatch.countDocuments({ status: 'Near Expiry' });
  const expired = await ProductBatch.countDocuments({ status: 'Expired' });
  const totalCustomers = await Customer.countDocuments();
  const totalSuppliers = await Supplier.countDocuments();

  return ApiResponse.success(res, {
    data: {
      salesToday: round2(todaySalesAgg?.total || 0),
      monthlySales: round2(monthlySalesAgg?.total || 0),
      purchaseToday: round2(todayPurchaseAgg?.total || 0),
      outstandingReceivable: round2(outstandingAgg?.total || 0),
      supplierPayable: totalSupplierPayable,
      stockValue: round2(stockValueAgg?.total || 0),
      lowStock,
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
  const data = rows.map((r) => ({ date: dayjs(r._id).format('DD MMM'), sales: round2(r.sales), purchase: round2(purchaseMap.get(r._id) || 0) }));
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
