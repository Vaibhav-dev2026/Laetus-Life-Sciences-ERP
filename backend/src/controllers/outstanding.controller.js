const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { Sale, Customer, CustomerLedger } = require('../models');
const { round2 } = require('../utils/money');

function ageingBucket(daysOverdue) {
  if (daysOverdue > 90) return '90+';
  if (daysOverdue > 60) return '61-90';
  if (daysOverdue > 30) return '31-60';
  return '0-30';
}

// Party-wise open-invoice and remaining opening-balance outstanding with ageing.
// Computed on read rather than a separately maintained aggregate so it can
// never drift from the underlying Sale and CustomerLedger documents.
const outstandingReport = asyncHandler(async (req, res) => {
  const { customerId, from, to, ageing } = req.query;
  const query = { status: 'Active', balance: { $gt: 0.5 } };
  if (customerId) query.customerId = customerId;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const [sales, allCusts] = await Promise.all([
    Sale.find(query).sort({ customerId: 1, date: 1 }),
    Customer.find(customerId ? { id: customerId, status: 'Active' } : { status: 'Active' }),
  ]);

  const customerMap = new Map(allCusts.map((c) => [c.id, c]));

  // Get latest ledger balance for customers with opening balance
  const custsWithOpening = allCusts.filter((c) => (c.openingOutstanding || 0) > 0.5);
  const custOpeningIds = custsWithOpening.map((c) => c.id);

  let ledgerBalanceMap = new Map();
  if (custOpeningIds.length > 0) {
    const ledgerAgg = await CustomerLedger.aggregate([
      { $match: { partyId: { $in: custOpeningIds } } },
      { $sort: { _id: 1 } },
      { $group: { _id: '$partyId', lastBalance: { $last: '$balance' } } },
    ]);
    ledgerBalanceMap = new Map(ledgerAgg.map((l) => [l._id, l.lastBalance]));
  }

  // Calculate sum of active sale balances per customer
  const salesBalanceByCust = {};
  sales.forEach((s) => {
    salesBalanceByCust[s.customerId] = round2((salesBalanceByCust[s.customerId] || 0) + s.balance);
  });

  const cumulative = {};
  const rows = [];

  // 1. Process active unpaid sales
  for (const s of sales) {
    cumulative[s.customerId] = round2((cumulative[s.customerId] || 0) + s.balance);
    const daysOverdue = Math.max(0, dayjs().diff(dayjs(s.dueDate || s.date), 'day'));
    const bucket = ageingBucket(daysOverdue);
    rows.push({
      id: s.id,
      partyName: customerMap.get(s.customerId)?.partyName || s.customerId,
      billNo: s.invoiceNo,
      billDate: s.date,
      billAmount: s.grandTotal,
      received: s.amountReceived,
      balance: s.balance,
      cumulativeTotal: cumulative[s.customerId],
      dueDate: s.dueDate,
      daysOverdue,
      bucket,
      remark: s.paymentStatus,
    });
  }

  // 2. Include customers with remaining opening balance
  for (const c of custsWithOpening) {
    const currentLedger = ledgerBalanceMap.has(c.id)
      ? ledgerBalanceMap.get(c.id)
      : (c.currentBalance && c.currentBalance > 0 ? c.currentBalance : (c.openingOutstanding || 0));
    const activeSalesBal = salesBalanceByCust[c.id] || 0;
    const remainingOpening = round2(Math.max(0, currentLedger - activeSalesBal));

    if (remainingOpening > 0.5) {
      cumulative[c.id] = round2((cumulative[c.id] || 0) + remainingOpening);
      const createdDate = c.createdAt || new Date();
      const daysOverdue = Math.max(0, dayjs().diff(dayjs(createdDate), 'day'));
      const bucket = '90+';
      rows.push({
        id: `OPEN-${c.id}`,
        partyName: c.partyName,
        billNo: 'OPENING',
        billDate: createdDate,
        billAmount: round2(c.openingOutstanding),
        received: round2(Math.max(0, c.openingOutstanding - remainingOpening)),
        balance: remainingOpening,
        cumulativeTotal: cumulative[c.id],
        dueDate: null,
        daysOverdue,
        bucket,
        remark: 'Opening Balance',
      });
    }
  }

  // Sort rows deterministically by partyName and then billDate
  rows.sort((a, b) => {
    const c = (a.partyName || '').localeCompare(b.partyName || '');
    if (c !== 0) return c;
    return new Date(a.billDate) - new Date(b.billDate);
  });

  const filteredRows = rows.filter((r) => !ageing || ageing === 'All' || r.bucket === ageing);

  const ageingTotals = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  filteredRows.forEach((r) => { ageingTotals[r.bucket] = round2((ageingTotals[r.bucket] || 0) + r.balance); });

  return ApiResponse.success(res, { data: { rows: filteredRows, ageingTotals } });
});

module.exports = { outstandingReport };
