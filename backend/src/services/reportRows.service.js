const dayjs = require('dayjs');
const { Sale, Customer, Purchase, Supplier, ProductBatch, Product, Payment, Expense, SalesReturn, PurchaseReturn } = require('../models');
const { round2 } = require('../utils/money');
const { currentFinancialYear } = require('./invoiceNumber.service');



// Shared row-building logic reused by both the JSON outstanding endpoint and
// the Excel/DOCX exporter, so the exported file always matches what the
// screen shows.
async function outstandingRows(query = {}) {
  const filter = { status: { $ne: 'Cancelled' }, balance: { $gt: 0.5 } };
  if (query.customerId) filter.customerId = query.customerId;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = query.to;
  }

  const sales = await Sale.find(filter).sort({ customerId: 1, date: 1 });
  const customers = await Customer.find({ id: { $in: sales.map((s) => s.customerId) } });
  const map = new Map(customers.map((c) => [c.id, c.partyName]));

  const partyCumulative = {};
  const today = dayjs();

  const rows = sales.map((s) => {
    const bal = round2(s.balance || Math.max(0, (s.grandTotal || 0) - (s.amountReceived || 0)));
    partyCumulative[s.customerId] = round2((partyCumulative[s.customerId] || 0) + bal);
    const dueDate = s.dueDate || s.date;
    const daysOverdue = Math.max(0, today.diff(dayjs(dueDate), 'day'));
    return {
      partyName: map.get(s.customerId) || s.customerId,
      billNo: s.invoiceNo,
      billDate: dayjs(s.date).format('DD-MM-YYYY'),
      billAmount: round2(s.grandTotal || 0),
      received: round2(s.amountReceived || 0),
      balance: bal,
      cumulativeTotal: partyCumulative[s.customerId],
      dueDate: dueDate ? dayjs(dueDate).format('DD-MM-YYYY') : '-',
      daysOverdue,
      pdc: '0',
      remark: s.paymentStatus || s.status,
    };
  });

  const columns = [
    { key: 'partyName', label: 'Party Name' },
    { key: 'billNo', label: 'Bill No' },
    { key: 'billDate', label: 'Bill Date' },
    { key: 'billAmount', label: 'Bill Amt' },
    { key: 'received', label: 'Received' },
    { key: 'balance', label: 'Balance' },
    { key: 'cumulativeTotal', label: 'Cumulative Total' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'daysOverdue', label: 'Days' },
    { key: 'pdc', label: 'P.D.C.' },
    { key: 'remark', label: 'Remark' },
  ];

  return { title: 'Outstanding Report', columns, rows };
}

async function salesRows(query = {}) {
  const { buildDateQuery } = require('../utils/dateRange.util');
  const filter = { status: { $ne: 'Cancelled' } };

  const dateQuery = buildDateQuery({ from: query.from, to: query.to, financialYear: query.financialYear });
  if (dateQuery) filter.date = dateQuery;
  if (query.customerId) filter.customerId = query.customerId;

  let sales = await Sale.find(filter).sort({ date: -1 });
  const customers = await Customer.find({ id: { $in: sales.map((s) => s.customerId) } });
  const custMap = new Map(customers.map((c) => [c.id, c.partyName]));

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    sales = sales.filter((s) => {
      const custName = (custMap.get(s.customerId) || s.customerId || '').toLowerCase();
      const invNo = (s.invoiceNo || '').toLowerCase();
      return invNo.includes(q) || custName.includes(q);
    });
  }

  const rows = sales.map((s) => ({
    invoiceNo: s.invoiceNo,
    date: dayjs(s.date).format('DD-MM-YYYY'),
    customer: custMap.get(s.customerId) || s.customerId,
    items: (s.lines || []).length,
    taxableTotal: round2(s.taxableTotal || 0),
    cgstTotal: round2(s.cgstTotal || 0),
    sgstTotal: round2(s.sgstTotal || 0),
    igstTotal: round2(s.igstTotal || 0),
    grandTotal: round2(s.grandTotal || 0),
    amountReceived: round2(s.amountReceived || 0),
    balance: round2((s.grandTotal || 0) - (s.amountReceived || 0)),
    paymentStatus: s.paymentStatus || s.status,
  }));

  const columns = [
    { key: 'invoiceNo', label: 'Invoice No' },
    { key: 'date', label: 'Date' },
    { key: 'customer', label: 'Customer' },
    { key: 'items', label: 'Items' },
    { key: 'taxableTotal', label: 'Taxable' },
    { key: 'cgstTotal', label: 'CGST' },
    { key: 'sgstTotal', label: 'SGST' },
    { key: 'igstTotal', label: 'IGST' },
    { key: 'grandTotal', label: 'Grand Total' },
    { key: 'amountReceived', label: 'Received' },
    { key: 'balance', label: 'Balance' },
    { key: 'paymentStatus', label: 'Status' },
  ];

  return { title: 'Sales Report', columns, rows };
}

async function purchasesRows(query = {}) {
  const { buildDateQuery } = require('../utils/dateRange.util');
  const filter = { status: { $ne: 'Cancelled' } };

  const dateQuery = buildDateQuery({ from: query.from, to: query.to, financialYear: query.financialYear });
  if (dateQuery) filter.purchaseDate = dateQuery;
  if (query.supplierId) filter.supplierId = query.supplierId;

  let purchases = await Purchase.find(filter).sort({ purchaseDate: -1 });
  const suppliers = await Supplier.find({ id: { $in: purchases.map((p) => p.supplierId) } });
  const suppMap = new Map(suppliers.map((s) => [s.id, s.company]));

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    purchases = purchases.filter((p) => {
      const suppName = (suppMap.get(p.supplierId) || p.supplierId || '').toLowerCase();
      const invNo = (p.purchaseInvoiceNo || p.supplierInvoiceNo || '').toLowerCase();
      return invNo.includes(q) || suppName.includes(q);
    });
  }

  const rows = purchases.map((p) => ({
    purchaseInvoiceNo: p.purchaseInvoiceNo,
    date: dayjs(p.purchaseDate).format('DD-MM-YYYY'),
    supplier: suppMap.get(p.supplierId) || p.supplierId,
    items: (p.lines || []).length,
    taxableTotal: round2(p.taxableTotal || 0),
    cgstTotal: round2(p.cgstTotal || 0),
    sgstTotal: round2(p.sgstTotal || 0),
    igstTotal: round2(p.igstTotal || 0),
    grandTotal: round2(p.grandTotal || 0),
    paymentStatus: p.paymentStatus || p.status,
  }));

  const columns = [
    { key: 'purchaseInvoiceNo', label: 'Invoice No' },
    { key: 'date', label: 'Date' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'items', label: 'Items' },
    { key: 'taxableTotal', label: 'Taxable' },
    { key: 'cgstTotal', label: 'CGST' },
    { key: 'sgstTotal', label: 'SGST' },
    { key: 'igstTotal', label: 'IGST' },
    { key: 'grandTotal', label: 'Grand Total' },
    { key: 'paymentStatus', label: 'Status' },
  ];

  return { title: 'Purchase Report', columns, rows };
}

async function stockRows(query = {}) {
  const { buildDateQuery } = require('../utils/dateRange.util');
  const dateQuery = buildDateQuery({ from: query.from, to: query.to, financialYear: query.financialYear });
  
  const batchFilter = {};
  if (dateQuery) {
    batchFilter.createdAt = dateQuery;
  }

  const batches = await ProductBatch.find(batchFilter).sort({ productId: 1, batchNo: 1 });
  const products = await Product.find({ id: { $in: batches.map((b) => b.productId) } });
  const prodMap = new Map(products.map((p) => [p.id, p.name]));

  const rows = batches.map((b) => ({
    product: prodMap.get(b.productId) || b.productId,
    batchNo: b.batchNo,
    mfgDate: b.mfgDate ? dayjs(b.mfgDate).format('DD-MM-YYYY') : '-',
    expiry: b.expDate ? dayjs(b.expDate).format('DD-MM-YYYY') : '-',
    currentQty: b.currentQty || 0,
    purchaseRate: round2(b.purchaseRate || 0),
    saleRate: round2(b.saleRate || 0),
    mrp: round2(b.mrp || 0),
    stockValue: round2((b.currentQty || 0) * (b.purchaseRate || 0)),
    status: b.status || 'Healthy',
  }));

  const columns = [
    { key: 'product', label: 'Product' },
    { key: 'batchNo', label: 'Batch No' },
    { key: 'mfgDate', label: 'Mfg Date' },
    { key: 'expiry', label: 'Expiry' },
    { key: 'currentQty', label: 'Current Qty' },
    { key: 'purchaseRate', label: 'Purchase Rate' },
    { key: 'saleRate', label: 'Sale Rate' },
    { key: 'mrp', label: 'MRP' },
    { key: 'stockValue', label: 'Stock Value' },
    { key: 'status', label: 'Status' },
  ];

  return { title: 'Stock Report', columns, rows };
}

async function customersRows() {
  const customers = await Customer.find({ status: 'Active' }).sort({ partyName: 1 });
  const rows = customers.map((c) => ({
    partyName: c.partyName,
    mobile: c.mobile || '-',
    email: c.email || '-',
    gstin: c.gstin || '-',
    drugLicence: c.drugLicence || '-',
    city: c.city || '-',
    state: c.state || '-',
    stateCode: c.stateCode || '-',
    openingOutstanding: round2(c.openingOutstanding || 0),
    currentBalance: round2(c.currentBalance || 0),
  }));

  const columns = [
    { key: 'partyName', label: 'Party Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'drugLicence', label: 'D.L. No.' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'stateCode', label: 'State Code' },
    { key: 'openingOutstanding', label: 'Opening Outstanding' },
    { key: 'currentBalance', label: 'Current Balance' },
  ];

  return { title: 'Customer List', columns, rows };
}

async function suppliersRows() {
  const suppliers = await Supplier.find({ status: 'Active' }).sort({ company: 1 });
  const rows = suppliers.map((s) => ({
    company: s.company,
    mobile: s.mobile || '-',
    email: s.email || '-',
    gstin: s.gstin || '-',
    drugLicence: s.drugLicence || '-',
    city: s.city || '-',
    state: s.state || '-',
    stateCode: s.stateCode || '-',
    openingPayable: round2(s.openingPayable || 0),
    currentBalance: round2(s.currentBalance || 0),
  }));

  const columns = [
    { key: 'company', label: 'Company' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'drugLicence', label: 'D.L. No.' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'stateCode', label: 'State Code' },
    { key: 'openingPayable', label: 'Opening Payable' },
    { key: 'currentBalance', label: 'Current Balance' },
  ];

  return { title: 'Supplier List', columns, rows };
}

async function productsRows() {
  const products = await Product.find({ status: 'Active' }).sort({ name: 1 });
  const rows = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    genericName: p.genericName || '-',
    hsn: p.hsn || '-',
    packing: p.packing || '-',
    mfg: p.mfg || '-',
    gstRate: `${p.gstRate || 0}%`,
    mrp: round2(p.mrp || 0),
    purchaseRate: round2(p.purchaseRate || 0),
    saleRate: round2(p.saleRate || 0),
    currentStock: p.currentStock || 0,
  }));

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Product Name' },
    { key: 'genericName', label: 'Generic Name' },
    { key: 'hsn', label: 'HSN' },
    { key: 'packing', label: 'Packing' },
    { key: 'mfg', label: 'Mfg' },
    { key: 'gstRate', label: 'GST Rate' },
    { key: 'mrp', label: 'MRP' },
    { key: 'purchaseRate', label: 'Purchase Rate' },
    { key: 'saleRate', label: 'Sale Rate' },
    { key: 'currentStock', label: 'Stock' },
  ];

  return { title: 'Product Master', columns, rows };
}

async function gstr1Rows(query = {}) {
  const gstReportService = require('./gstReport.service');
  const allRows = await gstReportService.getGstr1Data(query);

  let rows = Array.isArray(allRows) ? allRows : [];
  if (query.category && query.category !== 'All') {
    rows = rows.filter((r) => r.category === query.category);
  }

  const formattedRows = rows.map((r) => ({
    ...r,
    invoiceDate: r.invoiceDate ? dayjs(r.invoiceDate).format('DD-MM-YYYY') : '-',
    invoiceValue: round2(r.invoiceValue || 0),
    taxable: round2(r.taxable || r.taxableValue || 0),
    cgst: round2(r.cgst || 0),
    sgst: round2(r.sgst || 0),
    igst: round2(r.igst || 0),
    totalGst: round2(r.totalGst || r.totalTax || 0),
  }));

  const columns = [
    { key: 'category', label: 'Category' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'invoiceNo', label: 'Invoice No' },
    { key: 'invoiceValue', label: 'Invoice Value' },
    { key: 'localCentral', label: 'Local/Central' },
    { key: 'hsn', label: 'HSN' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'taxable', label: 'Taxable Amount' },
    { key: 'gstRatePct', label: 'GST Rate %' },
    { key: 'cgstPct', label: 'CGST %' },
    { key: 'cgst', label: 'CGST Amount' },
    { key: 'sgstPct', label: 'SGST %' },
    { key: 'sgst', label: 'SGST Amount' },
    { key: 'igstPct', label: 'IGST %' },
    { key: 'igst', label: 'IGST Amount' },
    { key: 'totalGst', label: 'Total GST' },
  ];

  return { title: 'GSTR-1 Outward Supplies Report', columns, rows: formattedRows };
}

async function itcRows(query = {}) {
  const gstReportService = require('./gstReport.service');
  const recoData = await gstReportService.getGstr2bReconciliationData(query);

  let rows = Array.isArray(recoData) ? recoData : (recoData.rows || []);
  if (query.status && query.status !== 'All') {
    rows = rows.filter((r) => r.status === query.status);
  }

  const formattedRows = rows.map((r) => ({
    ...r,
    invoiceDate: r.invoiceDate ? dayjs(r.invoiceDate).format('DD-MM-YYYY') : '-',
    invoiceValue: round2(r.invoiceValue || r.bookTaxable || 0),
    taxable: round2(r.bookTaxable || r.taxable || 0),
    cgst: round2(r.bookCgst || r.cgst || 0),
    sgst: round2(r.bookSgst || r.sgst || 0),
    igst: round2(r.bookIgst || r.igst || 0),
    totalTax: round2(r.bookTotalTax || r.totalTax || 0),
  }));

  const columns = [
    { key: 'status', label: 'Status' },
    { key: 'supplierGstin', label: 'Supplier GSTIN' },
    { key: 'supplierName', label: 'Supplier Name' },
    { key: 'invoiceNo', label: 'Invoice No' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'invoiceValue', label: 'Invoice Value' },
    { key: 'hsn', label: 'HSN' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'taxable', label: 'Taxable Value' },
    { key: 'gstRatePct', label: 'GST Rate %' },
    { key: 'cgst', label: 'CGST' },
    { key: 'sgst', label: 'SGST' },
    { key: 'igst', label: 'IGST' },
    { key: 'totalTax', label: 'Total Tax' },
    { key: 'rcm', label: 'RCM' },
    { key: 'itcEligibility', label: 'ITC Eligibility' },
  ];

  return { title: 'Purchase ITC Reconciliation Report', columns, rows: formattedRows };
}

async function gstr3bRows(query = {}) {
  const gstReportService = require('./gstReport.service');
  const data = await gstReportService.getGstr3bData(query);

  const outwardTaxable = round2(data?.section31?.outwardTaxable ?? data?.outwardTaxable ?? 0);
  const outputCgst = round2(data?.section31?.cgst ?? data?.outputCgst ?? 0);
  const outputSgst = round2(data?.section31?.sgst ?? data?.outputSgst ?? 0);
  const outputIgst = round2(data?.section31?.igst ?? data?.outputIgst ?? 0);

  const availableCgst = round2(data?.section4?.availableCgst ?? data?.eligibleCgst ?? 0);
  const availableSgst = round2(data?.section4?.availableSgst ?? data?.eligibleSgst ?? 0);
  const availableIgst = round2(data?.section4?.availableIgst ?? data?.eligibleIgst ?? 0);
  const reversalCgst = round2(data?.section4?.reversalCgst ?? 0);
  const reversalSgst = round2(data?.section4?.reversalSgst ?? 0);

  const netCgst = round2(data?.netPayable?.cgst ?? 0);
  const netSgst = round2(data?.netPayable?.sgst ?? 0);
  const netIgst = round2(data?.netPayable?.igst ?? 0);
  const netPayableTotal = round2(data?.netPayable?.totalNetPayable ?? data?.netTaxPayable ?? 0);

  const rows = [
    { section: '3.1 Outward Taxable Supplies', taxable: outwardTaxable, igst: outputIgst, cgst: outputCgst, sgst: outputSgst, netPayable: '-' },
    { section: '4.0 Eligible Input Tax Credit (ITC)', taxable: '-', igst: availableIgst, cgst: availableCgst, sgst: availableSgst, netPayable: '-' },
    { section: '4.D Ineligible / Reversal ITC', taxable: '-', igst: 0, cgst: reversalCgst, sgst: reversalSgst, netPayable: round2(reversalCgst + reversalSgst) },
    { section: '6.1 Net Tax Payable in Cash', taxable: '-', igst: netIgst, cgst: netCgst, sgst: netSgst, netPayable: netPayableTotal },
  ];

  const columns = [
    { key: 'section', label: 'GST Section / Nature of Supply' },
    { key: 'taxable', label: 'Taxable Value' },
    { key: 'igst', label: 'Integrated Tax (IGST)' },
    { key: 'cgst', label: 'Central Tax (CGST)' },
    { key: 'sgst', label: 'State/UT Tax (SGST)' },
    { key: 'netPayable', label: 'Net Payable / Amount' },
  ];

  return { title: 'GSTR-3B Tax Summary', columns, rows };
}

async function paymentsRows(query = {}) {
  const filter = {};
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = query.to;
  }

  const payments = await Payment.find(filter).sort({ date: -1 });
  const customers = await Customer.find({});
  const suppliers = await Supplier.find({});
  const custMap = new Map(customers.map((c) => [c.id, c.partyName]));
  const suppMap = new Map(suppliers.map((s) => [s.id, s.company]));

  const rows = payments.map((p) => ({
    id: p.id,
    date: dayjs(p.date).format('DD-MM-YYYY'),
    partyName: p.partyType === 'Customer' ? (custMap.get(p.partyId) || p.partyId) : (suppMap.get(p.partyId) || p.partyId),
    partyType: p.partyType,
    invoiceId: p.invoiceId || '-',
    amount: round2(p.amount || 0),
    mode: p.mode,
    reference: p.reference || '-',
    createdBy: p.createdBy || '-',
  }));

  const columns = [
    { key: 'id', label: 'Payment ID' },
    { key: 'date', label: 'Date' },
    { key: 'partyName', label: 'Party' },
    { key: 'partyType', label: 'Type' },
    { key: 'invoiceId', label: 'Invoice No' },
    { key: 'amount', label: 'Amount' },
    { key: 'mode', label: 'Payment Mode' },
    { key: 'reference', label: 'Reference' },
    { key: 'createdBy', label: 'Created By' },
  ];

  return { title: 'Payments Register', columns, rows };
}

async function expensesRows(query = {}) {
  const filter = {};
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = query.to;
  }

  const expenses = await Expense.find(filter).sort({ date: -1 });

  const rows = expenses.map((e) => ({
    id: e.id,
    date: dayjs(e.date).format('DD-MM-YYYY'),
    category: e.category,
    description: e.description,
    amount: round2(e.amount || 0),
    mode: e.mode,
    reference: e.reference || '-',
    status: e.status,
    createdBy: e.createdBy || '-',
  }));

  const columns = [
    { key: 'id', label: 'Expense ID' },
    { key: 'date', label: 'Date' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
    { key: 'mode', label: 'Payment Mode' },
    { key: 'reference', label: 'Reference' },
    { key: 'status', label: 'Status' },
    { key: 'createdBy', label: 'Created By' },
  ];

  return { title: 'Expenses Register', columns, rows };
}

module.exports = { outstandingRows, salesRows, purchasesRows, stockRows, customersRows, suppliersRows, productsRows, gstr1Rows, itcRows, gstr3bRows, paymentsRows, expensesRows };






