const dayjs = require('dayjs');

function formatCurrency(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d) { return d ? dayjs(d).format('DD-MM-YYYY') : '-'; }

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderInvoiceHtml({ company, customer, sale }) {
  const comp = company || {};
  const cust = customer || {};
  const s = sale || {};

  const sameState = !s.isInterState;
  const lines = s.lines || [];

  const standardRates = [5, 12, 18, 28];
  const gstSummary = standardRates.map((rate) => {
    const matching = lines.filter((l) => Math.abs(Number(l.gstRate || 0) - rate) < 0.1);
    const taxableAmt = matching.reduce((sum, l) => sum + Number(l.taxableValue || 0), 0);
    const cTax = matching.reduce((sum, l) => sum + Number(l.cgst || 0), 0);
    const sTax = matching.reduce((sum, l) => sum + Number(l.sgst || 0), 0);
    const iTax = matching.reduce((sum, l) => sum + Number(l.igst || 0), 0);
    const totalTax = sameState ? (cTax + sTax) : iTax;
    return {
      rate: `${rate.toFixed(2)}%`,
      amount: taxableAmt,
      cgst: cTax,
      sgst: sTax,
      igst: iTax,
      total: totalTax,
    };
  });

  const rows = lines.map((l, i) => {
    const halfGstRate = Number(l.gstRate || 0) / 2;
    return `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td style="text-align:left;font-weight:bold;">${escapeHtml(l.productName || l.productId)}</td>
      <td style="text-align:center;">${escapeHtml(l.pack || '-')}</td>
      <td style="text-align:center;">${escapeHtml(l.mfg || '-')}</td>
      <td style="text-align:center;font-weight:bold;">${l.qty}</td>
      <td style="text-align:center;">${l.freeQty || 0}</td>
      <td style="text-align:center;">${escapeHtml(l.batchNo || l.batchId || '-')}</td>
      <td style="text-align:center;">${formatDate(l.expDate)}</td>
      <td style="text-align:center;">${escapeHtml(l.hsn || '-')}</td>
      <td style="text-align:right;">${Number(l.mrp !== undefined ? l.mrp : l.rate).toFixed(2)}</td>
      <td style="text-align:right;">${Number(l.rate).toFixed(2)}</td>
      <td style="text-align:center;">${l.discountPct || 0}</td>
      ${sameState
        ? `<td style="text-align:center;">${halfGstRate}%</td><td style="text-align:right;">${Number(l.sgst || 0).toFixed(2)}</td><td style="text-align:center;">${halfGstRate}%</td><td style="text-align:right;">${Number(l.cgst || 0).toFixed(2)}</td>`
        : `<td style="text-align:center;">${l.gstRate || 0}%</td><td style="text-align:right;">${Number(l.igst || 0).toFixed(2)}</td>`}
      <td style="text-align:right;font-weight:bold;">${Number(l.total || 0).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const gstRows = gstSummary.map((sum) => `
    <tr>
      <td style="text-align:center;">${sum.rate}</td>
      <td style="text-align:right;">${sum.amount.toFixed(2)}</td>
      ${sameState
        ? `<td style="text-align:right;">${sum.cgst.toFixed(2)}</td><td style="text-align:right;">${sum.sgst.toFixed(2)}</td>`
        : `<td style="text-align:right;">${sum.igst.toFixed(2)}</td>`}
      <td style="text-align:right;">${sum.total.toFixed(2)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Invoice ${escapeHtml(s.invoiceNo || s.id || '')}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #111; margin: 0; padding: 0; }
  .doc-wrap { width: 100%; border: 1.5px solid #222; }
  .header-grid { display: flex; border-bottom: 2px solid #222; }
  .header-box { flex: 1; padding: 8px 10px; }
  .header-box.left { border-right: 1.5px solid #222; }
  .comp-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .logo-badge { width: 26px; height: 26px; background: #0284c7; color: #fff; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; }
  .comp-title { font-size: 13px; font-weight: bold; color: #000; }
  .cust-title { font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px; }
  .meta-text { font-size: 9.5px; line-height: 1.35; color: #222; }
  .title-bar { text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 1.5px; padding: 3px 0; border-bottom: 1.5px solid #222; background: #fdfdfd; }
  .info-bar { display: flex; justify-content: space-between; padding: 4px 8px; font-size: 10px; background: #fafafa; border-bottom: 1.5px solid #222; }
  table.items-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.items-table th, table.items-table td { border: 1px solid #222; padding: 3px 4px; }
  table.items-table th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9.5px; }
  .bottom-grid { display: flex; border-top: 1.5px solid #222; }
  .bottom-col { flex: 1; padding: 6px 8px; border-right: 1px solid #222; font-size: 9.5px; }
  .bottom-col:last-child { border-right: none; flex: 1.1; }
  .box-head { font-size: 9.5px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #444; padding-bottom: 2px; margin-bottom: 3px; }
  table.gst-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 3px; }
  table.gst-table th, table.gst-table td { border: 1px solid #444; padding: 2px 4px; }
  table.gst-table th { background: #eaeaea; text-align: center; }
  .tot-line { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ccc; font-size: 10px; }
  .grand-line { font-weight: bold; font-size: 11.5px; border-top: 1.5px solid #222; border-bottom: none; padding-top: 4px; margin-top: 2px; }
  .sig-strip { display: flex; justify-content: space-between; border-top: 1.5px solid #222; padding: 18px 16px 8px; font-size: 9.5px; }
  .sig-box { width: 180px; text-align: center; }
  .sig-line { border-bottom: 1px solid #222; height: 20px; margin-bottom: 4px; }
</style></head>
<body>
  <div class="doc-wrap">
    <div class="header-grid">
      <div class="header-box left">
        <div class="comp-brand">
          ${comp.logo ? `<img src="${comp.logo}" style="max-height:32px;max-width:90px;object-fit:contain;" />` : `<div class="logo-badge">${escapeHtml(comp.name ? comp.name.split(' ').map(w => w[0]).join('').slice(0, 3) : 'LLS')}</div>`}
          <div class="comp-title">${escapeHtml(comp.name || 'L LAETUS LIFE SCIENCES')}</div>
        </div>

        <div class="meta-text">
          ${escapeHtml(comp.addressLine1 || '1st Floor, 249 Sukhinagar 24-GUJARAT')}<br/>
          ${escapeHtml(comp.addressLine2 || 'Bamroli Gam Road, Pandesara, Surat-394221')}<br/>
          <strong>Phone:</strong> ${escapeHtml(comp.phone || '9662031042')}<br/>
          <strong>D.L. No.:</strong> ${escapeHtml(comp.drugLicence || 'GJ-SUR-20-244992/21-244993')}<br/>
          <strong>E-Mail:</strong> ${escapeHtml(comp.email || 'LAETUSLIFESCIENCES@GMAIL.COM')}<br/>
          <strong>GSTIN:</strong> ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')}
        </div>
      </div>
      <div class="header-box">
        <div class="cust-title">M/s ${escapeHtml(cust.partyName || 'CASH SALE')}</div>
        <div class="meta-text">
          ${escapeHtml(cust.address || 'Address: N/A')}<br/>
          ${escapeHtml(cust.city || '')}${cust.state ? `, ${escapeHtml(cust.state)}` : ''}<br/>
          <strong>Ph. No.:</strong> ${escapeHtml(cust.phone || cust.mobile || '-')}<br/>
          <strong>GSTIN:</strong> ${escapeHtml(cust.gstin || '-')} &nbsp; <strong>D.L. No.:</strong> ${escapeHtml(cust.drugLicence || '-')}
        </div>
      </div>
    </div>

    <div class="title-bar">TAX INVOICE</div>

    <div class="info-bar">
      <div><strong>Sales Man:</strong> ${escapeHtml(s.salesman || '-')}</div>
      <div><strong>Invoice No.:</strong> <strong>${escapeHtml(s.invoiceNo || s.id || '')}</strong></div>
      <div><strong>Invoice Date:</strong> ${formatDate(s.date)}</div>
      <div><strong>Due Date:</strong> ${formatDate(s.dueDate || s.date)}</div>
    </div>

    <table class="items-table">
      <thead><tr>
        <th style="width:3%">Sr.</th>
        <th style="width:20%">Product</th>
        <th style="width:8%">Packing</th>
        <th style="width:7%">Mfg</th>
        <th style="width:5%">Qty</th>
        <th style="width:5%">Free</th>
        <th style="width:8%">Batch</th>
        <th style="width:7%">Exp</th>
        <th style="width:7%">HSN</th>
        <th style="width:6%">MRP</th>
        <th style="width:6%">PTR/Rate</th>
        <th style="width:5%">Dis%</th>
        ${sameState ? '<th style="width:4%">SGST%</th><th style="width:5%">SGST</th><th style="width:4%">CGST%</th><th style="width:5%">CGST</th>' : '<th style="width:5%">IGST%</th><th style="width:6%">IGST</th>'}
        <th style="width:8%">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="bottom-grid">
      <div class="bottom-col">
        <div class="box-head">BANK DETAILS:</div>
        <div class="meta-text">
          <strong>${escapeHtml(comp.bank?.bankName || 'HDFC BANK LTD')}</strong><br/>
          A/C NO: ${escapeHtml(comp.bank?.accountNumber || '00000000000000')}<br/>
          IFSC CODE: ${escapeHtml(comp.bank?.ifsc || 'HDFC0000000')}
        </div>
        <div class="meta-text" style="margin-top:4px;border-top:1px dashed #666;padding-top:2px;">
          <strong>LEDGER BALANCE:</strong> Rs. ${Number(cust.currentBalance || 0).toFixed(2)}
        </div>
        <div class="box-head" style="margin-top:6px;">Terms &amp; Conditions</div>
        <div class="meta-text" style="font-size:8.5px;line-height:1.3;">
          1. Goods once sold will not be taken back or exchanged.<br/>
          2. Bills not paid due date will attract 24% interest.<br/>
          3. All disputes subject to Surat jurisdiction only.<br/>
          4. Prescribed Sales Tax declaration will be given.
        </div>
      </div>

      <div class="bottom-col">
        <div class="box-head" style="text-align:center;">GST SUMMARY</div>
        <table class="gst-table">
          <thead><tr>
            <th>GST Rate</th><th>Taxable</th>
            ${sameState ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}
            <th>TOTAL</th>
          </tr></thead>
          <tbody>${gstRows}</tbody>
        </table>
      </div>

      <div class="bottom-col">
        <div class="tot-line"><span>AMOUNT BEFORE TAX</span><span>${formatCurrency(s.grossTotal || ((s.taxableTotal || 0) + (s.discountTotal || 0)))}</span></div>
        <div class="tot-line"><span>DISCOUNT</span><span>${formatCurrency(s.discountTotal || 0)}</span></div>
        <div class="tot-line"><span>TAXABLE TOTAL</span><span>${formatCurrency(s.taxableTotal || 0)}</span></div>
        ${sameState
          ? `<div class="tot-line"><span>SGST PAYABLE</span><span>${formatCurrency(s.sgstTotal || 0)}</span></div><div class="tot-line"><span>CGST PAYABLE</span><span>${formatCurrency(s.cgstTotal || 0)}</span></div>`
          : `<div class="tot-line"><span>IGST PAYABLE</span><span>${formatCurrency(s.igstTotal || 0)}</span></div>`}
        ${s.courierCharge ? `<div class="tot-line"><span>COURIER / OTHER</span><span>${formatCurrency(s.courierCharge)}</span></div>` : ''}
        <div class="tot-line grand-line"><span>GRAND TOTAL</span><span>${formatCurrency(s.grandTotal || 0)}</span></div>
        <div class="meta-text" style="margin-top:6px;border-top:1px solid #444;padding-top:2px;">
          <strong>Amount in Words:</strong> Rupees ${Number(s.grandTotal || 0).toFixed(2)} Only
        </div>
      </div>
    </div>

    <div class="sig-strip">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div>Receiver Signature &amp; Stamp</div>
      </div>
      <div class="sig-box">
        <div style="font-weight:bold;margin-bottom:8px;">${escapeHtml(comp.signatoryLabel || 'For L LAETUS LIFE SCIENCES')}</div>
        <div class="sig-line"></div>
        <div>Authorized Signatory</div>
      </div>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderInvoiceHtml };
