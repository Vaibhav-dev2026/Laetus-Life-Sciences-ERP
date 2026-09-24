const axios = require('../frontend/node_modules/axios');

const BASE_URL = 'http://localhost:5000/api';
let token = '';

async function runPdfAndExportTests() {
  console.log('====================================================');
  console.log('TESTING PDF & EXPORT SERVICES ACCROSS ERP');
  console.log('====================================================');

  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123',
    });
    token = loginRes.data.data.accessToken;
    console.log('[PASS] Auth login success. User:', loginRes.data.data.user.name);

    const headers = { Authorization: `Bearer ${token}` };

    const [sales, purchases, payments] = await Promise.all([
      axios.get(`${BASE_URL}/sales`, { headers }),
      axios.get(`${BASE_URL}/purchases`, { headers }),
      axios.get(`${BASE_URL}/payments`, { headers }),
    ]);

    const sampleSaleId = sales.data.data[0]?.id;
    const samplePurId = purchases.data.data[0]?.id;
    const samplePayId = payments.data.data[0]?.id;

    const pdfEndpoints = [
      { name: 'Customer Ledger PDF (/api/pdf/customer-ledger)', url: '/pdf/customer-ledger?partyId=CUST-000001' },
      { name: 'Supplier Ledger PDF (/api/pdf/supplier-ledger)', url: '/pdf/supplier-ledger?partyId=SUPP-000001' },
    ];

    if (sampleSaleId) {
      pdfEndpoints.push({ name: 'Sales Invoice PDF (/api/sales/:id/pdf)', url: `/sales/${sampleSaleId}/pdf` });
      pdfEndpoints.push({ name: 'PDF Service Invoice (/api/pdf/invoice/:id)', url: `/pdf/invoice/${sampleSaleId}` });
    }

    if (samplePurId) {
      pdfEndpoints.push({ name: 'Purchase Bill PDF (/api/purchases/:id/pdf)', url: `/purchases/${samplePurId}/pdf` });
      pdfEndpoints.push({ name: 'PDF Service Purchase (/api/pdf/purchase/:id)', url: `/pdf/purchase/${samplePurId}` });
    }

    if (samplePayId) {
      pdfEndpoints.push({ name: 'Payment PDF (/api/payments/:id/pdf)', url: `/payments/${samplePayId}/pdf` });
      pdfEndpoints.push({ name: 'PDF Service Payment (/api/pdf/payment/:id)', url: `/pdf/payment/${samplePayId}` });
    }

    console.log('\n--- TESTING SPECIFIC DOCUMENT PDF ENDPOINTS ---');
    for (const ep of pdfEndpoints) {
      try {
        const res = await axios.get(`${BASE_URL}${ep.url}`, {
          headers,
          responseType: 'arraybuffer',
        });

        const buf = Buffer.from(res.data);
        const header = buf.slice(0, 4).toString('utf-8');
        const contentType = res.headers['content-type'];

        if (res.status === 200 && contentType.includes('application/pdf') && header === '%PDF') {
          console.log(`[PASS] ${ep.name} -> HTTP 200, Content-Type: ${contentType}, Header: ${header}, Size: ${buf.length} bytes`);
        } else {
          console.error(`[FAIL] ${ep.name} -> Header: ${header}, Content-Type: ${contentType}, Status: ${res.status}`);
        }
      } catch (err) {
        console.error(`[FAIL] ${ep.name} error:`, err.response?.status, err.message);
      }
    }

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

    console.log('\n--- TESTING ALL 12 REPORT EXPORTS ACROSS ALL 4 FORMATS (48 COMBINATIONS) ---');
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
            console.log(`[PASS] Export ${rep}.${fmt} -> HTTP 200, Size: ${buf.length} bytes`);
          } else {
            failCount++;
            console.error(`[FAIL] Export ${rep}.${fmt} -> Empty or invalid response`);
          }
        } catch (err) {
          failCount++;
          console.error(`[FAIL] Export ${rep}.${fmt} error:`, err.response?.status, err.message);
        }
      }
    }

    console.log('\n====================================================');
    console.log(`EXPORT SUITE RESULT: ${passCount} PASSED, ${failCount} FAILED out of ${exportReports.length * formats.length} combinations.`);
    console.log('====================================================');
  } catch (err) {
    console.error('[CRITICAL FAILURE] PDF Test suite error:', err.message);
  }
}

runPdfAndExportTests();
