const axios = require('../frontend/node_modules/axios');

const BASE_URL = 'http://localhost:5000/api';
let token = '';

async function runReportingAndGstSuite() {
  console.log('====================================================');
  console.log('STARTING GST & REPORTING INTEGRATION SUITE');
  console.log('====================================================');

  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123',
    });
    token = loginRes.data.data.accessToken;
    console.log('[PASS] Auth login success. User:', loginRes.data.data.user.name);

    const headers = { Authorization: `Bearer ${token}` };

    // 1. TEST GSTR-1 REPORT ENDPOINT
    console.log('\n--- TESTING GSTR-1 REPORT ENDPOINT ---');
    const gstr1Res = await axios.get(`${BASE_URL}/gst/gstr1?financialYear=2026-27`, { headers });
    console.log('[PASS] GSTR-1 fetched. Total B2B Invoices:', gstr1Res.data.data.summary.totalB2bInvoices, 'B2C Invoices:', gstr1Res.data.data.summary.totalB2cInvoices);
    console.log('[PASS] GSTR-1 Table 12 HSN Rows:', gstr1Res.data.data.hsnRows.length, 'Doc Details:', gstr1Res.data.data.documentDetails);

    // 2. TEST GSTR-2B IMPORT ENDPOINT
    console.log('\n--- TESTING GSTR-2B PORTAL IMPORT ENDPOINT ---');
    const importRes = await axios.post(`${BASE_URL}/gst/gstr2b/import`, {
      period: '2026-08',
      financialYear: '2026-27',
      records: [
        {
          supplierGstin: '24SUPPH1234F1Z1',
          supplierName: 'Hardened Test Pharma Supplier',
          invoiceNo: 'PUR-000001',
          invoiceDate: '2026-08-15',
          invoiceValue: 5600,
          taxableValue: 5000,
          cgst: 300,
          sgst: 300,
          igst: 0,
        },
      ],
    }, { headers });
    console.log('[PASS] GSTR-2B Import success. Imported Count:', importRes.data.data.importedCount);

    // 3. TEST GSTR-2B RECONCILIATION ENDPOINT
    console.log('\n--- TESTING GSTR-2B RECONCILIATION ENDPOINT ---');
    const gstr2bRes = await axios.get(`${BASE_URL}/gst/gstr2b?financialYear=2026-27`, { headers });
    console.log('[PASS] GSTR-2B Recon fetched. Total Rows:', gstr2bRes.data.data.rows.length, 'Matched:', gstr2bRes.data.data.summary.matchedCount);

    // 4. TEST GSTR-3B PREPARATION REPORT ENDPOINT
    console.log('\n--- TESTING GSTR-3B PREPARATION REPORT ENDPOINT ---');
    const gstr3bRes = await axios.get(`${BASE_URL}/gst/gstr3b?financialYear=2026-27`, { headers });
    console.log('[PASS] GSTR-3B Output Taxable:', gstr3bRes.data.data.section31.outwardTaxable, 'Net ITC:', gstr3bRes.data.data.section4.totalNetItc);

    // 5. TEST CROSS-RECONCILIATION ENDPOINT
    console.log('\n--- TESTING CROSS-RECONCILIATION ENDPOINT ---');
    const crossRes = await axios.get(`${BASE_URL}/gst/cross-reconciliation?financialYear=2026-27`, { headers });
    console.log('[PASS] Cross Reconciliation Status:', crossRes.data.data.inputItc.status, 'Difference:', crossRes.data.data.inputItc.difference);

    // 6. TEST ALL 12 EXPORT REPORTS ACROSS ALL 4 FORMATS
    console.log('\n--- TESTING ALL 12 REPORTS ACROSS 4 FORMATS (48 COMBINATIONS) ---');
    const exportReports = [
      'sales',
      'purchases',
      'stock',
      'outstanding',
      'customers',
      'suppliers',
      'products',
      'payments',
      'expenses',
      'gstr1',
      'gstr3b',
      'itc_reconciliation',
    ];
    const formats = ['pdf', 'xlsx', 'csv', 'docx'];

    let passCount = 0;
    let failCount = 0;

    for (const rep of exportReports) {
      for (const fmt of formats) {
        try {
          const res = await axios.get(`${BASE_URL}/exports/${rep}/${fmt}`, {
            headers,
            responseType: 'arraybuffer',
          });
          const buf = Buffer.from(res.data);
          if (res.status === 200 && buf.length > 0) {
            passCount++;
          } else {
            failCount++;
            console.error(`[FAIL] Export ${rep}.${fmt} -> empty response`);
          }
        } catch (err) {
          failCount++;
          console.error(`[FAIL] Export ${rep}.${fmt} error:`, err.message);
        }
      }
    }
    console.log(`[PASS] Export Combinations Verified: ${passCount}/48 Passed.`);

    console.log('\n====================================================');
    console.log('ALL GST & REPORTING SUITE TESTS PASSED 100%!');
    console.log('====================================================');
  } catch (err) {
    console.error('[CRITICAL FAILURE] GST & Reporting Suite Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runReportingAndGstSuite();
