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
  const filter = { status: { $ne: 'Cancelled' } };
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = query.to;
  }

  const sales = await Sale.find(filter).sort({ date: -1 });
  const customers = await Customer.find({ id: { $in: sales.map((s) => s.customerId) } });
  const custMap = new Map(customers.map((c) => [c.id, c.partyName]));

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
  const filter = { status: { $ne: 'Cancelled' } };
  if (query.from || query.to) {
    filter.purchaseDate = {};
    if (query.from) filter.purchaseDate.$gte = query.from;
    if (query.to) filter.purchaseDate.$lte = query.to;
  }

  const purchases = await Purchase.find(filter).sort({ purchaseDate: -1 });
  const suppliers = await Supplier.find({ id: { $in: purchases.map((p) => p.supplierId) } });
  const suppMap = new Map(suppliers.map((s) => [s.id, s.company]));

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
  const filter = { status: { $ne: 'Cancelled' } };
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = query.to;
  }
  if (query.customerId) filter.customerId = query.customerId;
  if (query.financialYear) filter.financialYear = query.financialYear;

  const sales = await Sale.find(filter).sort({ date: -1 });
  const customers = await Customer.find({ id: { $in: sales.map((s) => s.customerId) } });
  const custMap = new Map(customers.map((c) => [c.id, c]));

  // GSTR-1 requires rate-wise reporting (5% / 12% / 18% / 28% shown
  // separately, each with its own taxable value and tax amount) — this
  // matches the real MARG export layout the user provided as a reference
  // (see GSTR1_OF_OCTOBER_2025.xls: separate SGST%/CGST%/IGST% columns per
  // row). A single invoice mixing products at different GST rates now
  // produces one row per rate bucket instead of one blended row with no
  // rate shown at all.
  const rows = [];
  for (const s of sales) {
    const customer = custMap.get(s.customerId);
    const custGstin = customer?.gstin?.trim() || '';
    const hasValidGstin = Boolean(custGstin && custGstin.length >= 10 && custGstin !== '-');
    const isInterState = Boolean(s.isInterState);
    const invoiceVal = round2(s.grandTotal || 0);

    let cat = 'B2C Small';
    if (hasValidGstin) cat = 'B2B';
    else if (isInterState && invoiceVal > 250000) cat = 'B2C Large';

    const byRate = new Map(); // gstRate -> accumulated bucket
    for (const l of s.lines || []) {
      const rate = Number(l.gstRate) || 0;
      const bucket = byRate.get(rate) || { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, hsns: new Set() };
      bucket.qty += Number(l.qty) || 0;
      bucket.taxable += Number(l.taxableValue) || 0;
      bucket.cgst += Number(l.cgst) || 0;
      bucket.sgst += Number(l.sgst) || 0;
      bucket.igst += Number(l.igst) || 0;
      if (l.hsn) bucket.hsns.add(l.hsn);
      byRate.set(rate, bucket);
    }

    const rateBuckets = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]);

    rateBuckets.forEach(([rate, b], idx) => {
      const bucketCategory = (rate === 0 && b.taxable > 0) ? 'Nil Rated' : cat;
      rows.push({
        id: `${s.id}-${rate}`,
        gstin: custGstin || '-',
        customerName: customer?.partyName || s.customerId,
        invoiceDate: dayjs(s.date).format('DD-MM-YYYY'),
        invoiceNo: s.invoiceNo,
        invoiceValue: idx === 0 ? invoiceVal : 0, // shown once per invoice, matching MARG's layout, to avoid double-counting the invoice total across its rate-bucket rows
        localCentral: isInterState ? 'Central' : 'Local',
        hsn: Array.from(b.hsns).join(', ') || '-',
        quantity: round2(b.qty),
        taxable: round2(b.taxable),
        gstRatePct: rate,
        cgstPct: isInterState ? 0 : round2(rate / 2),
        cgst: round2(b.cgst),
        sgstPct: isInterState ? 0 : round2(rate / 2),
        sgst: round2(b.sgst),
        igstPct: isInterState ? rate : 0,
        igst: round2(b.igst),
        totalGst: round2(b.cgst + b.sgst + b.igst),
        category: bucketCategory,
        financialYear: s.financialYear || currentFinancialYear(s.date),
      });
    });
  }

  // Credit Note rows for sales returns processed in the same period —
  // previously this was fetched with SalesReturn.find({}), completely
  // unfiltered by date, so a GSTR-1 for any single month incorrectly
  // included every credit note ever created, from any period.
  const returnFilter = {};
  if (query.from || query.to) {
    returnFilter.createdAt = {};
    if (query.from) returnFilter.createdAt.$gte = new Date(query.from);
    if (query.to) returnFilter.createdAt.$lte = new Date(query.to);
  }
  if (query.customerId) returnFilter.customerId = query.customerId;
  const returns = await SalesReturn.find(returnFilter).sort({ createdAt: -1 });
  const returnCustomers = await Customer.find({ id: { $in: returns.map((r) => r.customerId) } });
  const returnCustMap = new Map(returnCustomers.map((c) => [c.id, c]));
  for (const r of returns) {
    const customer = returnCustMap.get(r.customerId);
    const refVal = round2(r.refundAmount || 0);
    rows.push({
      id: `credit-${r.id}`,
      customerName: customer?.partyName || r.customerId,
      invoiceDate: r.createdAt ? dayjs(r.createdAt).format('DD-MM-YYYY') : dayjs().format('DD-MM-YYYY'),
      invoiceNo: `CR-${r.id}`,
      invoiceValue: -refVal,
      localCentral: 'Local',
      hsn: '-',
      quantity: 0,
      taxable: -refVal,
      gstRatePct: 0,
      cgstPct: 0,
      cgst: 0,
      sgstPct: 0,
      sgst: 0,
      igstPct: 0,
      igst: 0,
      totalGst: 0,
      category: 'Credit Note',
      financialYear: r.financialYear || currentFinancialYear(r.createdAt),
    });
  }

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

  return { title: 'GSTR-1 Outward Supplies Report', columns, rows };
}

async function itcRows(query = {}) {
  const filter = { status: { $ne: 'Cancelled' } };
  if (query.from || query.to) {
    filter.purchaseDate = {};
    if (query.from) filter.purchaseDate.$gte = query.from;
    if (query.to) filter.purchaseDate.$lte = query.to;
  }
  if (query.supplierId) filter.supplierId = query.supplierId;
  if (query.financialYear) filter.financialYear = query.financialYear;

  const purchases = await Purchase.find(filter).sort({ purchaseDate: -1 });
  const suppliers = await Supplier.find({ id: { $in: purchases.map((p) => p.supplierId) } });
  const suppMap = new Map(suppliers.map((s) => [s.id, s]));

  // Matches the real MARG GSTR-2 export layout the user provided as a
  // reference (GSTR2_OF_AUGUST.xls: separate SGST%/CGST%/IGST% columns and
  // a Quantity column per row) and, like GSTR-1, breaks a purchase invoice
  // mixing products at different GST rates into one row per rate bucket
  // instead of a single blended row with no rate shown.
  const rows = [];
  for (const p of purchases) {
    const supplier = suppMap.get(p.supplierId);
    const suppGstin = supplier?.gstin?.trim() || '';
    const hasGstin = Boolean(suppGstin && suppGstin.length >= 10 && suppGstin !== '-');
    const invoiceVal = round2(p.grandTotal || 0);

    const rcm = p.rcm ? 'Yes' : 'No';
    const eligibility = p.itcEligibility || (hasGstin ? 'Eligible' : 'Ineligible');
    let recStatus = 'Pending';
    if (eligibility === 'Ineligible' || eligibility === 'Blocked') {
      recStatus = 'Not Eligible';
    } else if (hasGstin && (p.paymentStatus === 'Paid' || p.paymentStatus === 'Partial')) {
      recStatus = 'Matched';
    } else if (!hasGstin) {
      recStatus = 'Unmatched';
    }

    const byRate = new Map();
    for (const l of p.lines || []) {
      const rate = Number(l.gstRate) || 0;
      const bucket = byRate.get(rate) || { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, hsns: new Set() };
      bucket.qty += Number(l.qty) || 0;
      bucket.taxable += Number(l.taxableValue) || 0;
      bucket.cgst += Number(l.cgst) || 0;
      bucket.sgst += Number(l.sgst) || 0;
      bucket.igst += Number(l.igst) || 0;
      if (l.hsn) bucket.hsns.add(l.hsn);
      byRate.set(rate, bucket);
    }

    const rateBuckets = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]);
    rateBuckets.forEach(([rate, b], idx) => {
      const totalTax = round2(b.cgst + b.sgst + b.igst);
      const itcEligibleAmount = (recStatus === 'Not Eligible' || eligibility === 'Ineligible') ? 0 : totalTax;
      rows.push({
        id: `${p.id}-${rate}`,
        supplierGstin: suppGstin || '-',
        supplierName: supplier?.company || p.supplierId,
        invoiceNo: p.purchaseInvoiceNo,
        invoiceDate: dayjs(p.purchaseDate).format('DD-MM-YYYY'),
        invoiceValue: idx === 0 ? invoiceVal : 0, // shown once per invoice, to avoid double-counting in summary totals
        hsn: Array.from(b.hsns).join(', ') || '-',
        quantity: round2(b.qty),
        taxable: round2(b.taxable),
        gstRatePct: rate,
        cgst: round2(b.cgst),
        sgst: round2(b.sgst),
        igst: round2(b.igst),
        totalTax,
        rcm,
        itcEligibility: eligibility,
        itcEligible: itcEligibleAmount,
        status: recStatus,
        financialYear: p.financialYear || currentFinancialYear(p.purchaseDate),
      });
    });
  }

  // Purchase Return debit-note rows, filtered to the same period — this
  // export previously did not include returns at all (a separate, silently
  // diverging implementation from the on-screen ITC Reconciliation page,
  // which did include them; see gst.controller.js).
  const returnFilter = {};
  if (query.from || query.to) {
    returnFilter.createdAt = {};
    if (query.from) returnFilter.createdAt.$gte = new Date(query.from);
    if (query.to) returnFilter.createdAt.$lte = new Date(query.to);
  }
  if (query.supplierId) returnFilter.supplierId = query.supplierId;
  const pReturns = await PurchaseReturn.find(returnFilter).sort({ createdAt: -1 });
  const returnSuppliers = await Supplier.find({ id: { $in: pReturns.map((r) => r.supplierId) } });
  const returnSuppMap = new Map(returnSuppliers.map((s) => [s.id, s]));
  for (const pr of pReturns) {
    const supplier = returnSuppMap.get(pr.supplierId);
    const adj = round2(pr.payableAdjustment || 0);
    rows.push({
      id: `debit-${pr.id}`,
      supplierGstin: supplier?.gstin?.trim() || '-',
      supplierName: supplier?.company || pr.supplierId,
      invoiceNo: `DR-${pr.id}`,
      invoiceDate: pr.createdAt ? dayjs(pr.createdAt).format('DD-MM-YYYY') : dayjs().format('DD-MM-YYYY'),
      invoiceValue: -adj,
      hsn: '-',
      quantity: 0,
      taxable: -adj,
      gstRatePct: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
      rcm: 'No',
      itcEligibility: 'Eligible',
      itcEligible: 0,
      status: 'Matched',
      financialYear: pr.financialYear || currentFinancialYear(pr.createdAt),
    });
  }

  const columns = [
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
    { key: 'status', label: 'Status' },
  ];

  return { title: 'Purchase ITC Reconciliation Report', columns, rows };
}

async function gstr3bRows(query = {}) {
  const saleFilter = { status: { $ne: 'Cancelled' } };
  const purchaseFilter = { status: { $ne: 'Cancelled' } };
  if (query.financialYear) {
    saleFilter.financialYear = query.financialYear;
    purchaseFilter.financialYear = query.financialYear;
  }
  if (query.from || query.to) {
    saleFilter.date = {};
    purchaseFilter.purchaseDate = {};
    if (query.from) { saleFilter.date.$gte = query.from; purchaseFilter.purchaseDate.$gte = query.from; }
    if (query.to) { saleFilter.date.$lte = query.to; purchaseFilter.purchaseDate.$lte = query.to; }
  }

  const sales = await Sale.find(saleFilter);
  const purchases = await Purchase.find(purchaseFilter);

  const outwardTaxable = round2(sales.reduce((a, s) => a + (s.taxableTotal || 0), 0));
  const outputCgst = round2(sales.reduce((a, s) => a + (s.cgstTotal || 0), 0));
  const outputSgst = round2(sales.reduce((a, s) => a + (s.sgstTotal || 0), 0));
  const outputIgst = round2(sales.reduce((a, s) => a + (s.igstTotal || 0), 0));

  let eligibleCgst = 0;
  let eligibleSgst = 0;
  let eligibleIgst = 0;
  let ineligibleItc = 0;

  purchases.forEach((p) => {
    const isEligible = p.itcEligibility !== 'Ineligible' && p.itcEligibility !== 'Blocked';
    if (isEligible) {
      eligibleIgst += p.igstTotal || 0;
      eligibleCgst += p.cgstTotal || 0;
      eligibleSgst += p.sgstTotal || 0;
    } else {
      ineligibleItc += (p.cgstTotal || 0) + (p.sgstTotal || 0) + (p.igstTotal || 0);
    }
  });

  eligibleCgst = round2(eligibleCgst);
  eligibleSgst = round2(eligibleSgst);
  eligibleIgst = round2(eligibleIgst);
  ineligibleItc = round2(ineligibleItc);

  const netCgst = Math.max(0, outputCgst - eligibleCgst);
  const netSgst = Math.max(0, outputSgst - eligibleSgst);
  const netIgst = Math.max(0, outputIgst - eligibleIgst);
  const netPayable = round2(netCgst + netSgst + netIgst);

  const rows = [
    { section: '3.1 Outward Taxable Supplies', taxable: outwardTaxable, igst: outputIgst, cgst: outputCgst, sgst: outputSgst, netPayable: '-' },
    { section: '4.0 Eligible Input Tax Credit', taxable: '-', igst: eligibleIgst, cgst: eligibleCgst, sgst: eligibleSgst, netPayable: '-' },
    { section: '4.D Ineligible / Blocked ITC', taxable: '-', igst: 0, cgst: 0, sgst: 0, netPayable: ineligibleItc },
    { section: '6.1 Net Tax Payable in Cash', taxable: '-', igst: netIgst, cgst: netCgst, sgst: netSgst, netPayable },
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






