const dayjs = require('dayjs');

function formatCurrency(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d) { return d ? dayjs(d).format('DD-MM-YYYY') : '-'; }

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPaymentReceiptHtml({ company, party, payment }) {
  const comp = company || {};
  const p = party || {};
  const pay = payment || {};

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Payment Receipt ${escapeHtml(pay.id || '')}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; }
  .doc-wrap { width: 100%; border: 1.5px solid #222; max-width: 700px; margin: 20px auto; }
  .title-bar { text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 1.5px; padding: 6px 0; border-bottom: 1.5px solid #222; background: #fafafa; text-transform: uppercase; }
  .comp-box { padding: 10px 14px; border-bottom: 1.5px solid #222; }
  .comp-title { font-size: 15px; font-weight: bold; color: #000; }
  .meta-text { font-size: 10px; line-height: 1.4; color: #222; margin-top: 3px; }
  .detail-grid { padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; }
  .detail-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
  .amount-box { margin: 14px; padding: 12px 16px; background: #f4f4f4; border: 1.5px solid #222; display: flex; justify-content: space-between; align-items: center; }
  .amount-title { font-size: 13px; font-weight: bold; }
  .amount-val { font-size: 18px; font-weight: bold; color: #000; }
  .sig-strip { display: flex; justify-content: space-between; border-top: 1.5px solid #222; padding: 24px 16px 12px; font-size: 10px; margin-top: 20px; }
  .sig-box { width: 180px; text-align: center; }
  .sig-line { border-bottom: 1px solid #222; height: 24px; margin-bottom: 4px; }
</style></head>
<body>
  <div class="doc-wrap">
    <div class="title-bar">OFFICIAL PAYMENT RECEIPT</div>
    <div class="comp-box">
      <div class="comp-title">${escapeHtml(comp.name || 'L LAETUS LIFE SCIENCES')}</div>
      <div class="meta-text">
        ${escapeHtml(comp.addressLine1 || comp.address || '')}<br/>
        ${comp.addressLine2 ? escapeHtml(comp.addressLine2) + '<br/>' : ''}
        GSTIN: ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')} | Phone: ${escapeHtml(comp.phone || '9662031042')}
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="detail-row"><span>Receipt No:</span><strong>${escapeHtml(pay.id || '-')}</strong></div>
        <div class="detail-row"><span>Date:</span><strong>${formatDate(pay.date)}</strong></div>
        <div class="detail-row"><span>Payment Mode:</span><strong>${escapeHtml(pay.mode || 'Cash')}</strong></div>
        <div class="detail-row"><span>Reference / Chq No:</span><strong>${escapeHtml(pay.reference || '-')}</strong></div>
      </div>
      <div>
        <div class="detail-row"><span>Party Type:</span><strong>${escapeHtml(pay.partyType || 'Customer')}</strong></div>
        <div class="detail-row"><span>Party Name:</span><strong>${escapeHtml(p.partyName || p.name || pay.partyId || 'N/A')}</strong></div>
        <div class="detail-row"><span>GSTIN:</span><strong>${escapeHtml(p.gstin || '-')}</strong></div>
        <div class="detail-row"><span>Invoice Applied:</span><strong>${escapeHtml(pay.invoiceId || 'Account Balance')}</strong></div>
      </div>
    </div>

    <div class="amount-box">
      <span class="amount-title">AMOUNT RECEIVED:</span>
      <span class="amount-val">${formatCurrency(pay.amount)}</span>
    </div>

    <div style="padding: 0 14px 10px; font-size: 10px; color: #444;">
      <strong>Remarks:</strong> ${escapeHtml(pay.remarks || 'Thank you for your payment.')}
    </div>

    <div class="sig-strip">
      <div>Received By: ${escapeHtml(pay.createdBy || 'System')}</div>
      <div class="sig-box"><div class="sig-line"></div>Authorized Signatory</div>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderPaymentReceiptHtml };
