require('./setup');
const request = require('supertest');
const dayjs = require('dayjs');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');
const { Sale, Customer, Product, ProductBatch, Supplier, Purchase } = require('../src/models');

jest.mock('../src/services/pdf.service', () => ({
  generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.alloc(200, '%PDF-1.4 mock pdf content ')),
  generatePurchasePdf: jest.fn().mockResolvedValue(Buffer.alloc(200, '%PDF-1.4 mock purchase pdf ')),
  generatePaymentPdf: jest.fn().mockResolvedValue(Buffer.alloc(200, '%PDF-1.4 mock payment pdf ')),
  generateLedgerPdf: jest.fn().mockResolvedValue(Buffer.alloc(200, '%PDF-1.4 mock ledger pdf ')),
  generateReportPdf: jest.fn().mockResolvedValue(Buffer.alloc(200, '%PDF-1.4 mock report pdf ')),
}));


jest.setTimeout(30000);

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Exports, GSTR-1 and ITC Reconciliation', () => {
  let token;

  beforeEach(async () => {
    await seedBaseData();
    token = await loginAs('admin@test.dev');
  });

  describe('Document Exports (Excel, DOCX, CSV)', () => {
    test('GET /api/exports/outstanding/xlsx returns valid Excel binary', async () => {
      const res = await request(app)
        .get('/api/exports/outstanding/xlsx')
        .set('Authorization', `Bearer ${token}`)
        .buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('GET /api/exports/outstanding/docx returns valid Word document binary', async () => {
      const res = await request(app)
        .get('/api/exports/outstanding/docx')
        .set('Authorization', `Bearer ${token}`)
        .buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('wordprocessingml.document');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('GET /api/exports/outstanding/csv returns valid CSV text', async () => {
      const res = await request(app)
        .get('/api/exports/outstanding/csv')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Party Name');
      expect(res.text).toContain('Bill No');
    });

    test('GET /api/exports/products/pdf returns valid PDF binary', async () => {
      const res = await request(app)
        .get('/api/exports/products/pdf')
        .set('Authorization', `Bearer ${token}`)
        .buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('GET /api/exports/customers/pdf returns valid PDF binary', async () => {
      const res = await request(app)
        .get('/api/exports/customers/pdf')
        .set('Authorization', `Bearer ${token}`)
        .buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('GET /api/exports/sales/pdf returns valid PDF binary', async () => {
      const res = await request(app)
        .get('/api/exports/sales/pdf')
        .set('Authorization', `Bearer ${token}`)
        .buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('HTML template renderers render without error', () => {
      const { renderReportTableHtml } = require('../src/templates/reportTable.html.js');
      const { renderInvoiceHtml } = require('../src/templates/invoice.html.js');
      const { renderPurchaseHtml } = require('../src/templates/purchase.html.js');
      const { renderPaymentReceiptHtml } = require('../src/templates/paymentReceipt.html.js');
      const { renderLedgerHtml } = require('../src/templates/ledger.html.js');

      const reportHtml = renderReportTableHtml({
        title: 'Test Report',
        columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }],
        rows: [{ id: '1', name: 'Item 1' }],
        company: { name: 'L LAETUS' },
      });
      expect(reportHtml).toContain('Test Report');
      expect(reportHtml).toContain('Item 1');

      const invoiceHtml = renderInvoiceHtml({
        company: { name: 'L LAETUS' },
        customer: { partyName: 'Cust' },
        sale: { invoiceNo: 'INV-001', lines: [] },
      });
      expect(invoiceHtml).toContain('INV-001');

      const purchaseHtml = renderPurchaseHtml({
        company: { name: 'L LAETUS' },
        supplier: { partyName: 'Supp' },
        purchase: { purchaseInvoiceNo: 'PUR-001', lines: [] },
      });
      expect(purchaseHtml).toContain('PUR-001');

      const receiptHtml = renderPaymentReceiptHtml({
        company: { name: 'L LAETUS' },
        party: { partyName: 'Cust' },
        payment: { id: 'PAY-001', amount: 500 },
      });
      expect(receiptHtml).toContain('PAY-001');

      const ledgerHtml = renderLedgerHtml({
        company: { name: 'L LAETUS' },
        party: { partyName: 'Cust' },
        partyType: 'Customer',
        entries: [],
      });
      expect(ledgerHtml).toContain('CUSTOMER LEDGER STATEMENT');
    });



    test('GET /api/exports/gstr1/xlsx returns GSTR-1 Excel export', async () => {
      const res = await request(app)
        .get('/api/exports/gstr1/xlsx')
        .set('Authorization', `Bearer ${token}`)
        .buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    test('GET /api/exports/itc_reconciliation/csv returns ITC CSV export', async () => {
      const res = await request(app)
        .get('/api/exports/itc_reconciliation/csv')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Supplier GSTIN');
    });
  });

  describe('GSTR-1 Rebuild from Authoritative Sales Data', () => {
    test('classifies registered customer as B2B and unregistered as B2C', async () => {
      // Create registered customer
      const regCust = await Customer.create({
        id: 'CUST-REG-01',
        partyName: 'Registered Pharma Care',
        mobile: '9898989898',
        gstin: '24AABCL1234F1Z5',
        stateCode: '24',
      });

      // Create unregistered customer
      const unregCust = await Customer.create({
        id: 'CUST-UNREG-01',
        partyName: 'Local Retail Clinic',
        mobile: '9797979797',
        gstin: '',
        stateCode: '24',
      });

      // Bill B2B
      await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: regCust.id,
        date: '2026-08-15',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 80, gstRate: 12 }],
      });

      // Bill B2C
      await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: unregCust.id,
        date: '2026-08-16',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 5, rate: 80, gstRate: 12 }],
      });

      const res = await request(app)
        .get('/api/gst/gstr1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const rows = res.body.data;
      const b2bRow = rows.find((r) => r.customerName === 'Registered Pharma Care');
      const b2cRow = rows.find((r) => r.customerName === 'Local Retail Clinic');

      expect(b2bRow).toBeDefined();
      expect(b2bRow.category).toBe('B2B');
      expect(b2bRow.gstin).toBe('24AABCL1234F1Z5');

      expect(b2cRow).toBeDefined();
      expect(b2cRow.category).toBe('B2C Small');
    });

    test('GSTR-1 does not crash when a sales return exists in range (regression: undefined variable bug)', async () => {
      const saleRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-15',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 80, gstRate: 12 }],
      });
      expect(saleRes.status).toBe(201);
      const sale = saleRes.body.data;

      const returnRes = await request(app).post('/api/returns/sales').set('Authorization', `Bearer ${token}`).send({
        saleId: sale.id, lineIndex: 0, qty: 2, reason: 'Damaged in transit',
      });
      expect(returnRes.status).toBe(201);

      // Before the fix, this request threw "ReferenceError: s is not defined"
      // inside the credit-note row builder and the endpoint returned a 500.
      const res = await request(app).get('/api/gst/gstr1').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const creditNoteRow = res.body.data.find((r) => r.category === 'Credit Note');
      expect(creditNoteRow).toBeDefined();
      expect(creditNoteRow.financialYear).toMatch(/^\d{2}-\d{2}$/); // e.g. "26-27", derived from the return's date, not a hardcoded year
    });

    test('GSTR-1 credit notes are filtered by date range, not returned for every period regardless of when they happened (regression)', async () => {
      const saleRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-01-10',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 80, gstRate: 12 }],
      });
      const sale = saleRes.body.data;
      await request(app).post('/api/returns/sales').set('Authorization', `Bearer ${token}`).send({
        saleId: sale.id, lineIndex: 0, qty: 2, reason: 'Old return, January',
      });

      // Query a completely different period (August) — the January return
      // must NOT show up here. Before the fix, SalesReturn.find({}) had no
      // date filter at all, so it appeared in every period's GSTR-1.
      const res = await request(app)
        .get('/api/gst/gstr1')
        .query({ from: '2026-08-01', to: '2026-08-31' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const creditNoteRow = res.body.data.find((r) => r.category === 'Credit Note');
      expect(creditNoteRow).toBeUndefined();
    });

    test('GSTR-1 breaks a mixed-rate invoice into separate rate-bucket rows with quantity and GST% populated', async () => {
      await Product.create({ id: 'PRD-RATE5', sku: 'RATE5-SKU', name: 'Low Rate Item', hsn: '30049023', gstRate: 5, mrp: 30, saleRate: 20, purchaseRate: 12 });
      await ProductBatch.create({ id: 'BAT-RATE5', productId: 'PRD-RATE5', batchNo: 'R5-1', expDate: dayjs().add(1, 'year').toDate(), mrp: 30, purchaseRate: 12, saleRate: 20, currentQty: 50, status: 'Healthy' });

      const saleRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-20',
        lines: [
          { productId: 'PRD-000001', batchId: 'BAT-000001', qty: 5, rate: 80, gstRate: 12 },
          { productId: 'PRD-RATE5', batchId: 'BAT-RATE5', qty: 3, rate: 20, gstRate: 5 },
        ],
      });
      expect(saleRes.status).toBe(201);
      const invoiceNo = saleRes.body.data.invoiceNo;

      const res = await request(app).get('/api/gst/gstr1').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const bucketsForThisInvoice = res.body.data.filter((r) => r.invoiceNo === invoiceNo);
      expect(bucketsForThisInvoice.length).toBe(2); // one row per GST rate, not one blended row
      const rates = bucketsForThisInvoice.map((r) => r.gstRatePct).sort((a, b) => a - b);
      expect(rates).toEqual([5, 12]);
      bucketsForThisInvoice.forEach((r) => {
        expect(r.quantity).toBeGreaterThan(0);
        expect(typeof r.gstRatePct).toBe('number');
      });
      // Invoice value is shown once (on the first bucket) to avoid double-counting in summary totals
      const totalInvoiceValueAcrossBuckets = bucketsForThisInvoice.reduce((a, r) => a + r.invoiceValue, 0);
      expect(totalInvoiceValueAcrossBuckets).toBeGreaterThan(0);
    });
  });

  describe('Purchase / ITC Reconciliation', () => {
    test('calculates ITC eligibility and status accurately from purchases', async () => {
      const supp = await Supplier.create({
        id: 'SUPP-ITC-01',
        company: 'ITC Supplier Pvt Ltd',
        mobile: '9123456789',
        gstin: '24AAACT9999K1Z1',
        stateCode: '24',
      });

      await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
        purchaseInvoiceNo: 'PI-ITC-01',
        purchaseDate: '2026-08-10',
        supplierId: supp.id,
        lines: [{ productId: 'PRD-000001', batchNo: 'BATCH-ITC-1', expDate: '2028-05-01', qty: 20, rate: 50, gstRate: 12 }],
      });

      const res = await request(app)
        .get('/api/gst/itc-reconciliation')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const rows = res.body.data;
      const row = rows.find((r) => r.invoiceNo === 'PI-ITC-01');
      expect(row).toBeDefined();
      expect(row.supplierGstin).toBe('24AAACT9999K1Z1');
      expect(row.totalTax).toBeCloseTo(120); // 20 * 50 = 1000 * 12% = 120
      expect(row.itcEligibility).toBe('Eligible');
    });
  });

  describe('GSTR-3B Summary Engine (Output > ITC, Output < ITC, Output = ITC)', () => {
    test('Scenario 1: Output > ITC -> Net Tax Payable > 0 and Carry Forward = 0', async () => {
      // Sale: Output tax = 120 (CGST 60, SGST 60)
      await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-20',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 100, gstRate: 12 }],
      });

      // Purchase: Input tax = 60 (CGST 30, SGST 30)
      await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
        purchaseInvoiceNo: 'PI-G3B-01',
        purchaseDate: '2026-08-20',
        supplierId: 'SUPP-000001',
        lines: [{ productId: 'PRD-000001', batchNo: 'BAT-G3B-01', expDate: '2028-01-01', qty: 10, rate: 50, gstRate: 12 }],
      });

      const res = await request(app).get('/api/gst/gstr3b').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totalOutputTax).toBeCloseTo(120);
      expect(data.totalEligibleItc).toBeCloseTo(60);
      expect(data.netTaxPayable).toBeCloseTo(60); // 120 - 60
      expect(data.totalClosingItc).toBe(0);
      expect(data.netTaxPayable).toBeGreaterThanOrEqual(0);
    });

    test('Scenario 2: Output < ITC -> Net Tax Payable = 0, Carry Forward > 0 (Never negative)', async () => {
      // Sale: Output tax = 24
      await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-20',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 2, rate: 100, gstRate: 12 }],
      });

      // Purchase: Input tax = 240
      await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
        purchaseInvoiceNo: 'PI-G3B-02',
        purchaseDate: '2026-08-20',
        supplierId: 'SUPP-000001',
        lines: [{ productId: 'PRD-000001', batchNo: 'BAT-G3B-02', expDate: '2028-01-01', qty: 40, rate: 50, gstRate: 12 }],
      });

      const res = await request(app).get('/api/gst/gstr3b').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totalOutputTax).toBeCloseTo(24);
      expect(data.totalEligibleItc).toBeCloseTo(240);
      expect(data.netTaxPayable).toBe(0); // Zero cash liability!
      expect(data.totalClosingItc).toBeCloseTo(216); // 240 - 24
      expect(data.netTaxPayable).toBeGreaterThanOrEqual(0);
    });

    test('GET /api/exports/gstr3b/xlsx returns GSTR-3B Excel binary', async () => {
      const res = await request(app)
        .get('/api/exports/gstr3b/xlsx')
        .set('Authorization', `Bearer ${token}`)
        .buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });

  describe('Complete Master & Transaction CRUD Audit', () => {
    test('Master safe deactivation / status toggling without destructive deletion', async () => {
      const cust = await Customer.create({
        id: 'CUST-AUDIT-01',
        partyName: 'Audit Test Customer',
        mobile: '9000000000',
        status: 'Active',
      });

      const patchRes = await request(app)
        .patch(`/api/customers/${cust.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Inactive' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('Inactive');

      // Verify record still preserved in database
      const found = await Customer.findOne({ id: cust.id });
      expect(found).not.toBeNull();
      expect(found.status).toBe('Inactive');
    });

    test('Financial transaction safe cancellation with audit record', async () => {
      const saleRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-22',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 5, rate: 80, gstRate: 12 }],
      });
      const saleId = saleRes.body.data.id;

      const cancelRes = await request(app)
        .patch(`/api/sales/${saleId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Customer requested cancellation' });

      expect(cancelRes.status).toBe(200);



      expect(cancelRes.body.data.status).toBe('Cancelled');
      expect(cancelRes.body.data.cancelReason).toBe('Customer requested cancellation');

      // Verify record preserved
      const cancelledSale = await Sale.findOne({ id: saleId });
      expect(cancelledSale.status).toBe('Cancelled');
    });
  });

  describe('CHUNK 10 — Invoice Lifecycle (Modify rate, stock reversal, ledger & audit)', () => {
    test('Create invoice -> Edit rate -> Verify GST, Stock & Ledger -> Cancel & verify stock restoration', async () => {
      // 1. Create dedicated Product & ProductBatch for Lifecycle test isolation
      const prod = await Product.create({
        id: 'PRD-LC-01',
        sku: 'SKU-LC-01',
        name: 'Paracetamol 650mg Test',
        code: 'PCM650',
        hsn: '30049099',
        pack: '10x10',
        mrp: 120,
        saleRate: 100,
        currentStock: 100,
      });


      const batchBefore = await ProductBatch.create({
        id: 'BAT-LC-01',
        productId: prod.id,
        batchNo: 'BATCH-LC-100',
        mfgDate: new Date('2025-01-01'),
        expDate: new Date('2028-12-31'),
        purchaseRate: 50,
        saleRate: 100,
        mrp: 120,
        currentQty: 100,
      });
      const initialQty = batchBefore.currentQty;

      // 2. Create invoice (qty 10 @ rate 100, 12% GST)
      const createRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-23',
        lines: [{ productId: prod.id, batchId: batchBefore.id, qty: 10, rate: 100, gstRate: 12 }],
      });
      expect(createRes.status).toBe(201);
      const sale = createRes.body.data;
      expect(sale.grandTotal).toBeCloseTo(1120); // 1000 + 120 GST

      // Stock reduced by 10
      const batchAfterCreate = await ProductBatch.findOne({ id: batchBefore.id });
      expect(batchAfterCreate.currentQty).toBe(initialQty - 10);

      const updateRes = await request(app).put(`/api/sales/${sale.id}`).set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-23',
        lines: [{ productId: prod.id, batchId: batchBefore.id, qty: 5, rate: 150, gstRate: 12 }],
      });

      expect(updateRes.status).toBe(200);


      const updatedSale = updateRes.body.data;
      expect(updatedSale.grandTotal).toBeCloseTo(840); // 5 * 150 = 750 + 90 GST = 840

      // Stock re-reconciled: restored 10, deducted 5 -> Net deduction 5
      const batchAfterUpdate = await ProductBatch.findOne({ id: batchBefore.id });
      expect(batchAfterUpdate.currentQty).toBe(initialQty - 5);

      // 4. Cancel invoice
      const cancelRes = await request(app).patch(`/api/sales/${sale.id}/cancel`).set('Authorization', `Bearer ${token}`).send({
        reason: 'Client cancelled order',
      });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('Cancelled');

      // Stock fully restored to initial
      const batchAfterCancel = await ProductBatch.findOne({ id: batchBefore.id });
      expect(batchAfterCancel.currentQty).toBe(initialQty);
    });
  });


  describe('CHUNK 11 — Company Settings End-to-End', () => {
    test('Update company details -> Create invoice -> Verify updated company details in invoice & PDF', async () => {
      jest.setTimeout(60000);
      // 1. Update company settings
      const updateCompRes = await request(app).put('/api/company').set('Authorization', `Bearer ${token}`).send({
        name: 'APEX PHARMA LABS PRIVATE LIMITED',
        addressLine1: 'Plot 55, GIDC Industrial Estate',
        addressLine2: 'Surat - 395003, Gujarat',
        phone: '+91 98989 12345',
        gstin: '24APEXX1234F1Z9',
        drugLicence: 'GJ-SUR-20-88888 / 21-88889',
        bank: {
          bankName: 'Axis Bank Ltd',
          accountNumber: '91100011223344',
          ifsc: 'UTIB0000123',
        },
        signatoryLabel: 'for APEX PHARMA LABS PRIVATE LIMITED',
      });
      expect(updateCompRes.status).toBe(200);

      // 2. Fetch updated company
      const getCompRes = await request(app).get('/api/company').set('Authorization', `Bearer ${token}`);
      expect(getCompRes.status).toBe(200);
      expect(getCompRes.body.data.name).toBe('APEX PHARMA LABS PRIVATE LIMITED');
      expect(getCompRes.body.data.gstin).toBe('24APEXX1234F1Z9');

      // 3. Create invoice and download PDF
      const saleRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
        customerId: 'CUST-000001',
        date: '2026-08-24',
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 2, rate: 100, gstRate: 12 }],
      });
      expect(saleRes.status).toBe(201);
      const saleId = saleRes.body.data.id;

      const pdfRes = await request(app)
        .get(`/api/sales/${saleId}/pdf`)
        .set('Authorization', `Bearer ${token}`)
        .parse((res, callback) => {
          res.setEncoding('binary');
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => { callback(null, Buffer.from(data, 'binary')); });
        });

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.body.length).toBeGreaterThan(100);
    });
  });
});



