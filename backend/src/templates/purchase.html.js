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

function renderPurchaseHtml({ company, supplier, purchase }) {
  const p = purchase || {};
  const lines = p.lines || [];
  const comp = company || {};
  const supp = supplier || {};

  const rows = lines.map((l, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td style="text-align:left;font-weight:bold;">${escapeHtml(l.productName || l.productId)}</td>
      <td style="text-align:center;">${escapeHtml(l.pack || '-')}</td>
      <td style="text-align:center;">${escapeHtml(l.hsn || '-')}</td>
      <td style="text-align:center;font-weight:bold;">${escapeHtml(l.batchNo || '-')}</td>
      <td style="text-align:center;">${formatDate(l.expDate)}</td>
      <td style="text-align:center;font-weight:bold;">${l.qty}</td>
      <td style="text-align:center;">${l.freeQty || 0}</td>
      <td style="text-align:right;">${Number(l.rate || 0).toFixed(2)}</td>
      <td style="text-align:center;">${l.discountPct || 0}%</td>
      <td style="text-align:center;">${l.gstRate || 0}%</td>
      <td style="text-align:right;font-weight:bold;">${Number(l.total || 0).toFixed(2)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Purchase Voucher ${escapeHtml(p.purchaseInvoiceNo || p.id || '')}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #111; margin: 0; padding: 0; }
  .doc-wrap { width: 100%; border: 1.5px solid #222; }
  .header-grid { display: flex; border-bottom: 2px solid #222; }
  .header-box { flex: 1; padding: 8px 10px; }
  .header-box.left { border-right: 1.5px solid #222; }
  .comp-title { font-size: 13px; font-weight: bold; color: #000; }
  .supp-title { font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px; }
  .meta-text { font-size: 9.5px; line-height: 1.35; color: #222; }
  .title-bar { text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 1.5px; padding: 4px 0; border-bottom: 1.5px solid #222; background: #fdfdfd; text-transform: uppercase; }
  .info-bar { display: flex; justify-content: space-between; padding: 5px 8px; font-size: 10px; background: #fafafa; border-bottom: 1.5px solid #222; }
  table.items-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.items-table th, table.items-table td { border: 1px solid #222; padding: 4px 5px; }
  table.items-table th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9.5px; }
  .bottom-grid { display: flex; border-top: 1.5px solid #222; }
  .bottom-col { flex: 1; padding: 6px 8px; border-right: 1px solid #222; font-size: 9.5px; }
  .bottom-col:last-child { border-right: none; flex: 1.1; }
  .tot-line { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ccc; font-size: 10px; }
  .grand-line { font-weight: bold; font-size: 11.5px; border-top: 1.5px solid #222; border-bottom: none; padding-top: 4px; margin-top: 2px; }
  .sig-strip { display: flex; justify-content: space-between; border-top: 1.5px solid #222; padding: 18px 16px 8px; font-size: 9.5px; }
  .sig-box { width: 180px; text-align: center; }
  .sig-line { border-bottom: 1px solid #222; height: 20px; margin-bottom: 4px; }
</style></head>
<body>
  <div class="doc-wrap">
    <div class="title-bar">PURCHASE VOUCHER / INVOICE</div>
    <div class="header-grid">
      <div class="header-box left">
        <div class="comp-title">${escapeHtml(comp.name || 'L LAETUS LIFE SCIENCES')}</div>
        <div class="meta-text">
          ${escapeHtml(comp.addressLine1 || comp.address || '')}<br/>
          ${comp.addressLine2 ? escapeHtml(comp.addressLine2) + '<br/>' : ''}
          GSTIN: ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')} | Phone: ${escapeHtml(comp.phone || '9662031042')}<br/>
          Drug Lic: ${escapeHtml(comp.drugLicence || comp.drugLicenceNo || '')}
        </div>
      </div>
      <div class="header-box">
        <div class="supp-title">SUPPLIER (VENDOR)</div>
        <div class="meta-text">
          <strong>${escapeHtml(supp.partyName || supp.name || p.supplierId || 'N/A')}</strong><br/>
          ${escapeHtml(supp.address || '-')}<br/>
          GSTIN: ${escapeHtml(supp.gstin || '-')} | Phone: ${escapeHtml(supp.phone || '-')}
        </div>
      </div>
    </div>
    <div class="info-bar">
      <div><strong>Voucher No:</strong> ${escapeHtml(p.purchaseInvoiceNo || p.id || '-')}</div>
      <div><strong>Supplier Inv No:</strong> ${escapeHtml(p.supplierInvoiceNo || '-')}</div>
      <div><strong>Date:</strong> ${formatDate(p.purchaseDate)}</div>
      <div><strong>Due Date:</strong> ${formatDate(p.dueDate)}</div>
      <div><strong>Status:</strong> ${escapeHtml(p.status || 'Active')}</div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Product Name</th>
          <th style="width:50px;">Pack</th>
          <th style="width:55px;">HSN</th>
          <th style="width:65px;">Batch No</th>
          <th style="width:65px;">Exp Date</th>
          <th style="width:40px;">Qty</th>
          <th style="width:35px;">Free</th>
          <th style="width:65px;">Rate</th>
          <th style="width:45px;">Disc</th>
          <th style="width:45px;">GST</th>
          <th style="width:80px;">Total (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="bottom-grid">
      <div class="bottom-col">
        <strong>Tax Summary</strong>
        <div class="tot-line"><span>Taxable Amount:</span><span>${formatCurrency(p.taxableTotal)}</span></div>
        <div class="tot-line"><span>CGST Total:</span><span>${formatCurrency(p.cgstTotal)}</span></div>
        <div class="tot-line"><span>SGST Total:</span><span>${formatCurrency(p.sgstTotal)}</span></div>
        <div class="tot-line"><span>IGST Total:</span><span>${formatCurrency(p.igstTotal)}</span></div>
      </div>
      <div class="bottom-col">
        <strong>Payment Summary</strong>
        <div class="tot-line"><span>Gross Total:</span><span>${formatCurrency(p.grossTotal)}</span></div>
        <div class="tot-line"><span>Discount Total:</span><span>-${formatCurrency(p.discountTotal)}</span></div>
        <div class="tot-line"><span>Amount Paid:</span><span>${formatCurrency(p.amountPaid)}</span></div>
        <div class="tot-line grand-line"><span>Grand Total:</span><span>${formatCurrency(p.grandTotal)}</span></div>
      </div>
    </div>

    <div class="sig-strip">
      <div>Prepared By: ${escapeHtml(p.createdBy || 'System')}</div>
      <div class="sig-box"><div class="sig-line"></div>Authorized Signatory</div>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderPurchaseHtml };
