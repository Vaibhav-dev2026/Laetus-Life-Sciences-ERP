const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { Sale, Customer } = require('../models');
const { round2 } = require('../utils/money');

function ageingBucket(daysOverdue) {
  if (daysOverdue > 90) return '90+';
  if (daysOverdue > 60) return '61-90';
  if (daysOverdue > 30) return '31-60';
  return '0-30';
}

// Party-wise open-invoice outstanding with ageing — computed on read rather
// than a separately maintained aggregate, so it can never drift from the
// underlying Sale documents.
const outstandingReport = asyncHandler(async (req, res) => {
  const { customerId, from, to, ageing } = req.query;
  const query = { status: 'Active', balance: { $gt: 0.5 } };
  if (customerId) query.customerId = customerId;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const sales = await Sale.find(query).sort({ customerId: 1, date: 1 });
  const customerIds = [...new Set(sales.map((s) => s.customerId))];
  const customers = await Customer.find({ id: { $in: customerIds } });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const cumulative = {};
  const rows = sales.map((s) => {
    cumulative[s.customerId] = round2((cumulative[s.customerId] || 0) + s.balance);
    const daysOverdue = Math.max(0, dayjs().diff(dayjs(s.dueDate || s.date), 'day'));
    const bucket = ageingBucket(daysOverdue);
    return {
      id: s.id, partyName: customerMap.get(s.customerId)?.partyName || s.customerId, billNo: s.invoiceNo,
      billDate: s.date, billAmount: s.grandTotal, received: s.amountReceived, balance: s.balance,
      cumulativeTotal: cumulative[s.customerId], dueDate: s.dueDate, daysOverdue, bucket, remark: s.paymentStatus,
    };
  }).filter((r) => !ageing || ageing === 'All' || r.bucket === ageing);

  const ageingTotals = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  rows.forEach((r) => { ageingTotals[r.bucket] = round2(ageingTotals[r.bucket] + r.balance); });

  return ApiResponse.success(res, { data: { rows, ageingTotals } });
});

module.exports = { outstandingReport };
