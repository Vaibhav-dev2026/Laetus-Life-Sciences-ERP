require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../src/config/env');
const {
  Company, Customer, Supplier, Product, ProductBatch, Purchase, Sale, Payment,
  SalesReturn, PurchaseReturn, CustomerLedger, SupplierLedger, StockMovement,
  AuditLog, Notification, Backup, Counter,
} = require('../src/models');
const { exportReport } = require('../src/controllers/export.controller');
const gstReportService = require('../src/services/gstReport.service');
const { calcLine, calcDocumentTotals } = require('../src/services/gstCalculation.service');
const { generateInvoicePdf, generateReportPdf } = require('../src/services/pdf.service');

async function runDeterministicQaFlow() {
  await mongoose.connect(env.mongoUri);
  console.log('[QA Flow] Connected to MongoDB:', mongoose.connection.name);

  const startTime = new Date();
  console.log('[QA Flow] Starting deterministic QA test flow at:', startTime.toISOString());

  // Pre-cleanup any leftover QA marker records from interrupted runs
  const qaMarkerRegex = /^QA-/i;
  await Customer.deleteMany({ id: qaMarkerRegex });
  await Supplier.deleteMany({ id: qaMarkerRegex });
  await Product.deleteMany({ $or: [{ id: qaMarkerRegex }, { sku: qaMarkerRegex }] });
  await ProductBatch.deleteMany({ $or: [{ id: qaMarkerRegex }, { batchNo: qaMarkerRegex }] });
  await Purchase.deleteMany({ $or: [{ id: qaMarkerRegex }, { purchaseInvoiceNo: qaMarkerRegex }] });
  await Sale.deleteMany({ $or: [{ id: qaMarkerRegex }, { invoiceNo: /^LLS\/26-27\/QA-/i }] });
  await SalesReturn.deleteMany({ id: qaMarkerRegex });
  await PurchaseReturn.deleteMany({ id: qaMarkerRegex });
  await Payment.deleteMany({ id: qaMarkerRegex });
  await CustomerLedger.deleteMany({ partyId: qaMarkerRegex });
  await SupplierLedger.deleteMany({ partyId: qaMarkerRegex });
  await StockMovement.deleteMany({ productId: qaMarkerRegex });

  // 1. Create Company Settings if missing or ensure verified state
  let company = await Company.findOne();
  if (!company) {
    company = await Company.create({
      name: 'L LAETUS LIFE SCIENCES',
      address: '1st Floor, 249 Sukhinagar, Bamroli Gam Road, Pandesara, Surat – 394221, Gujarat',
      state: 'Gujarat',
      stateCode: '24',
      gstin: '24AFSPT7471H1ZR',
      phone: '9662031042',
      email: 'laetuslifesciences@gmail.com',
      currentFinancialYear: '2026-27',
      availableFinancialYears: ['2024-25', '2025-26', '2026-27', '2027-28', '2028-29', '2029-30'],
    });
  }
  console.log('[QA Flow] Company Settings verified:', company.name, '| GSTIN:', company.gstin, '| Mobile:', company.phone);

  // 2. Create QA Master Records
  const qaCustomer = await Customer.create({
    id: 'QA-CUSTOMER-001',
    partyName: 'QA Test Medical Store',
    contactPerson: 'QA Manager',
    phone: '9876543210',
    mobile: '9876543210',
    email: 'qa.customer@laetus-test.com',
    state: 'Gujarat',
    stateCode: '24',
    gstin: '24AAAAA0000A1Z5',
    address: '123 QA Test Street, Surat',
    status: 'Active',
  });
  console.log('[QA Flow] QA Customer created:', qaCustomer.id, qaCustomer.partyName);

  const qaSupplier = await Supplier.create({
    id: 'QA-SUPPLIER-001',
    company: 'QA Pharma Supplies Ltd',
    contactPerson: 'QA Agent',
    phone: '9123456789',
    mobile: '9123456789',
    email: 'qa.supplier@laetus-test.com',
    state: 'Gujarat',
    stateCode: '24',
    gstin: '24BBBBA1111B1Z2',
    address: '456 QA Industrial Park, Ahmedabad',
    status: 'Active',
  });
  console.log('[QA Flow] QA Supplier created:', qaSupplier.id, qaSupplier.company);

  const qaProduct = await Product.create({
    id: 'QA-PRODUCT-001',
    name: 'QA Paracetamol 500mg',
    sku: 'QA-SKU-PAR-500',
    hsn: '30049099',
    mfg: 'QA LifeLabs',
    category: 'Analgesics',
    pack: '10x10 Tablets',
    mrp: 120,
    purchaseRate: 50,
    saleRate: 85,
    reorderLevel: 100,
    currentStock: 500,
    status: 'Active',
  });
  console.log('[QA Flow] QA Product created:', qaProduct.id, qaProduct.name);

  const qaBatch = await ProductBatch.create({
    id: 'QA-BAT-001',
    batchNo: 'QA-BATCH-2026A',
    productId: qaProduct.id,
    mfgDate: new Date('2026-01-01'),
    expDate: new Date('2028-12-31'),
    mrp: 120,
    purchaseRate: 50,
    saleRate: 85,
    ptr: 85,
    currentQty: 500,
    status: 'Healthy',
  });
  console.log('[QA Flow] QA Batch created:', qaBatch.id, qaBatch.batchNo);

  const { increaseStock, decreaseStock } = require('../src/services/stock.service');
  const { postCustomerEntry, postSupplierEntry } = require('../src/services/ledger.service');

  // 3. Perform Purchase Flow
  const qaPurchase = await Purchase.create({
    id: 'QA-PUR-001',
    purchaseInvoiceNo: 'QA-PI-2026-01',
    supplierId: qaSupplier.id,
    supplierName: qaSupplier.company,
    purchaseDate: new Date('2026-08-15'),
    financialYear: '2026-27',
    paymentStatus: 'Paid',
    status: 'Active',
    lines: [{
      productId: qaProduct.id,
      productName: qaProduct.name,
      batchId: qaBatch.id,
      batchNo: qaBatch.batchNo,
      expDate: qaBatch.expDate,
      hsn: qaProduct.hsn,
      qty: 100,
      rate: 50,
      discountPct: 0,
      gstRate: 12,
      taxableValue: 5000,
      cgst: 300,
      sgst: 300,
      igst: 0,
      total: 5600,
    }],
    grossTotal: 5000,
    discountTotal: 0,
    taxableTotal: 5000,
    cgstTotal: 300,
    sgstTotal: 300,
    igstTotal: 0,
    grandTotal: 5600,
  });
  console.log('[QA Flow] QA Purchase created:', qaPurchase.id, qaPurchase.purchaseInvoiceNo);

  await increaseStock({
    productId: qaProduct.id,
    batchId: qaBatch.id,
    batchNo: qaBatch.batchNo,
    expDate: qaBatch.expDate,
    qty: 100,
    purchaseRate: 50,
    saleRate: 85,
    mrp: 120,
    refType: 'Purchase',
    refId: qaPurchase.id,
    createdBy: 'QA Tester',
  });

  await postSupplierEntry({
    partyId: qaSupplier.id,
    date: new Date('2026-08-15'),
    type: 'Purchase',
    refId: qaPurchase.id,
    refNo: qaPurchase.purchaseInvoiceNo,
    credit: 5600,
  });

  // 4. Perform Sales Flow
  const qaSale = await Sale.create({
    id: 'QA-INV-001',
    invoiceNo: 'LLS/26-27/QA-0001',
    customerId: qaCustomer.id,
    date: new Date('2026-08-20'),
    financialYear: '2026-27',
    placeOfSupply: qaCustomer.state,
    isInterState: false,
    lines: [{
      productId: qaProduct.id,
      productName: qaProduct.name,
      batchId: qaBatch.id,
      batchNo: qaBatch.batchNo,
      expDate: qaBatch.expDate,
      hsn: qaProduct.hsn,
      qty: 50,
      freeQty: 0,
      rate: 85,
      discountPct: 5,
      gstRate: 12,
      taxableValue: 4037.5,
      cgst: 242.25,
      sgst: 242.25,
      igst: 0,
      total: 4522,
    }],
    grossTotal: 4250,
    discountTotal: 212.5,
    taxableTotal: 4037.5,
    cgstTotal: 242.25,
    sgstTotal: 242.25,
    igstTotal: 0,
    grandTotal: 4522,
    amountReceived: 2000,
    balance: 2522,
    paymentStatus: 'Partial',
    status: 'Active',
  });
  console.log('[QA Flow] QA Sale created:', qaSale.id, qaSale.invoiceNo);

  await decreaseStock({
    productId: qaProduct.id,
    batchId: qaBatch.id,
    qty: 50,
    refType: 'Sale',
    refId: qaSale.id,
    createdBy: 'QA Tester',
  });

  await postCustomerEntry({
    partyId: qaCustomer.id,
    date: new Date('2026-08-20'),
    type: 'Sale',
    refId: qaSale.id,
    refNo: qaSale.invoiceNo,
    debit: 4522,
  });

  // 5. Perform Sales Return
  const qaSalesReturn = await SalesReturn.create({
    id: 'QA-SR-001',
    saleId: qaSale.id,
    invoiceNo: qaSale.invoiceNo,
    customerId: qaCustomer.id,
    productId: qaProduct.id,
    batchId: qaBatch.id,
    qty: 5,
    reason: 'Damaged packaging in transit',
    refundAmount: 452.2,
    date: new Date('2026-08-22'),
    financialYear: '2026-27',
  });
  console.log('[QA Flow] QA Sales Return created:', qaSalesReturn.id);

  // 6. Perform Purchase Return
  const qaPurchaseReturn = await PurchaseReturn.create({
    id: 'QA-PR-001',
    purchaseId: qaPurchase.id,
    purchaseInvoiceNo: qaPurchase.purchaseInvoiceNo,
    supplierId: qaSupplier.id,
    productId: qaProduct.id,
    batchId: qaBatch.id,
    qty: 10,
    reason: 'Short expiry received',
    payableAdjustment: 560,
    date: new Date('2026-08-23'),
    financialYear: '2026-27',
  });
  console.log('[QA Flow] QA Purchase Return created:', qaPurchaseReturn.id);

  // 7. Perform Payment
  const qaPayment = await Payment.create({
    id: 'QA-PAY-001',
    partyId: qaCustomer.id,
    partyType: 'Customer',
    invoiceId: qaSale.id,
    amount: 2000,
    mode: 'UPI',
    date: new Date('2026-08-20'),
    createdBy: 'QA Tester',
  });
  console.log('[QA Flow] QA Payment created:', qaPayment.id);

  await CustomerLedger.create({
    partyId: qaCustomer.id,
    date: new Date('2026-08-20'),
    type: 'Payment',
    refId: qaPayment.id,
    refNo: qaPayment.id,
    debit: 0,
    credit: 2000,
    balance: 2522,
  });

  // 8. Verify Reports & Export PDF Pipeline
  console.log('\n[QA Flow] Testing GST Services & PDF Generation...');
  const gstr1Data = await gstReportService.getGstr1Data({ financialYear: '2026-27' });
  console.log('[QA Flow] GSTR-1 Array Rows fetched:', Array.isArray(gstr1Data) ? gstr1Data.length : 0);

  const gstr3bData = await gstReportService.getGstr3bData({ financialYear: '2026-27' });
  console.log('[QA Flow] GSTR-3B Tax Payable:', gstr3bData.netTaxPayable);

  const pdfBuffer = await generateInvoicePdf({ company, customer: qaCustomer, sale: qaSale });
  const isPdfValid = Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 10;
  console.log('[QA Flow] Generated Invoice PDF Binary Buffer size:', pdfBuffer.length, 'bytes | Valid:', isPdfValid);

  // 9. PERFORM SAFE DESTRUCTIVE CLEANUP FOR QA MARKERS ONLY
  console.log('\n[QA Flow] Executing Safe Marker-Based QA Cleanup...');

  const deletedSales = await Sale.deleteMany({ $or: [{ id: qaMarkerRegex }, { invoiceNo: /^LLS\/26-27\/QA-/i }] });
  const deletedSR = await SalesReturn.deleteMany({ id: qaMarkerRegex });
  const deletedPurchases = await Purchase.deleteMany({ $or: [{ id: qaMarkerRegex }, { purchaseInvoiceNo: qaMarkerRegex }] });
  const deletedPR = await PurchaseReturn.deleteMany({ id: qaMarkerRegex });
  const deletedPayments = await Payment.deleteMany({ id: qaMarkerRegex });
  const deletedCustLedger = await CustomerLedger.deleteMany({ partyId: qaMarkerRegex });
  const deletedSuppLedger = await SupplierLedger.deleteMany({ partyId: qaMarkerRegex });
  const deletedStock = await StockMovement.deleteMany({ productId: qaMarkerRegex });
  const deletedBatches = await ProductBatch.deleteMany({ $or: [{ id: qaMarkerRegex }, { batchNo: qaMarkerRegex }] });
  const deletedProducts = await Product.deleteMany({ $or: [{ id: qaMarkerRegex }, { sku: qaMarkerRegex }] });
  const deletedCustomers = await Customer.deleteMany({ id: qaMarkerRegex });
  const deletedSuppliers = await Supplier.deleteMany({ id: qaMarkerRegex });

  console.log('[QA Flow] QA Records Safely Deleted:');
  console.log('  Sales:', deletedSales.deletedCount);
  console.log('  Sales Returns:', deletedSR.deletedCount);
  console.log('  Purchases:', deletedPurchases.deletedCount);
  console.log('  Purchase Returns:', deletedPR.deletedCount);
  console.log('  Payments:', deletedPayments.deletedCount);
  console.log('  Customer Ledgers:', deletedCustLedger.deletedCount);
  console.log('  Supplier Ledgers:', deletedSuppLedger.deletedCount);
  console.log('  Stock Movements:', deletedStock.deletedCount);
  console.log('  Batches:', deletedBatches.deletedCount);
  console.log('  Products:', deletedProducts.deletedCount);
  console.log('  Customers:', deletedCustomers.deletedCount);
  console.log('  Suppliers:', deletedSuppliers.deletedCount);

  // 10. INDEPENDENT CLEANUP VERIFICATION
  console.log('\n[QA Flow] Running Independent Verification Queries...');
  const remainingQaCust = await Customer.countDocuments({ id: qaMarkerRegex });
  const remainingQaSupp = await Supplier.countDocuments({ id: qaMarkerRegex });
  const remainingQaProd = await Product.countDocuments({ id: qaMarkerRegex });
  const remainingQaBatch = await ProductBatch.countDocuments({ id: qaMarkerRegex });
  const remainingQaSale = await Sale.countDocuments({ id: qaMarkerRegex });
  const remainingQaPur = await Purchase.countDocuments({ id: qaMarkerRegex });

  const totalRemainingQa = remainingQaCust + remainingQaSupp + remainingQaProd + remainingQaBatch + remainingQaSale + remainingQaPur;
  console.log('[QA Flow] Remaining QA Marker Records in Database:', totalRemainingQa);
  if (totalRemainingQa !== 0) {
    throw new Error('QA Cleanup Failed: QA records still exist in database!');
  }
  console.log('[QA Flow] ✅ INDEPENDENT CLEANUP VERIFICATION PASSED: 0 QA records remain.');

  // 11. VERIFY REAL COMPANY SETTINGS SURVIVED INTACT
  const survivingCompany = await Company.findOne();
  console.log('[QA Flow] Verifying Surviving Company Settings:');
  console.log('  Name:', survivingCompany.name);
  console.log('  Address:', survivingCompany.address);
  console.log('  GSTIN:', survivingCompany.gstin);
  console.log('  State Code:', survivingCompany.stateCode);
  console.log('  Phone/Mobile:', survivingCompany.phone);

  const phoneVal = survivingCompany.phone || survivingCompany.mobile || '';
  if (!survivingCompany.gstin || !phoneVal) {
    throw new Error('Company Settings Integrity Failed!');
  }
  console.log('[QA Flow] ✅ COMPANY SETTINGS INTEGRITY VERIFIED.');

  await mongoose.disconnect();
  console.log('\n[QA Flow] QA Flow Completed Successfully.');
}

runDeterministicQaFlow().catch((err) => {
  console.error('[QA Flow Error]:', err);
  process.exit(1);
});
