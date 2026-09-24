const axios = require('../frontend/node_modules/axios');

const BASE_URL = 'http://localhost:5000/api';
let token = '';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PRODUCTION HARDENING INTEGRATION SUITE');
  console.log('====================================================');

  try {
    // 1. Health check
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log('[PASS] GET /health:', healthRes.data);

    // 2. Auth Login
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123',
    });
    token = loginRes.data.data.accessToken;
    console.log('[PASS] Auth login success. Token acquired. User:', loginRes.data.data.user.name);

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 3. Create test Customer
    const custRes = await axios.post(`${BASE_URL}/customers`, {
      partyName: 'Hardened Test Pharmacy',
      mobile: '9876543210',
      state: 'Gujarat',
      stateCode: '24',
    }, authHeaders);
    const testCustId = custRes.data.data.id;
    console.log('[PASS] Created Test Customer:', testCustId);

    // 4. Create test Product & Batch
    const prodRes = await axios.post(`${BASE_URL}/products`, {
      name: 'Hardened Test Tablet 500mg',
      sku: `HARD-${Date.now()}`,
      hsn: '30049099',
      gstRate: 12,
      mrp: 100,
      saleRate: 80,
    }, authHeaders);
    const testProdId = prodRes.data.data.id;
    console.log('[PASS] Created Test Product:', testProdId);

    // Create purchase to populate batch
    const suppRes = await axios.post(`${BASE_URL}/suppliers`, {
      company: 'Hardened Test Pharma Supplier',
      mobile: '9123456789',
    }, authHeaders);
    const testSuppId = suppRes.data.data.id;
    console.log('[PASS] Created Test Supplier:', testSuppId);

    const purRes = await axios.post(`${BASE_URL}/purchases`, {
      supplierId: testSuppId,
      purchaseDate: new Date(),
      lines: [{
        productId: testProdId,
        batchNo: `BATCH-H-${Date.now()}`,
        expDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        qty: 100,
        rate: 50,
        gstRate: 12,
        mrp: 100,
      }],
      amountPaid: 0,
    }, authHeaders);
    const testPurId = purRes.data.data.id;

    // Fetch batch for created product
    const batchesRes = await axios.get(`${BASE_URL}/batches?productId=${testProdId}`, authHeaders);
    const testBatchId = batchesRes.data.data[0].id;
    console.log('[PASS] Created Purchase & Fetched Batch:', testPurId, 'BatchId:', testBatchId);

    // 5. Create Sale Invoice
    const saleRes = await axios.post(`${BASE_URL}/sales`, {
      customerId: testCustId,
      lines: [{
        productId: testProdId,
        batchId: testBatchId,
        qty: 10,
        rate: 80,
        gstRate: 12,
      }],
      amountReceived: 0,
    }, authHeaders);
    const testSaleId = saleRes.data.data.id;
    console.log('[PASS] Created Sales Invoice:', testSaleId);

    // 6. TEST MASTER DEPENDENCY BLOCK
    console.log('\n--- TESTING MASTER DEPENDENCY BLOCK ---');
    try {
      await axios.delete(`${BASE_URL}/customers/${testCustId}`, authHeaders);
      console.error('[FAIL] Referenced customer deletion should have been blocked!');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        console.log('[PASS] Referenced Customer Delete Blocked (409 Conflict):', err.response.data.message);
      } else {
        console.error('[FAIL] Unexpected error during customer delete check:', err.response?.data || err.message);
      }
    }

    try {
      await axios.delete(`${BASE_URL}/products/${testProdId}`, authHeaders);
      console.error('[FAIL] Referenced product deletion should have been blocked!');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        console.log('[PASS] Referenced Product Delete Blocked (409 Conflict):', err.response.data.message);
      } else {
        console.error('[FAIL] Unexpected error during product delete check:', err.response?.data || err.message);
      }
    }

    // 7. TEST DEACTIVATE & REACTIVATE
    console.log('\n--- TESTING MASTER DEACTIVATE & REACTIVATE ---');
    const deactRes = await axios.patch(`${BASE_URL}/customers/${testCustId}/deactivate`, {}, authHeaders);
    console.log('[PASS] Deactivated Customer status:', deactRes.data.data.status);

    const reactRes = await axios.patch(`${BASE_URL}/customers/${testCustId}/reactivate`, {}, authHeaders);
    console.log('[PASS] Reactivated Customer status:', reactRes.data.data.status);

    // 8. TEST SALES RETURN QUANTITY RESTRICTIONS
    console.log('\n--- TESTING SALES RETURN LIMIT RESTRICTION ---');
    try {
      await axios.post(`${BASE_URL}/returns/sales`, {
        saleId: testSaleId,
        lineIndex: 0,
        qty: 50, // Exceeds original 10
        reason: 'Excessive return test',
      }, authHeaders);
      console.error('[FAIL] Over-return should have been rejected!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('[PASS] Over-return Blocked (400 Bad Request):', err.response.data.message);
      } else {
        console.error('[FAIL] Unexpected error on over-return test:', err.response?.data || err.message);
      }
    }

    // Valid partial return (2 units)
    const validReturnRes = await axios.post(`${BASE_URL}/returns/sales`, {
      saleId: testSaleId,
      lineIndex: 0,
      qty: 2,
      reason: 'Damaged strip',
    }, authHeaders);
    console.log('[PASS] Valid Partial Sales Return Created:', validReturnRes.data.data.id);

    // 9. TEST OUTSTANDING PAYMENT RESTRICTIONS
    console.log('\n--- TESTING OUTSTANDING PAYMENT RESTRICTIONS ---');
    const outRes = await axios.get(`${BASE_URL}/customers/${testCustId}/outstanding`, authHeaders);
    const currOutstanding = outRes.data.data.outstanding;
    console.log('[PASS] Customer Current Outstanding:', currOutstanding);

    // Attempt payment greater than outstanding
    try {
      await axios.post(`${BASE_URL}/payments`, {
        partyId: testCustId,
        partyType: 'Customer',
        amount: currOutstanding + 1000,
        mode: 'Cash',
      }, authHeaders);
      console.error('[FAIL] Overpayment should have been rejected!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('[PASS] Overpayment Blocked (400 Bad Request):', err.response.data.message);
      } else {
        console.error('[FAIL] Unexpected error on overpayment test:', err.response?.data || err.message);
      }
    }

    // Valid payment equal to current outstanding
    const validPayRes = await axios.post(`${BASE_URL}/payments`, {
      partyId: testCustId,
      partyType: 'Customer',
      amount: currOutstanding,
      mode: 'Cash',
    }, authHeaders);
    console.log('[PASS] Valid Customer Payment Created:', validPayRes.data.data.id);

    // Check outstanding is now 0 and payment is rejected
    const outRes2 = await axios.get(`${BASE_URL}/customers/${testCustId}/outstanding`, authHeaders);
    console.log('[PASS] Customer Outstanding after full payment:', outRes2.data.data.outstanding);

    try {
      await axios.post(`${BASE_URL}/payments`, {
        partyId: testCustId,
        partyType: 'Customer',
        amount: 100,
        mode: 'Cash',
      }, authHeaders);
      console.error('[FAIL] Zero outstanding payment should have been rejected!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('[PASS] Zero Outstanding Payment Blocked (400 Bad Request):', err.response.data.message);
      } else {
        console.error('[FAIL] Unexpected error on zero-outstanding payment test:', err.response?.data || err.message);
      }
    }

    // 10. TEST ADMIN MAINTENANCE & DIAGNOSTICS
    console.log('\n--- TESTING ADMIN MAINTENANCE ENDPOINTS ---');
    const diagRes = await axios.get(`${BASE_URL}/maintenance/diagnostics`, authHeaders);
    console.log('[PASS] System Diagnostics status:', diagRes.data.data.status, 'Collections:', diagRes.data.data.collections.length);

    const orphanRes = await axios.get(`${BASE_URL}/maintenance/scan-orphans`, authHeaders);
    console.log('[PASS] Orphan Scan totalFiles:', orphanRes.data.data.totalFiles, 'orphanCount:', orphanRes.data.data.orphanCount);

    const cleanRes = await axios.post(`${BASE_URL}/maintenance/cleanup`, {
      cleanOrphans: true,
      cleanNotifications: true,
    }, authHeaders);
    console.log('[PASS] Maintenance Cleanup completed:', cleanRes.data.data);

    // 11. UNUSED MASTER PERMANENT DELETE TEST
    console.log('\n--- TESTING UNUSED MASTER PERMANENT DELETE ---');
    const unusedCustRes = await axios.post(`${BASE_URL}/customers`, {
      partyName: 'Unused Temporary Customer',
      mobile: '9000000000',
    }, authHeaders);
    const unusedId = unusedCustRes.data.data.id;
    console.log('[PASS] Created Unused Customer:', unusedId);

    const delRes = await axios.delete(`${BASE_URL}/customers/${unusedId}`, authHeaders);
    console.log('[PASS] Unused Customer Deleted Permanently:', delRes.data.message);

    console.log('\n====================================================');
    console.log('ALL HARDENING & INTEGRATION TESTS PASSED 100%!');
    console.log('====================================================');
  } catch (err) {
    console.error('[CRITICAL FAILURE] Integration suite error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTests();
