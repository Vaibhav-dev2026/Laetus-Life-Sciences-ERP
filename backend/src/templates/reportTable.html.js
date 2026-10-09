const dayjs = require('dayjs');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(val) {
  if (val === null || val === undefined || val === '' || val === '-') return val === '-' ? '-' : '';
  const n = Number(val);
  if (!isNaN(n)) return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(val);
}

function isNumericKey(key) {
  const k = String(key || '').toLowerCase();
  return (
    k.includes('amount') || k.includes('total') || k.includes('balance') ||
    k.includes('received') || k.includes('value') || k.includes('tax') ||
    k.includes('mrp') || k.includes('rate') || k.includes('price') ||
    k.includes('payable') || k.includes('cgst') || k.includes('sgst') ||
    k.includes('igst') || k.includes('cess') || k.includes('qty') ||
    k.includes('quantity') || k.includes('stock') || k.includes('net') ||
    k.includes('cumulative')
  );
}

/**
 * Groups rows by a groupKey field (e.g. 'partyName' for Outstanding, 'category' for GSTR-1).
 * Returns an ordered list of { groupValue, rows[] } objects.
 */
function groupRows(rows, groupKey) {
  if (!groupKey) return null;
  const order = [];
  const map = new Map();
  for (const r of rows) {
    const key = r[groupKey] ?? '';
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key).push(r);
  }
  return order.map((k) => ({ groupValue: k, rows: map.get(k) }));
}

/**
 * Compute column totals for numeric columns.
 */
function computeTotals(columns, rows) {
  const totals = {};
  for (const c of columns) {
    if (isNumericKey(c.key)) {
      const sum = rows.reduce((acc, r) => {
        const n = Number(r[c.key]);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);
      totals[c.key] = sum;
    }
  }
  return totals;
}

/**
 * Render a <tr> for a group header row (full-width shaded label).
 */
function renderGroupHeader(groupValue, colCount) {
  return `<tr class="group-header-row"><td colspan="${colCount}" class="group-header-cell">${escapeHtml(groupValue)}</td></tr>`;
}

/**
 * Render a totals row for a group or grand total.
 */
function renderTotalsRow(columns, totals, label, colCount, isGrand) {
  const cls = isGrand ? 'grand-total-row' : 'subtotal-row';
  const tds = columns.map((c) => {
    const align = isNumericKey(c.key) ? 'right' : 'left';
    const val = totals[c.key] !== undefined
      ? Number(totals[c.key]).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
    return `<td class="${cls}-cell" style="text-align:${align};">${escapeHtml(val)}</td>`;
  });
  // Serial # cell + label in first data column area
  return `<tr class="${cls}">
    <td class="${cls}-cell" style="text-align:left;" colspan="1">${escapeHtml(label)}</td>
    ${tds.join('')}
  </tr>`;
}

/**
 * Master report PDF renderer.
 *
 * Options:
 *   title      – Report title
 *   columns    – [{ key, label }]
 *   rows       – array of plain row objects
 *   company    – company object { name, addressLine1, addressLine2, city, state, gstin, phone }
 *   filters    – query params for period/date display
 *   groupBy    – column key to group rows by (e.g. 'partyName', 'category')
 *   showTotals – boolean (default true) — whether to show totals row
 */
function renderReportTableHtml({ title, columns, rows, company, filters = {}, groupBy, showTotals = true }) {
  const comp = company || {};
  const cols = columns || [];
  const list = rows || [];
  const colCount = cols.length + 1; // +1 for the # column

  // ── Address block ──────────────────────────────────────────────────────────
  const addrParts = [
    comp.addressLine1 || comp.address,
    comp.addressLine2,
    [comp.city, comp.state].filter(Boolean).join(', '),
  ].filter(Boolean);
  const addrHtml = addrParts.map((a) => `<span>${escapeHtml(a)}</span>`).join('<br/>');

  // ── Period display ─────────────────────────────────────────────────────────
  let periodLabel = '';
  if (filters.financialYear) periodLabel = `FY: ${escapeHtml(filters.financialYear)}`;
  else if (filters.from || filters.to) {
    const f = filters.from ? dayjs(filters.from).format('DD-MM-YYYY') : '';
    const t = filters.to ? dayjs(filters.to).format('DD-MM-YYYY') : '';
    periodLabel = [f && `From: ${f}`, t && `To: ${t}`].filter(Boolean).join('  ');
  }

  // ── Column headers ─────────────────────────────────────────────────────────
  const ths = cols.map((c) => {
    const align = isNumericKey(c.key) ? 'right' : 'center';
    return `<th style="text-align:${align};">${escapeHtml(c.label || c.key)}</th>`;
  }).join('');

  // ── Row rendering ──────────────────────────────────────────────────────────
  let tableBodyHtml = '';
  let grandTotals = {};

  if (groupBy && list.length > 0) {
    // Grouped mode
    const groups = groupRows(list, groupBy);
    let globalSerial = 0;
    for (const g of groups) {
      const gTotals = computeTotals(cols, g.rows);
      // Accumulate grand totals
      for (const [k, v] of Object.entries(gTotals)) {
        grandTotals[k] = (grandTotals[k] || 0) + v;
      }
      tableBodyHtml += renderGroupHeader(g.groupValue, colCount);
      for (const r of g.rows) {
        globalSerial++;
        const tds = cols.map((c) => {
          const val = r[c.key] ?? '';
          const align = isNumericKey(c.key) ? 'right' : 'left';
          const disp = isNumericKey(c.key) && val !== '' && val !== '-' ? fmt(val) : escapeHtml(val);
          return `<td style="text-align:${align};">${disp}</td>`;
        }).join('');
        const rowClass = globalSerial % 2 === 0 ? 'class="alt-row"' : '';
        tableBodyHtml += `<tr ${rowClass}><td style="text-align:center;">${globalSerial}</td>${tds}</tr>`;
      }
      // Sub-total per group
      if (showTotals) {
        tableBodyHtml += renderTotalsRow(cols, gTotals, `Sub-total (${g.groupValue})`, colCount, false);
      }
    }
    // Grand total
    if (showTotals && list.length > 0) {
      tableBodyHtml += renderTotalsRow(cols, grandTotals, 'GRAND TOTAL', colCount, true);
    }
  } else {
    // Flat mode
    const totals = showTotals ? computeTotals(cols, list) : {};
    list.forEach((r, i) => {
      const tds = cols.map((c) => {
        const val = r[c.key] ?? '';
        const align = isNumericKey(c.key) ? 'right' : 'left';
        const disp = isNumericKey(c.key) && val !== '' && val !== '-' ? fmt(val) : escapeHtml(val);
        return `<td style="text-align:${align};">${disp}</td>`;
      }).join('');
      const rowClass = i % 2 === 0 ? '' : 'class="alt-row"';
      tableBodyHtml += `<tr ${rowClass}><td style="text-align:center;">${i + 1}</td>${tds}</tr>`;
    });
    if (showTotals && list.length > 0) {
      tableBodyHtml += renderTotalsRow(cols, totals, 'GRAND TOTAL', colCount, true);
    }
  }

  if (!tableBodyHtml) {
    tableBodyHtml = `<tr><td colspan="${colCount}" style="text-align:center;padding:14px;color:#666;">No matching records found.</td></tr>`;
  }

  const generatedAt = dayjs().format('DD-MM-YYYY HH:mm');
  const totalRecords = list.length;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${escapeHtml(title || 'ERP Report')}</title>
<style>
  @page { size: A4 landscape; margin: 8mm 6mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    font-size: 8.5px; color: #111; background: #fff;
  }

  /* ── Outer wrapper ── */
  .doc-wrap { width: 100%; border: 1.5px solid #1a1a2e; }

  /* ── Company Header ── */
  .company-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 7px 10px; background: #1a1a2e; color: #fff;
    border-bottom: 2px solid #c0392b;
  }
  .comp-name { font-size: 13px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
  .comp-addr { font-size: 7.5px; color: #cdd; margin-top: 2px; line-height: 1.4; }
  .comp-right { text-align: right; font-size: 8px; color: #ddd; line-height: 1.5; }
  .comp-gstin { font-size: 8.5px; font-weight: 700; color: #fff; }

  /* ── Title bar ── */
  .title-bar {
    text-align: center; font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
    padding: 5px 0; border-bottom: 1.5px solid #1a1a2e;
    background: #f0f4ff; text-transform: uppercase; color: #1a1a2e;
  }

  /* ── Meta strip (period / records / generated) ── */
  .meta-strip {
    display: flex; justify-content: space-between; align-items: center;
    padding: 3px 10px; background: #f9f9fb; border-bottom: 1px solid #bbb;
    font-size: 7.5px; color: #444;
  }

  /* ── Table ── */
  table.report-table {
    width: 100%; border-collapse: collapse; font-size: 8px;
  }
  table.report-table th {
    background: #1a1a2e; color: #fff; font-weight: 700; font-size: 7.8px;
    border: 1px solid #333; padding: 3.5px 4px;
  }
  table.report-table td {
    border: 1px solid #555; padding: 3px 4px; color: #111;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  tr.alt-row td { background: #f5f7ff; }

  /* ── Group header row ── */
  .group-header-row .group-header-cell {
    background: #2c3e6b; color: #fff; font-weight: 700; font-size: 8.5px;
    padding: 4px 6px; border: 1px solid #1a1a2e; letter-spacing: 0.3px;
  }

  /* ── Sub-total row ── */
  .subtotal-row .subtotal-row-cell {
    background: #dce3f7; font-weight: 700; border: 1px solid #6677aa;
    padding: 3px 4px; font-size: 8px;
  }

  /* ── Grand total row ── */
  .grand-total-row .grand-total-row-cell {
    background: #1a1a2e; color: #fff; font-weight: 800;
    border: 1.5px solid #000; padding: 4px; font-size: 8.2px;
  }

  /* ── Footer ── */
  .footer-bar {
    display: flex; justify-content: space-between;
    padding: 4px 10px; font-size: 7.5px; border-top: 1.5px solid #1a1a2e;
    background: #1a1a2e; color: #ccc;
  }
</style></head>
<body>
  <div class="doc-wrap">
    <!-- Company Header -->
    <div class="company-header">
      <div>
        <div class="comp-name">${escapeHtml(comp.name || 'L Laetus Life Sciences')}</div>
        <div class="comp-addr">${addrHtml || escapeHtml('1st Floor, 249 Sukhinagar, Bamroli Gam Road, Pandesara, Surat-394221')}</div>
      </div>
      <div class="comp-right">
        <div class="comp-gstin">GSTIN: ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')}</div>
        <div>Phone: ${escapeHtml(comp.phone || '9662031042')}</div>
      </div>
    </div>

    <!-- Report Title -->
    <div class="title-bar">${escapeHtml(title || 'ERP REPORT')}</div>

    <!-- Meta strip -->
    <div class="meta-strip">
      <span>${periodLabel ? `<strong>Period:</strong> ${periodLabel}` : '&nbsp;'}</span>
      <span><strong>Total Records:</strong> ${totalRecords}</span>
      <span><strong>Generated:</strong> ${generatedAt}</span>
    </div>

    <!-- Data Table -->
    <table class="report-table">
      <thead>
        <tr>
          <th style="width:24px;text-align:center;">#</th>
          ${ths}
        </tr>
      </thead>
      <tbody>
        ${tableBodyHtml}
      </tbody>
    </table>

    <!-- Footer -->
    <div class="footer-bar">
      <span>L Laetus Life Sciences ERP &mdash; Confidential</span>
      <span>Generated on ${generatedAt}</span>
    </div>
  </div>
</body></html>`;
}

module.exports = { renderReportTableHtml };
