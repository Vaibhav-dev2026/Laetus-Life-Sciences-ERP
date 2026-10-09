const dayjs = require('dayjs');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fc(n) {
  const num = Number(n || 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Renders a statutory GSTR-3B HTML document.
 * @param {Object} opts
 * @param {Object} opts.company       - Normalised company object
 * @param {Object} opts.data          - Output of gstReport.service.getGstr3bData()
 * @param {Object} opts.filters       - { financialYear, from, to }
 */
function renderGstr3bHtml({ company, data, filters = {} }) {
  const comp = company || {};
  const d = data || {};
  const generatedAt = dayjs().format('DD-MM-YYYY HH:mm');

  // ── Period label ───────────────────────────────────────────────────────────
  let periodLabel = filters.financialYear ? `FY ${filters.financialYear}` : '';
  if (!periodLabel && (filters.from || filters.to)) {
    const f = filters.from ? dayjs(filters.from).format('DD-MM-YYYY') : '';
    const t = filters.to   ? dayjs(filters.to).format('DD-MM-YYYY')   : '';
    periodLabel = [f && `From ${f}`, t && `To ${t}`].filter(Boolean).join(' ');
  }
  if (!periodLabel) periodLabel = 'All Period';

  // ── Derived values ─────────────────────────────────────────────────────────
  const outwardTaxable  = Number(d?.section31?.outwardTaxable  ?? d?.outwardTaxable  ?? 0);
  const outputCgst      = Number(d?.section31?.cgst            ?? d?.outputCgst      ?? 0);
  const outputSgst      = Number(d?.section31?.sgst            ?? d?.outputSgst      ?? 0);
  const outputIgst      = Number(d?.section31?.igst            ?? d?.outputIgst      ?? 0);
  const totalOutputTax  = Number(d?.section31?.totalTax        ?? d?.totalOutputTax  ?? 0)
                          || (outputCgst + outputSgst + outputIgst);

  const eligibleCgst    = Number(d?.section4?.availableCgst    ?? d?.eligibleCgst    ?? 0);
  const eligibleSgst    = Number(d?.section4?.availableSgst    ?? d?.eligibleSgst    ?? 0);
  const eligibleIgst    = Number(d?.section4?.availableIgst    ?? d?.eligibleIgst    ?? 0);
  const totalEligibleItc= Number(d?.section4?.totalNetItc      ?? d?.totalEligibleItc?? 0)
                          || (eligibleCgst + eligibleSgst + eligibleIgst);
  const reversalCgst    = Number(d?.section4?.reversalCgst     ?? 0);
  const reversalSgst    = Number(d?.section4?.reversalSgst     ?? 0);
  const netItcCgst      = Number(d?.section4?.netCgst          ?? Math.max(0, eligibleCgst - reversalCgst));
  const netItcSgst      = Number(d?.section4?.netSgst          ?? Math.max(0, eligibleSgst - reversalSgst));
  const netItcIgst      = Number(d?.section4?.netIgst          ?? eligibleIgst);
  const netItcTotal     = netItcCgst + netItcSgst + netItcIgst;

  const cashPayableCgst = Number(d?.netPayable?.cgst           ?? d?.cashPayableCgst ?? 0);
  const cashPayableSgst = Number(d?.netPayable?.sgst           ?? d?.cashPayableSgst ?? 0);
  const cashPayableIgst = Number(d?.netPayable?.igst           ?? d?.cashPayableIgst ?? 0);
  const netTaxPayable   = Number(d?.netPayable?.totalNetPayable?? d?.netTaxPayable   ?? 0);

  // ITC utilised = tax due – cash payable
  const itcUtilCgst = Math.max(0, outputCgst - cashPayableCgst);
  const itcUtilSgst = Math.max(0, outputSgst - cashPayableSgst);
  const itcUtilIgst = Math.max(0, outputIgst - cashPayableIgst);

  // ── Address block ──────────────────────────────────────────────────────────
  const addrParts = [
    comp.addressLine1 || comp.address,
    comp.addressLine2,
    [comp.city, comp.state].filter(Boolean).join(', '),
  ].filter(Boolean);

  // ── HTML helpers ───────────────────────────────────────────────────────────
  const TH = (text, extra = '') => `<th ${extra}>${escapeHtml(text)}</th>`;
  const TD = (val, right = false, bold = false) =>
    `<td style="text-align:${right ? 'right' : 'left'};${bold ? 'font-weight:700;' : ''}">${escapeHtml(String(val ?? ''))}</td>`;
  const TDN = (n, bold = false) => TD(fc(n), true, bold);

  // ── Section 3.1 rows ───────────────────────────────────────────────────────
  const s31rows = [
    ['(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', fc(outwardTaxable), fc(outputIgst), fc(outputCgst), fc(outputSgst), fc(0)],
    ['(b) Outward taxable supplies (zero rated)', fc(0), fc(0), fc(0), fc(0), fc(0)],
    ['(c) Other outward supplies (Nil rated, exempted)', fc(0), '', '', '', ''],
    ['(d) Inward supplies (liable to reverse charge)', fc(0), fc(0), fc(0), fc(0), fc(0)],
    ['(e) Non-GST outward supplies', fc(0), '', '', '', ''],
  ];

  // ── Section 4 rows ─────────────────────────────────────────────────────────
  const s4rows = [
    ['(A) ITC available (whether in full or part)', '', '', '', ''],
    ['(1) Import of goods', fc(0), fc(0), fc(0), fc(0)],
    ['(2) Import of services', fc(0), fc(0), fc(0), fc(0)],
    ['(3) Inward supplies liable to reverse charge', fc(0), fc(0), fc(0), fc(0)],
    ['(4) Inward supplies from ISD', fc(0), fc(0), fc(0), fc(0)],
    ['(5) All other ITC', fc(eligibleIgst + eligibleCgst + eligibleSgst), fc(eligibleIgst), fc(eligibleCgst), fc(eligibleSgst)],
    ['(B) ITC reversed', '', '', '', ''],
    ['(1) As per rules 42 & 43 of CGST Rules', fc(reversalCgst + reversalSgst), fc(0), fc(reversalCgst), fc(reversalSgst)],
    ['(2) Others', fc(0), fc(0), fc(0), fc(0)],
    ['(C) Net ITC Available (A) - (B)', fc(netItcTotal), fc(netItcIgst), fc(netItcCgst), fc(netItcSgst)],
    ['(D) Ineligible ITC', '', '', '', ''],
    ['(1) As per section 17(5)', fc(0), fc(0), fc(0), fc(0)],
    ['(2) Others', fc(0), fc(0), fc(0), fc(0)],
  ];

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>GSTR-3B Summary${periodLabel ? ' — ' + periodLabel : ''}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    font-size: 8.5px; color: #111; background: #fff;
  }
  .doc-wrap { width: 100%; border: 1.5px solid #1a1a2e; }

  /* Header */
  .company-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 7px 10px; background: #1a1a2e; color: #fff;
    border-bottom: 2px solid #c0392b;
  }
  .comp-name { font-size: 12px; font-weight: 800; text-transform: uppercase; }
  .comp-addr { font-size: 7px; color: #cdd; margin-top: 2px; line-height: 1.4; }
  .comp-right { text-align: right; font-size: 7.5px; color: #ddd; line-height: 1.6; }

  .title-bar {
    text-align: center; font-size: 11px; font-weight: 800;
    padding: 5px 0; border-bottom: 1px solid #1a1a2e;
    background: #f0f4ff; color: #1a1a2e; letter-spacing: 1px; text-transform: uppercase;
  }
  .subtitle-bar {
    text-align: center; font-size: 8px; color: #555;
    padding: 2px 0; border-bottom: 1.5px solid #1a1a2e; background: #f9f9fb;
  }
  .meta-strip {
    display: flex; justify-content: space-between;
    padding: 3px 10px; background: #f9f9fb; border-bottom: 1px solid #bbb;
    font-size: 7.5px; color: #444;
  }

  /* Section headings */
  .section-head {
    background: #2c3e6b; color: #fff; font-weight: 700; font-size: 9px;
    padding: 4px 8px; border-top: 1.5px solid #1a1a2e; border-bottom: 1px solid #1a1a2e;
    margin-top: 0;
  }

  /* Tables */
  table.gstr-table { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 0; }
  table.gstr-table th {
    background: #e8edf8; color: #1a1a2e; font-weight: 700;
    border: 1px solid #333; padding: 3.5px 5px; text-align: center;
  }
  table.gstr-table td {
    border: 1px solid #555; padding: 3px 5px;
  }
  .sub-head td {
    background: #dce3f7; font-weight: 700; font-style: italic;
  }
  .total-row td {
    background: #1a1a2e; color: #fff; font-weight: 800; border: 1.5px solid #000;
  }

  /* Footer */
  .footer-bar {
    display: flex; justify-content: space-between;
    padding: 4px 10px; font-size: 7.5px;
    border-top: 1.5px solid #1a1a2e; background: #1a1a2e; color: #ccc;
  }
  .disclaimer {
    font-size: 7px; color: #888; padding: 4px 10px; border-top: 1px solid #ccc;
    background: #f9f9fb;
  }
</style>
</head>
<body>
<div class="doc-wrap">

  <!-- Company Header -->
  <div class="company-header">
    <div>
      <div class="comp-name">${escapeHtml(comp.name || 'L Laetus Life Sciences')}</div>
      <div class="comp-addr">${addrParts.map(escapeHtml).join('<br/>')}</div>
    </div>
    <div class="comp-right">
      <div style="font-weight:700;font-size:8.5px;color:#fff;">GSTIN: ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')}</div>
      <div>Phone: ${escapeHtml(comp.phone || '9662031042')}</div>
      <div>Generated: ${generatedAt}</div>
    </div>
  </div>

  <!-- Title -->
  <div class="title-bar">Form GSTR-3B &mdash; Tax Summary</div>
  <div class="subtitle-bar">[See Rule 61(5)] &nbsp;|&nbsp; ${escapeHtml(periodLabel)}</div>
  <div class="meta-strip">
    <span><strong>GSTIN:</strong> ${escapeHtml(comp.gstin || '24AFSPT7471H1ZR')}</span>
    <span><strong>Legal Name:</strong> ${escapeHtml(comp.name || 'L Laetus Life Sciences')}</span>
    <span><strong>Period:</strong> ${escapeHtml(periodLabel)}</span>
  </div>

  <!-- ─── 3.1 Outward Supplies ─── -->
  <div class="section-head">3.1 Details of Outward Supplies and Inward Supplies liable to Reverse Charge</div>
  <table class="gstr-table">
    <thead>
      <tr>
        ${TH('Nature of Supplies', 'style="width:45%;text-align:left;"')}
        ${TH('Total Taxable Value (Rs.)')}
        ${TH('Integrated Tax (Rs.)')}
        ${TH('Central Tax (Rs.)')}
        ${TH('State/UT Tax (Rs.)')}
        ${TH('Cess (Rs.)')}
      </tr>
    </thead>
    <tbody>
      ${s31rows.map((row, i) => `
        <tr ${i === s31rows.length - 1 ? 'class="sub-head"' : ''}>
          <td style="text-align:left;">${escapeHtml(row[0])}</td>
          <td style="text-align:right;">${escapeHtml(row[1])}</td>
          <td style="text-align:right;">${escapeHtml(row[2])}</td>
          <td style="text-align:right;">${escapeHtml(row[3])}</td>
          <td style="text-align:right;">${escapeHtml(row[4])}</td>
          <td style="text-align:right;">${escapeHtml(row[5])}</td>
        </tr>`).join('')}
      <tr class="total-row">
        <td style="text-align:left;">Total Outward Tax Liability</td>
        <td style="text-align:right;">${fc(outwardTaxable)}</td>
        <td style="text-align:right;">${fc(outputIgst)}</td>
        <td style="text-align:right;">${fc(outputCgst)}</td>
        <td style="text-align:right;">${fc(outputSgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ─── 3.2 Inter-state Supplies ─── -->
  <div class="section-head">3.2 Details of Inter-State Supplies</div>
  <table class="gstr-table">
    <thead>
      <tr>
        ${TH('Nature of Supplies', 'style="width:55%;text-align:left;"')}
        ${TH('Place of Supply (State/UT)')}
        ${TH('Total Taxable Value (Rs.)')}
        ${TH('IGST Amount (Rs.)')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Supplies made to Unregistered Persons</td>
        <td style="text-align:center;">Gujarat</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
      <tr>
        <td>Supplies made to Composition Taxable Persons</td>
        <td style="text-align:center;">-</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
      <tr>
        <td>Supplies made to UIN holders</td>
        <td style="text-align:center;">-</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ─── 4 Eligible ITC ─── -->
  <div class="section-head">4. Eligible Input Tax Credit (ITC)</div>
  <table class="gstr-table">
    <thead>
      <tr>
        ${TH('Details', 'style="width:45%;text-align:left;"')}
        ${TH('Total Amount (Rs.)')}
        ${TH('Integrated Tax (Rs.)')}
        ${TH('Central Tax (Rs.)')}
        ${TH('State/UT Tax (Rs.)')}
      </tr>
    </thead>
    <tbody>
      ${s4rows.map((row) => {
        const isEmpty = row[1] === '';
        if (isEmpty) {
          return `<tr class="sub-head"><td colspan="5" style="text-align:left;">${escapeHtml(row[0])}</td></tr>`;
        }
        return `<tr>
          <td style="text-align:left;">${escapeHtml(row[0])}</td>
          <td style="text-align:right;">${escapeHtml(row[1])}</td>
          <td style="text-align:right;">${escapeHtml(row[2])}</td>
          <td style="text-align:right;">${escapeHtml(row[3])}</td>
          <td style="text-align:right;">${escapeHtml(row[4])}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <!-- ─── 5 Exempt / Nil ─── -->
  <div class="section-head">5. Values of Exempt, Nil-rated and Non-GST Inward Supplies</div>
  <table class="gstr-table">
    <thead>
      <tr>
        ${TH('Nature of Supplies', 'style="width:55%;text-align:left;"')}
        ${TH('Inter-State Supplies (Rs.)')}
        ${TH('Intra-State Supplies (Rs.)')}
      </tr>
    </thead>
    <tbody>
      <tr><td>From a supplier under composition scheme</td><td style="text-align:right;">${fc(0)}</td><td style="text-align:right;">${fc(0)}</td></tr>
      <tr><td>Exempt supply</td><td style="text-align:right;">${fc(0)}</td><td style="text-align:right;">${fc(0)}</td></tr>
      <tr><td>Nil rated supply</td><td style="text-align:right;">${fc(0)}</td><td style="text-align:right;">${fc(0)}</td></tr>
      <tr><td>Non-GST supply</td><td style="text-align:right;">${fc(0)}</td><td style="text-align:right;">${fc(0)}</td></tr>
    </tbody>
  </table>

  <!-- ─── 6.1 Payment of Tax ─── -->
  <div class="section-head">6.1 Payment of Tax</div>
  <table class="gstr-table">
    <thead>
      <tr>
        ${TH('Description', 'style="width:28%;text-align:left;"')}
        ${TH('Tax Payable (Rs.)')}
        ${TH('ITC Paid — IGST (Rs.)')}
        ${TH('ITC Paid — CGST (Rs.)')}
        ${TH('ITC Paid — SGST (Rs.)')}
        ${TH('Cash Paid (Rs.)')}
        ${TH('Interest (Rs.)')}
        ${TH('Late Fee (Rs.)')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>IGST</strong></td>
        <td style="text-align:right;">${fc(outputIgst)}</td>
        <td style="text-align:right;">${fc(itcUtilIgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(cashPayableIgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
      <tr>
        <td><strong>CGST</strong></td>
        <td style="text-align:right;">${fc(outputCgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(itcUtilCgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(cashPayableCgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
      <tr>
        <td><strong>SGST/UTGST</strong></td>
        <td style="text-align:right;">${fc(outputSgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(itcUtilSgst)}</td>
        <td style="text-align:right;">${fc(cashPayableSgst)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
      <tr class="total-row">
        <td style="text-align:left;"><strong>TOTAL NET TAX PAYABLE</strong></td>
        <td style="text-align:right;">${fc(totalOutputTax)}</td>
        <td style="text-align:right;">${fc(itcUtilIgst)}</td>
        <td style="text-align:right;">${fc(itcUtilCgst)}</td>
        <td style="text-align:right;">${fc(itcUtilSgst)}</td>
        <td style="text-align:right;">${fc(netTaxPayable)}</td>
        <td style="text-align:right;">${fc(0)}</td>
        <td style="text-align:right;">${fc(0)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Disclaimer -->
  <div class="disclaimer">
    This is a system-generated summary for internal CA / management use only. It is NOT an official GSTR-3B filing.
    Verify all values before filing on the GST Portal. Total ITC Available: Rs.${fc(totalEligibleItc)} &nbsp;|&nbsp; Net Closing ITC (if any): Rs.${fc(Math.max(0, totalEligibleItc - totalOutputTax))}
  </div>

  <!-- Footer -->
  <div class="footer-bar">
    <span>L Laetus Life Sciences ERP &mdash; GSTR-3B Summary &mdash; Confidential</span>
    <span>Generated: ${generatedAt}</span>
  </div>
</div>
</body></html>`;
}

module.exports = { renderGstr3bHtml };
