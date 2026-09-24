require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');
const { ProductBatch, Product, SupplierLedger } = require('../src/models');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Purchase transaction', () => {
  let token;
  beforeEach(async () => { await seedBaseData(); token = await loginAs('purchase@test.dev'); });

  test('purchase increases stock and creates a new batch with unique internal BAT-ID', async () => {
    const res = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-1001', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'NEW-BATCH-1', expDate: '2028-01-01', qty: 50, rate: 50, gstRate: 12 }],
    });
    expect(res.status).toBe(201);
    const batch = await ProductBatch.findOne({ productId: 'PRD-000001', batchNo: 'NEW-BATCH-1' });

    expect(batch).not.toBeNull();
    // BAT-000001 and BAT-000002 exist in seed data, so new internal batch ID must not collide with BAT-000001
    expect(batch.id).not.toBe('BAT-000001');
    expect(batch.id).not.toBe('BAT-000002');
    expect(batch.currentQty).toBe(50);

    const product = await Product.findOne({ id: 'PRD-000001' });
    expect(product.currentStock).toBe(170); // 100 existing (BAT-000001) + 20 (BAT-000002) + 50 new
  });

  test('sequential new purchases auto-increment internal batch IDs without collision', async () => {
    const res1 = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-SEQ-1', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'AUTO-BATCH-A', expDate: '2028-01-01', qty: 10, rate: 50, gstRate: 12 }],
    });
    expect(res1.status).toBe(201);
    const batch1 = await ProductBatch.findOne({ batchNo: 'AUTO-BATCH-A' });

    const res2 = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-SEQ-2', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'AUTO-BATCH-B', expDate: '2028-01-01', qty: 20, rate: 50, gstRate: 12 }],
    });
    expect(res2.status).toBe(201);
    const batch2 = await ProductBatch.findOne({ batchNo: 'AUTO-BATCH-B' });

    expect(batch1.id).not.toEqual(batch2.id);
  });

  test('purchase updates supplier payable via ledger', async () => {
    await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-1002', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'NEW-BATCH-2', expDate: '2028-01-01', qty: 10, rate: 50, gstRate: 12 }],
    });
    const entries = await SupplierLedger.find({ partyId: 'SUPP-000001', type: 'Purchase' });
    expect(entries.length).toBe(1);
    expect(entries[0].credit).toBeCloseTo(560); // 500 taxable + 60 gst(12%)
  });

  test('existing batch (same product+batchNo) accumulates stock rather than duplicating', async () => {
    await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-1003', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'B1', expDate: '2028-01-01', qty: 25, rate: 50, gstRate: 12 }],
    });
    const batches = await ProductBatch.find({ productId: 'PRD-000001', batchNo: 'B1' });
    expect(batches.length).toBe(1);
    expect(batches[0].currentQty).toBe(125); // 100 + 25
  });

  test('allows the same batchNo to be reused across different products (Finding 7: per-product uniqueness, matching the DB schema)', async () => {
    // Seed PRD-000001 already has batch 'B1' (done in seedBaseData).
    // Purchasing PRD-000002 with the SAME batch number 'B1' must now succeed —
    // manufacturer batch codes can legitimately repeat across different
    // products, and the DB's actual unique index is {productId, batchNo},
    // not batchNo alone.
    const res = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-SHARED-BATCH-1', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000002', batchNo: 'B1', expDate: '2028-01-01', qty: 10, rate: 50, gstRate: 12 }],
    });
    expect(res.status).toBe(201);

    const batchForProduct1 = await ProductBatch.findOne({ productId: 'PRD-000001', batchNo: 'B1' });
    const batchForProduct2 = await ProductBatch.findOne({ productId: 'PRD-000002', batchNo: 'B1' });
    expect(batchForProduct1).not.toBeNull();
    expect(batchForProduct2).not.toBeNull();
    expect(batchForProduct1.id).not.toBe(batchForProduct2.id); // two distinct batch records, same batchNo string
    expect(batchForProduct2.currentQty).toBe(10);
  });

  test('rejects a negative or zero quantity purchase line (data-integrity guard)', async () => {
    const negative = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-NEG-QTY', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'NEG-BATCH', expDate: '2028-01-01', qty: -5, rate: 50, gstRate: 12 }],
    });
    expect(negative.status).toBe(400);

    const zero = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-ZERO-QTY', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'ZERO-BATCH', expDate: '2028-01-01', qty: 0, rate: 50, gstRate: 12 }],
    });
    expect(zero.status).toBe(400);

    // Confirm neither rejected line actually created a batch record.
    const negBatch = await ProductBatch.findOne({ batchNo: 'NEG-BATCH' });
    const zeroBatch = await ProductBatch.findOne({ batchNo: 'ZERO-BATCH' });
    expect(negBatch).toBeNull();
    expect(zeroBatch).toBeNull();
  });

  test('rejects a negative rate purchase line', async () => {
    const res = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-NEG-RATE', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'NEG-RATE-BATCH', expDate: '2028-01-01', qty: 10, rate: -50, gstRate: 12 }],
    });
    expect(res.status).toBe(400);
  });

  test('rejects purchase with no lines', async () => {
    const res = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-1004', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001', lines: [],
    });
    expect(res.status).toBe(400);
  });

  test('pharmaceutical line fields (Pack, HSN, MRP, PTS, Free Qty) are saved and reloaded accurately in purchase', async () => {
    const res = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({
      purchaseInvoiceNo: 'PI-PHARMA-1',
      purchaseDate: '2026-08-24',
      supplierId: 'SUPP-000001',
      lines: [
        {
          productId: 'PRD-000001',
          productName: 'Test Medicine',
          pack: '10x10 Strips',
          mfg: 'Cipla Ltd',
          batchNo: 'PUR-B99',
          mfgDate: '2026-01-01',
          expDate: '2028-06-30',
          hsn: '30049099',
          mrp: 120,
          pts: 45,
          rate: 45, // PTS rate
          qty: 100,
          freeQty: 10, // 10 free units
          discountPct: 2,
          gstRate: 12,
        },
      ],
    });

    expect(res.status).toBe(201);
    const purchaseId = res.body.data.id;

    // Reload via GET /api/purchases/:id
    const getRes = await request(app).get(`/api/purchases/${purchaseId}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    const loadedLine = getRes.body.data.lines[0];

    // Verify all pharma fields
    expect(loadedLine.productName).toBe('Test Medicine');
    expect(loadedLine.pack).toBe('10x10 Strips');
    expect(loadedLine.mfg).toBe('Cipla Ltd');
    expect(loadedLine.batchNo).toBe('PUR-B99');
    expect(loadedLine.hsn).toBe('30049099');
    expect(loadedLine.mrp).toBe(120);
    expect(loadedLine.pts).toBe(45);
    expect(loadedLine.rate).toBe(45);
    expect(loadedLine.qty).toBe(100);
    expect(loadedLine.freeQty).toBe(10);
    expect(loadedLine.discountPct).toBe(2);
    expect(loadedLine.gstRate).toBe(12);

    // Math: Gross = 100 * 45 = 4500, 2% disc = 90, Taxable = 4410, 12% GST = 529.2 (CGST 264.6, SGST 264.6), Total = 4939.2
    expect(loadedLine.taxableValue).toBeCloseTo(4410);
    expect(loadedLine.cgst).toBeCloseTo(264.6);
    expect(loadedLine.sgst).toBeCloseTo(264.6);
    expect(loadedLine.total).toBeCloseTo(4939.2);

    // Stock verification: Batch was created with qty (100) + freeQty (10) = 110
    const batch = await ProductBatch.findOne({ batchNo: 'PUR-B99' });
    expect(batch).not.toBeNull();
    expect(batch.currentQty).toBe(110);
  });
});
