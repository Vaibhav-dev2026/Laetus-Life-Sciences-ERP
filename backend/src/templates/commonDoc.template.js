const dayjs = require('dayjs');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(val) {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderCommonDocHtml({
  docTitle = 'ERP DOCUMENT',
  subtitle = '',
  company = {},
  metaFields = [],
  columns = [],
  rows = [],
  summaryRows = [],
  grandTotal = null,
  taxBreakup = null,
  notes = '',
  orientation = 'portrait',
}) {
  const comp = {
    name: company.name || 'L LAETUS LIFE SCIENCES',
    address: company.address || [company.addressLine1, company.addressLine2].filter(Boolean).join(', '),
    gstin: company.gstin || '',
    state: company.state || 'Gujarat',
    stateCode: company.stateCode || '24',
    phone: company.phone || '9662031042',
    email: company.email || '',
  };

  const isLandscape = orientation === 'landscape';
  const generatedAt = dayjs().format('DD-MM-YYYY HH:mm:ss');

  const metaHtml = metaFields.map(f => `
    <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:10px;">
      <span style="color:#64748b; font-weight:500;">${escapeHtml(f.label)}:</span>
      <span style="color:#0f172a; font-weight:600; text-align:right;">${escapeHtml(f.value)}</span>
    </div>
  `).join('');

  const thsHtml = columns.map(col => {
    const align = col.align || (col.isNumeric ? 'right' : col.isCenter ? 'center' : 'left');
    const width = col.width ? `width:${col.width};` : '';
    return `<th style="text-align:${align}; ${width}">${escapeHtml(col.label)}</th>`;
  }).join('');

  const trsHtml = rows.map((r, i) => {
    const tdsHtml = columns.map(col => {
      const val = r[col.key] !== undefined ? r[col.key] : '';
      const align = col.align || (col.isNumeric ? 'right' : col.isCenter ? 'center' : 'left');
      const formattedVal = col.isMoney && typeof val === 'number' ? formatMoney(val) : escapeHtml(val);
      return `<td style="text-align:${align};">${formattedVal}</td>`;
    }).join('');
    const bgStyle = i % 2 === 1 ? 'background-color:#f8fafc;' : '';
    return `<tr style="${bgStyle}"><td style="text-align:center; color:#64748b;">${i + 1}</td>${tdsHtml}</tr>`;
  }).join('');

  const emptyHtml = `<tr><td colspan="${columns.length + 1}" style="text-align:center; padding:16px; color:#64748b; font-style:italic;">No transactions found for the selected period.</td></tr>`;

  let taxBreakupHtml = '';
  if (taxBreakup) {
    taxBreakupHtml = `
      <div style="margin-top:12px; border:1px solid #cbd5e1; border-radius:4px; padding:8px 12px; background:#f8fafc;">
        <div style="font-size:10px; font-weight:700; color:#0f172a; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">GST Tax Breakup Summary</div>
        <div style="display:flex; justify-content:space-between; font-size:9.5px; color:#334155; margin-bottom:2px;">
          <span>Taxable Amount:</span><strong>${formatMoney(taxBreakup.taxable)}</strong>
        </div>
        ${taxBreakup.cgst ? `<div style="display:flex; justify-content:space-between; font-size:9.5px; color:#334155; margin-bottom:2px;"><span>CGST:</span><strong>${formatMoney(taxBreakup.cgst)}</strong></div>` : ''}
        ${taxBreakup.sgst ? `<div style="display:flex; justify-content:space-between; font-size:9.5px; color:#334155; margin-bottom:2px;"><span>SGST:</span><strong>${formatMoney(taxBreakup.sgst)}</strong></div>` : ''}
        ${taxBreakup.igst ? `<div style="display:flex; justify-content:space-between; font-size:9.5px; color:#334155; margin-bottom:2px;"><span>IGST:</span><strong>${formatMoney(taxBreakup.igst)}</strong></div>` : ''}
        <div style="display:flex; justify-content:space-between; font-size:10.5px; font-weight:700; color:#0f172a; border-top:1px solid #cbd5e1; margin-top:4px; padding-top:4px;">
          <span>Total Tax Amount:</span><strong>${formatMoney(taxBreakup.totalTax)}</strong>
        </div>
      </div>
    `;
  }

  let summaryBoxHtml = '';
  if (summaryRows.length > 0 || grandTotal !== null) {
    const summaryLines = summaryRows.map(sr => `
      <div style="display:flex; justify-content:space-between; margin-bottom:3px; font-size:10px;">
        <span style="color:#475569;">${escapeHtml(sr.label)}:</span>
        <span style="font-weight:600; color:#0f172a;">${typeof sr.value === 'number' ? formatMoney(sr.value) : escapeHtml(sr.value)}</span>
      </div>
    `).join('');

    const grandTotalLine = grandTotal !== null ? `
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:800; color:#0f172a; border-top:2px solid #0f172a; border-bottom:2px solid #0f172a; padding:6px 0; margin-top:6px;">
        <span>GRAND TOTAL:</span>
        <span style="color:#b45309;">${formatMoney(grandTotal)}</span>
      </div>
    ` : '';

    summaryBoxHtml = `
      <div style="width:280px; margin-left:auto; border:1px solid #cbd5e1; border-radius:4px; padding:10px; background:#fff;">
        ${summaryLines}
        ${grandTotalLine}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page {
      size: A4 ${isLandscape ? 'landscape' : 'portrait'};
      margin: 8mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 9.5px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    .doc-container {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 12px;
      background: #ffffff;
    }
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #b45309;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 9px;
      color: #475569;
      margin-top: 2px;
      line-height: 1.3;
    }
    .doc-badge {
      text-align: right;
    }
    .doc-badge-title {
      font-size: 14px;
      font-weight: 800;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-badge-sub {
      font-size: 9px;
      color: #64748b;
    }
    .meta-grid {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .meta-col {
      flex: 1;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9px;
    }
    table.data-table th {
      background-color: #1e293b;
      color: #ffffff;
      font-weight: 700;
      font-size: 9px;
      padding: 6px 8px;
      border: 1px solid #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.data-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .bottom-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-top: 10px;
    }
    .notes-box {
      flex: 1;
      font-size: 9px;
      color: #475569;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px;
      background: #fafafa;
    }
    .footer-bar {
      margin-top: 16px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <div class="header-banner">
      <div>
        <div class="company-title">${escapeHtml(comp.name)}</div>
        <div class="company-sub">${escapeHtml(comp.address)}</div>
        <div class="company-sub">
          <strong>GSTIN:</strong> ${escapeHtml(comp.gstin)} | <strong>State:</strong> ${escapeHtml(comp.state)} (${escapeHtml(comp.stateCode)}) | <strong>Phone:</strong> ${escapeHtml(comp.phone)}
        </div>
      </div>
      <div class="doc-badge">
        <div class="doc-badge-title">${escapeHtml(docTitle)}</div>
        ${subtitle ? `<div class="doc-badge-sub">${escapeHtml(subtitle)}</div>` : ''}
      </div>
    </div>

    ${metaFields.length > 0 ? `
      <div class="meta-grid">
        <div class="meta-col">
          ${metaHtml}
        </div>
      </div>
    ` : ''}

    <table class="data-table">
      <thead>
        <tr>
          <th style="width:24px; text-align:center;">#</th>
          ${thsHtml}
        </tr>
      </thead>
      <tbody>
        ${rows.length > 0 ? trsHtml : emptyHtml}
      </tbody>
    </table>

    <div class="bottom-section">
      <div class="notes-box">
        <strong>Notes / Terms:</strong><br/>
        ${notes ? escapeHtml(notes) : 'Computer generated report derived from authoritative ERP database records. No signature required.'}
        ${taxBreakupHtml}
      </div>
      ${summaryBoxHtml}
    </div>

    <div class="footer-bar">
      <span>Laetus Life Sciences ERP System</span>
      <span>Generated: ${generatedAt}</span>
      <span>Confidential Business Document</span>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderCommonDocHtml };
