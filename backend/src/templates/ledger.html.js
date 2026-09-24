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

function renderLedgerHtml({ company, party, partyType = 'Party', entries, openingBalance, closingBalance, dateRange }) {
  const comp = company || {};
  const p = party || {};
  const list = entries || [];
  const pType = String(partyType || 'Party');

  const rows = list.map((e, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td style="text-align:center;">${formatDate(e.date)}</td>
      <td style="text-align:left;font-weight:bold;">${escapeHtml(e.refNo || e.id || '-')}</td>
      <td style="text-align:left;">${escapeHtml(e.type || '-')}</td>
      <td style="text-align:left;">${escapeHtml(e.narration || e.description || '-')}</td>
      <td style="text-align:right;">${e.debit > 0 ? Number(e.debit).toFixed(2) : '-'}</td>
      <td style="text-align:right;">${e.credit > 0 ? Number(e.credit).toFixed(2) : '-'}</td>
      <td style="text-align:right;font-weight:bold;">${Number(e.runningBalance !== undefined ? e.runningBalance : e.balance || 0).toFixed(2)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${escapeHtml(pType)} Ledger - ${escapeHtml(p.partyName || p.name || 'Statement')}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #111; margin: 0; padding: 0; }
  .doc-wrap { width: 100%; border: 1.5px solid #222; }
  .title-bar { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 1.5px; padding: 5px 0; border-bottom: 1.5px solid #222; background: #fafafa; text-transform: uppercase; }
  .header-grid { display: flex; border-bottom: 2px solid #222; }
  .header-box { flex: 1; padding: 8px 10px; }
  .header-box.left { border-right: 1.5px solid #222; }
  .comp-title { font-size: 13px; font-weight: bold; color: #000; }
  .party-title { font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px; }
  .meta-text { font-size: 9.5px; line-height: 1.35; color: #222; }
  .info-bar { display: flex; justify-content: space-between; padding: 5px 8px; font-size: 10px; background: #fafafa; border-bottom: 1.5px solid #222; }
  table.ledger-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.ledger-table th, table.ledger-table td { border: 1px solid #222; padding: 4px 5px; }
  table.ledger-table th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9.5px; }
  .summary-strip { display: flex; justify-content: space-between; padding: 8px 10px; border-top: 1.5px solid #222; background: #fafafa; font-size: 11px; font-weight: bold; }
</style></head>
<body>
  <div class="doc-wrap">
    <div class="title-bar">${escapeHtml(pType).toUpperCase()} LEDGER STATEMENT</div>
    <div class="header-grid">
      <div class="header-box left">
        <div class="comp-title">${escapeHtml(comp.name || 'L LAETUS LIFE SCIENCES')}</div>
        <div class="meta-text">
          ${escapeHtml(comp.addressLine1 || comp.address || '')}<br/>
          ${comp.addressLine2 ? escapeHtml(comp.addressLine2) + '<br/>' : ''}
          GSTIN: ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')} | Phone: ${escapeHtml(comp.phone || '9662031042')}
        </div>
      </div>
      <div class="header-box">
        <div class="party-title">ACCOUNT OF: ${escapeHtml(p.partyName || p.name || '-')}</div>
        <div class="meta-text">
          Address: ${escapeHtml(p.address || '-')}<br/>
          GSTIN: ${escapeHtml(p.gstin || '-')} | Phone: ${escapeHtml(p.phone || '-')}
        </div>
      </div>
    </div>

    <div class="info-bar">
      <div><strong>Period:</strong> ${escapeHtml(dateRange || 'All Time')}</div>
      <div><strong>Opening Balance:</strong> ${formatCurrency(openingBalance || 0)}</div>
      <div><strong>Closing Balance:</strong> ${formatCurrency(closingBalance || 0)}</div>
    </div>

    <table class="ledger-table">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th style="width:70px;">Date</th>
          <th style="width:90px;">Ref No</th>
          <th style="width:80px;">Type</th>
          <th>Narration / Description</th>
          <th style="width:80px;">Debit (Rs.)</th>
          <th style="width:80px;">Credit (Rs.)</th>
          <th style="width:90px;">Balance (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" style="text-align:center;padding:10px;">No transaction entries found</td></tr>'}
      </tbody>
    </table>

    <div class="summary-strip">
      <span>STATEMENT SUMMARY</span>
      <span>CLOSING BALANCE: ${formatCurrency(closingBalance || 0)}</span>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderLedgerHtml };
