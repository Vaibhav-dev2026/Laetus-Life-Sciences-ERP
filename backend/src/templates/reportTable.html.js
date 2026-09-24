const dayjs = require('dayjs');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderReportTableHtml({ title, columns, rows, company, filters = {} }) {
  const comp = company || {};
  const cols = columns || [];
  const list = rows || [];

  const ths = cols.map((c) => {
    const keyStr = String(c.key || '').toLowerCase();
    const isNumKey = keyStr.includes('amount') || keyStr.includes('total') || keyStr.includes('balance') || keyStr.includes('received') || keyStr.includes('value') || keyStr.includes('tax') || keyStr.includes('mrp') || keyStr.includes('rate') || keyStr.includes('price');
    return `<th style="text-align:${isNumKey ? 'right' : 'left'};">${escapeHtml(c.label || c.key)}</th>`;
  }).join('');

  const trs = list.map((r, i) => {
    const tds = cols.map((c) => {
      const val = r[c.key] ?? '';
      const keyStr = String(c.key || '').toLowerCase();
      const isNum = typeof val === 'number' || keyStr.includes('amount') || keyStr.includes('total') || keyStr.includes('balance') || keyStr.includes('received') || keyStr.includes('value') || keyStr.includes('tax') || keyStr.includes('mrp') || keyStr.includes('rate') || keyStr.includes('price');
      return `<td style="text-align:${isNum ? 'right' : 'left'};">${escapeHtml(val)}</td>`;
    }).join('');
    return `<tr><td style="text-align:center;">${i + 1}</td>${tds}</tr>`;
  }).join('');

  const generatedAt = dayjs().format('DD-MM-YYYY HH:mm');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${escapeHtml(title || 'ERP Report')}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; color: #111; margin: 0; padding: 0; }
  .doc-wrap { width: 100%; border: 1.5px solid #222; }
  .title-bar { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 1px; padding: 5px 0; border-bottom: 1.5px solid #222; background: #fafafa; text-transform: uppercase; }
  .comp-box { padding: 6px 10px; border-bottom: 1.5px solid #222; display: flex; justify-content: space-between; align-items: center; }
  .comp-title { font-size: 12px; font-weight: bold; color: #000; }
  .meta-text { font-size: 8.5px; color: #333; }
  table.report-table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  table.report-table th, table.report-table td { border: 1px solid #333; padding: 3px 4px; }
  table.report-table th { background: #eee; font-weight: bold; font-size: 8.5px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .footer-bar { display: flex; justify-content: space-between; padding: 4px 8px; font-size: 8.5px; border-top: 1.5px solid #222; background: #fafafa; color: #444; }
</style></head>
<body>
  <div class="doc-wrap">
    <div class="title-bar">${escapeHtml(title || 'ERP REPORT')}</div>
    <div class="comp-box">
      <div>
        <div class="comp-title">${escapeHtml(comp.name || 'L LAETUS LIFE SCIENCES')}</div>
        <div class="meta-text">GSTIN: ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')} | Phone: ${escapeHtml(comp.phone || '9662031042')}</div>
      </div>
      <div style="text-align:right;" class="meta-text">
        Generated: ${generatedAt}<br/>
        Total Records: ${list.length}
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width:25px;text-align:center;">#</th>
          ${ths}
        </tr>
      </thead>
      <tbody>
        ${trs || '<tr><td colspan="100%" style="text-align:center;padding:12px;">No matching records found.</td></tr>'}
      </tbody>
    </table>

    <div class="footer-bar">
      <span>L LAETUS LIFE SCIENCES ERP System</span>
      <span>Page 1 of 1</span>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderReportTableHtml };
