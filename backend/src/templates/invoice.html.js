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

  // Terms: use saved company terms, fall back to standard pharmaceutical terms
  const terms = Array.isArray(comp.terms) && comp.terms.length > 0
    ? comp.terms
    : [
        'Goods once sold will not be taken back or exchanged.',
        'Bills not paid due date will attract 24% interest.',
        'All disputes subject to Surat jurisdiction only.',
        'Prescribed Sales Tax declaration will be given.',
      ];

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
    <tr class="${i % 2 === 1 ? 'row-alt' : ''}">
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

  // Drug licence: only show when a real value is saved — never emit a XXXX placeholder
  const drugLicenceLine = comp.drugLicence && comp.drugLicence.trim()
    ? `<strong>D.L. No.:</strong> ${escapeHtml(comp.drugLicence)}<br/>`
    : '';

  // Bank details: use saved values, show nothing if empty (not fake placeholders)
  const bankName = (comp.bank && comp.bank.bankName) ? comp.bank.bankName : '';
  const bankAcct = (comp.bank && comp.bank.accountNumber) ? comp.bank.accountNumber : '';
  const bankIfsc = (comp.bank && comp.bank.ifsc) ? comp.bank.ifsc : '';
  const bankBlock = bankName
    ? `<strong>${escapeHtml(bankName.toUpperCase())}</strong><br/>
       ${bankAcct ? `A/C NO: ${escapeHtml(bankAcct)}<br/>` : ''}
       ${bankIfsc ? `IFSC CODE: ${escapeHtml(bankIfsc)}` : ''}`
    : '<em style="color:#888;">Bank details not configured</em>';

  // Terms block from saved company data
  const termsHtml = terms.map((t, i) => `${i + 1}. ${escapeHtml(t)}`).join('<br/>');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Invoice ${escapeHtml(s.invoiceNo || s.id || '')}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; padding: 0; background: #fff; }

  /* ── Outer wrapper ── */
  .doc-wrap { width: 100%; border: 1.5px solid #2c2c2c; }

  /* ── Header: company left / customer right ── */
  .header-grid { display: flex; border-bottom: 2px solid #2c2c2c; }
  .header-box { flex: 1; padding: 8px 10px; }
  .header-box.left { border-right: 1.5px solid #2c2c2c; }
  .comp-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; padding-bottom: 4px; border-bottom: 1px solid #d4a84b33; }
  .logo-badge { width: 28px; height: 28px; background: linear-gradient(135deg, #c8963c, #e8c06a); color: #1a1a1a; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; flex-shrink: 0; }
  .comp-title { font-size: 13px; font-weight: 800; color: #111; letter-spacing: 0.02em; }
  .cust-title { font-size: 12px; font-weight: 700; color: #111; margin-bottom: 4px; }
  .meta-text { font-size: 9.5px; line-height: 1.5; color: #2a2a2a; }

  /* ── GST Invoice title strip ── */
  .title-bar {
    text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 2px;
    padding: 4px 0; border-bottom: 1.5px solid #2c2c2c;
    background: linear-gradient(90deg, #f5edd8 0%, #fdf8ee 40%, #f5edd8 100%);
    color: #7a5c1e;
  }

  /* ── Invoice info bar ── */
  .info-bar {
    display: flex; justify-content: space-between; padding: 4px 10px;
    font-size: 10px; background: #fafafa; border-bottom: 1.5px solid #2c2c2c;
  }

  /* ── Line items table ── */
  table.items-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.items-table th, table.items-table td { border: 1px solid #c0c0c0; padding: 3px 4px; }
  table.items-table th {
    background: linear-gradient(180deg, #2c2c2c 0%, #1a1a1a 100%);
    color: #f0d98a;
    font-weight: 700; text-align: center; font-size: 9.5px; letter-spacing: 0.03em;
  }
  table.items-table tr.row-alt td { background: #f9f6ef; }

  /* ── Bottom 3-column grid ── */
  .bottom-grid { display: flex; border-top: 1.5px solid #2c2c2c; }
  .bottom-col { flex: 1; padding: 6px 8px; border-right: 1px solid #c0c0c0; font-size: 9.5px; }
  .bottom-col:last-child { border-right: none; flex: 1.1; }
  .box-head {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    color: #7a5c1e; border-bottom: 1px solid #d4a84b55; padding-bottom: 2px; margin-bottom: 4px;
    letter-spacing: 0.04em;
  }

  /* ── GST summary table ── */
  table.gst-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 3px; }
  table.gst-table th, table.gst-table td { border: 1px solid #c0c0c0; padding: 2px 4px; }
  table.gst-table th { background: #f5edd8; text-align: center; font-weight: 700; color: #5a3e10; }

  /* ── Totals column ── */
  .tot-line { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #d0d0d0; font-size: 10px; }
  .grand-line {
    font-weight: 800; font-size: 12px; color: #fff;
    background: linear-gradient(90deg, #2c2c2c, #1a1a1a);
    padding: 4px 6px; margin: 4px -8px -6px;
    border-top: none; border-bottom: none;
    display: flex; justify-content: space-between;
  }

  /* ── Signature strip ── */
  .sig-strip { display: flex; justify-content: space-between; border-top: 1.5px solid #2c2c2c; padding: 18px 16px 8px; font-size: 9.5px; }
  .sig-box { width: 180px; text-align: center; }
  .sig-line { border-bottom: 1px solid #555; height: 22px; margin-bottom: 4px; }
</style></head>
<body>
  <div class="doc-wrap">
    <div class="header-grid">
      <div class="header-box left">
        <div class="comp-brand">
          ${comp.logo ? `<img src="${comp.logo}" style="max-height:30px;max-width:80px;object-fit:contain;" />` : `<div class="logo-badge">${escapeHtml(comp.name ? comp.name.split(' ').map(w => w[0]).join('').slice(0, 3) : 'LLS')}</div>`}
          <div class="comp-title">${escapeHtml(comp.name || 'L LAETUS LIFE SCIENCES')}</div>
        </div>
        <div class="meta-text">
          ${escapeHtml(comp.addressLine1 || '')}<br/>
          ${escapeHtml(comp.addressLine2 || '')}<br/>
          <strong>Phone:</strong> ${escapeHtml(comp.phone || '')}<br/>
          ${drugLicenceLine}
          <strong>E-Mail:</strong> ${escapeHtml(comp.email || '')}<br/>
          <strong>GSTIN:</strong> ${escapeHtml(comp.gstin || '')}
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

    <div class="title-bar">GST INVOICE</div>

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
          ${bankBlock}
        </div>
        <div class="meta-text" style="margin-top:5px;border-top:1px dashed #c8a848;padding-top:3px;">
          <strong>LEDGER BALANCE:</strong> Rs. ${Number(cust.currentBalance || 0).toFixed(2)}
        </div>
        <div class="box-head" style="margin-top:7px;">Terms &amp; Conditions</div>
        <div class="meta-text" style="font-size:8.5px;line-height:1.4;">
          ${termsHtml}
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
        <div class="meta-text" style="margin-top:8px;border-top:1px solid #c8a848;padding-top:2px;">
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
        <div style="font-weight:bold;margin-bottom:8px;">${escapeHtml(comp.signatoryLabel || 'for L LAETUS LIFE SCIENCES')}</div>
        <div class="sig-line"></div>
        <div>Authorized Signatory</div>
      </div>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderInvoiceHtml };
