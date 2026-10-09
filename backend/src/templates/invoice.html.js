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
      rate: `${rate.toFixed(2)} %`,
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
      <td style="text-align:center;">${escapeHtml(l.mfg || '-')}</td>
      <td style="text-align:center;font-weight:bold;">${l.qty}</td>
      <td style="text-align:center;">${escapeHtml(l.pack || '-')}</td>
      <td style="text-align:center;">${escapeHtml(l.batchNo || l.batchId || '-')}</td>
      <td style="text-align:center;">${formatDate(l.expDate)}</td>
      <td style="text-align:center;">${escapeHtml(l.hsn || '-')}</td>
      <td style="text-align:right;">${Number(l.mrp !== undefined ? l.mrp : l.rate).toFixed(2)}</td>
      <td style="text-align:right;">${Number(l.rate).toFixed(2)}</td>
      <td style="text-align:center;">${Number(l.discountPct || 0).toFixed(2)}</td>
      ${sameState
        ? `<td style="text-align:right;">${Number(l.sgst || 0).toFixed(2)}</td><td style="text-align:right;">${Number(l.cgst || 0).toFixed(2)}</td>`
        : `<td style="text-align:right;">${Number(l.igst || 0).toFixed(2)}</td>`}
      <td style="text-align:right;font-weight:bold;">${Number(l.total || 0).toFixed(2)}</td>
    </tr>`;
  }).join('');

  // Filler empty rows for clean tall grid PDF
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - lines.length);
  const emptyRowsHtml = Array.from({ length: emptyRowsCount }).map(() => `
    <tr class="empty-row">
      <td>&nbsp;</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      ${sameState ? '<td></td><td></td>' : '<td></td>'}
      <td></td>
    </tr>`).join('');

  const gstRows = gstSummary.map((sum) => `
    <tr>
      <td style="text-align:center;">${sum.rate}</td>
      <td style="text-align:right;">${sum.amount.toFixed(2)}</td>
      ${sameState
        ? `<td style="text-align:right;">${sum.cgst.toFixed(2)}</td><td style="text-align:right;">${sum.sgst.toFixed(2)}</td>`
        : `<td style="text-align:right;">${sum.igst.toFixed(2)}</td>`}
      <td style="text-align:right;">${sum.total.toFixed(2)}</td>
    </tr>`).join('');

  const drugLicenceLine = comp.drugLicence && comp.drugLicence.trim()
    ? `<div>D.L. No. : ${escapeHtml(comp.drugLicence)}</div>`
    : '';

  const bankName = (comp.bank && comp.bank.bankName) ? comp.bank.bankName : '';
  const bankAcct = (comp.bank && comp.bank.accountNumber) ? comp.bank.accountNumber : '';
  const bankIfsc = (comp.bank && comp.bank.ifsc) ? comp.bank.ifsc : '';
  const bankBlock = bankName
    ? `<div><strong>${escapeHtml(bankName.toUpperCase())}</strong></div>
       ${bankAcct ? `<div>A/C NO-${escapeHtml(bankAcct)}</div>` : ''}
       ${bankIfsc ? `<div>IFSC CODE-${escapeHtml(bankIfsc)}</div>` : ''}`
    : '<div style="color:#777;font-style:italic;">Bank details not configured</div>';

  const termsHtml = terms.map((t, i) => `<li>${escapeHtml(t)}</li>`).join('');

  const grossBeforeDiscount = s.grossTotal || lines.reduce((a, l) => a + (l.gross || (Number(l.qty) * Number(l.rate))), 0);
  const discountTotal = s.discountTotal || 0;
  const sgstTotal = s.sgstTotal || 0;
  const cgstTotal = s.cgstTotal || 0;
  const igstTotal = s.igstTotal || 0;
  const courier = Number(s.courierCharge || 0);
  const grandTotal = s.grandTotal || 0;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Invoice ${escapeHtml(s.invoiceNo || s.id || '')}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9.5px; color: #111111; margin: 0; padding: 0; background: #fff; }

  /* ── Outer wrapper ── */
  .doc-wrap { width: 100%; border: 1.5px solid #222222; }

  /* ── Header: company left / customer right ── */
  .header-grid { display: flex; border-bottom: 1.5px solid #222222; }
  .header-box { flex: 1; padding: 6px 10px; }
  .header-box.left { border-right: 1.5px solid #222222; }
  .comp-title { font-size: 13px; font-weight: 800; color: #000000; text-transform: uppercase; margin-bottom: 3px; letter-spacing: 0.02em; }
  .cust-title { font-size: 12px; font-weight: 800; color: #000000; margin-bottom: 3px; }
  .meta-text { font-size: 9.5px; line-height: 1.35; color: #111111; }
  .comp-divider { border-bottom: 1px solid #ccc; margin: 4px 0; }

  /* ── GST Invoice title strip ── */
  .title-bar {
    display: flex; align-items: center; border-bottom: 1.5px solid #222222; background: #fdfdfd;
  }
  .title-badge-wrap { flex: 0 0 42%; display: flex; justify-content: center; padding: 4px 8px; }
  .gst-badge {
    background: #dbe5ed; border: 1.5px solid #222222; padding: 3px 18px;
    font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: #000000; text-transform: uppercase;
  }

  /* ── Invoice info bar ── */
  .info-bar {
    flex: 1; display: grid; grid-template-columns: 1.3fr 1fr; grid-gap: 2px 12px;
    padding: 4px 10px; font-size: 9.5px; border-left: 1.5px solid #222222; background: #fafafa;
  }

  /* ── Line items table ── */
  table.items-table { width: 100%; border-collapse: collapse; font-size: 9.5px; border-bottom: 1.5px solid #222222; }
  table.items-table th, table.items-table td { border: 1px solid #333333; padding: 3px 4px; color: #111111; }
  table.items-table th { background: #dbe5ed; color: #000000; font-weight: 800; text-align: center; font-size: 9.5px; }
  .empty-row td { height: 18px; background: transparent !important; }

  /* ── Bottom 3-column grid ── */
  .bottom-grid { display: flex; border-bottom: 1.5px solid #222222; }
  .bottom-col { flex: 1; padding: 5px 6px; border-right: 1px solid #222222; font-size: 9px; }
  .bottom-col:last-child { border-right: none; flex: 1.1; }
  .box-head-bold { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #000000; margin-bottom: 2px; }

  /* ── GST summary table ── */
  table.gst-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.gst-table th, table.gst-table td { border: 1px solid #333333; padding: 2px 3px; }
  table.gst-table th { background: #dbe5ed; color: #000000; text-align: center; font-weight: 800; }

  /* ── Totals column ── */
  .tot-line { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #bbb; font-size: 9.5px; }
  .grand-line {
    font-weight: 900; font-size: 11.5px; color: #000000;
    border-top: 1.5px solid #222222; border-bottom: 1.5px solid #222222;
    padding: 3px 0; margin-top: 3px; display: flex; justify-content: space-between;
  }
  .amount-words-box {
    margin-top: 5px; font-size: 8.5px; font-style: italic; text-align: right;
    border: 1px solid #999999; padding: 2px 4px; background: #fafafa;
  }

  /* ── Signature strip ── */
  .sig-strip { display: flex; justify-content: space-between; padding: 12px 14px 6px; font-size: 9.5px; }
  .sig-box { width: 180px; }
  .sig-box.left-sig { text-align: left; }
  .sig-box.right-sig { text-align: right; }
  .sig-title { font-weight: 800; margin-bottom: 16px; }
  .sig-space { height: 16px; }
</style></head>
<body>
  <div class="doc-wrap">
    <div class="header-grid">
      <div class="header-box left">
        <div class="comp-title">${escapeHtml(comp.name || 'LAETUS LIFE SCIENCES')}</div>
        <div class="meta-text">
          ${escapeHtml(comp.addressLine1 || '')}<br/>
          ${escapeHtml(comp.addressLine2 || '')}<br/>
          Phone : ${escapeHtml(comp.phone || '0261-2345678')}
        </div>
        <div class="comp-divider"></div>
        <div class="meta-text">
          GSTIN : ${escapeHtml(comp.gstin || '-')}<br/>
          ${comp.email ? `Email : ${escapeHtml(comp.email)}<br/>` : ''}
          ${comp.website ? `Website : ${escapeHtml(comp.website)}<br/>` : ''}
          ${drugLicenceLine}
        </div>
      </div>
      <div class="header-box">
        <div class="cust-title">M/s ${escapeHtml(cust.partyName || 'CASH SALE')}</div>
        <div class="meta-text">
          ${escapeHtml(cust.address || 'Address: N/A')}<br/>
          ${escapeHtml(cust.city || '')}${cust.state ? `, ${escapeHtml(cust.state)}` : ''}<br/>
          Ph No: ${escapeHtml(cust.phone || cust.mobile || '-')}<br/>
          GST: ${escapeHtml(cust.gstin || '-')}<br/>
          ${cust.drugLicence ? `D.L. No.: ${escapeHtml(cust.drugLicence)}` : ''}
        </div>
      </div>
    </div>

    <div class="title-bar">
      <div class="title-badge-wrap">
        <div class="gst-badge">GST INVOICE</div>
      </div>
      <div class="info-bar">
        <div><span>Invoice No. :</span> <strong>${escapeHtml(s.invoiceNo || s.id || '')}</strong></div>
        <div><span>Date :</span> <span>${formatDate(s.date)}</span></div>
        <div><span>Sales Man :</span> <span>${escapeHtml(s.salesman || '-')}</span></div>
        <div><span>Due Date :</span> <span>${formatDate(s.dueDate || s.date)}</span></div>
      </div>
    </div>

    <table class="items-table">
      <thead><tr>
        <th style="width:4%">Sr.</th>
        <th style="width:22%">Product</th>
        <th style="width:8%">Mfg.</th>
        <th style="width:5%">Qty.</th>
        <th style="width:7%">Pack</th>
        <th style="width:9%">Batch</th>
        <th style="width:6%">Exp.</th>
        <th style="width:8%">HSN</th>
        <th style="width:7%">MRP</th>
        <th style="width:7%">Rate</th>
        <th style="width:4%">Dis</th>
        ${sameState ? '<th style="width:5%">SGST</th><th style="width:5%">CGST</th>' : '<th style="width:10%">IGST</th>'}
        <th style="width:9%">Amount</th>
      </tr></thead>
      <tbody>
        ${rows}
        ${emptyRowsHtml}
      </tbody>
    </table>

    <div class="bottom-grid">
      <div class="bottom-col">
        <div class="box-head-bold">BANK DETAIL:</div>
        <div class="meta-text">
          ${bankBlock}
        </div>
        <div class="meta-text" style="margin-top:4px;border-top:1px solid #222;border-bottom:1px solid #222;padding:2px 0;">
          <strong>LEDGER BALANCE :</strong> Rs. ${Number(cust.currentBalance || 0).toFixed(2)}
        </div>
        <div style="margin-top:4px;font-size:9px;font-weight:800;text-decoration:underline;">Terms &amp; Conditions:</div>
        <ol style="font-size:8.5px;line-height:1.3;margin:0;padding-left:12px;">
          ${termsHtml}
        </ol>
        <div style="margin-top:4px;font-size:8.5px;font-weight:800;text-align:center;border:1px solid #ccc;padding:1px 0;">Scan &amp; Pay</div>
      </div>

      <div class="bottom-col">
        <table class="gst-table">
          <thead><tr>
            <th>GST</th><th>Amount</th>
            ${sameState ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}
            <th>TOTAL</th>
          </tr></thead>
          <tbody>${gstRows}</tbody>
        </table>
      </div>

      <div class="bottom-col">
        <div class="tot-line"><span>AMOUNT BEFORE TAX</span><span>${Number(grossBeforeDiscount).toFixed(2)}</span></div>
        <div class="tot-line"><span>DISCOUNT :</span><span>${Number(discountTotal).toFixed(2)}</span></div>
        ${sameState
          ? `<div class="tot-line"><span>SGST PAYBLE</span><span>${Number(sgstTotal).toFixed(2)}</span></div><div class="tot-line"><span>CGST PAYBLE</span><span>${Number(cgstTotal).toFixed(2)}</span></div>`
          : `<div class="tot-line"><span>IGST PAYBLE</span><span>${Number(igstTotal).toFixed(2)}</span></div>`}
        <div class="tot-line"><span>COURIER CHR</span><span>${Number(courier).toFixed(2)}</span></div>
        <div class="tot-line grand-line"><span>GRAND TOTAL</span><span>${Number(grandTotal).toFixed(2)}</span></div>
        <div class="amount-words-box">
          Rs. ${Number(grandTotal).toFixed(2)} Only
        </div>
      </div>
    </div>

    <div class="sig-strip">
      <div class="sig-box left-sig">
        <div class="sig-title">Receiver</div>
        <div class="sig-space"></div>
      </div>
      <div class="sig-box right-sig">
        <div class="sig-title">For ${escapeHtml(comp.name || 'LAETUS LIFE SCIENCES')}</div>
        <div class="sig-space"></div>
        <div style="font-size:8.5px;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderInvoiceHtml };
