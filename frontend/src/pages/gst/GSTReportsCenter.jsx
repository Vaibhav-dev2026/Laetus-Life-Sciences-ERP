import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

import { getDynamicFinancialYears, getCurrentFinancialYear, formatFyLabel } from '../../utils/financialYear.js';

const MONTHS = [
  { label: 'April', value: '04' },
  { label: 'May', value: '05' },
  { label: 'June', value: '06' },
  { label: 'July', value: '07' },
  { label: 'August', value: '08' },
  { label: 'September', value: '09' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
  { label: 'January', value: '01' },
  { label: 'February', value: '02' },
  { label: 'March', value: '03' },
];

function getDateRange(fy, monthVal) {
  if (!fy || !monthVal) return { from: '', to: '' };
  const parts = String(fy).replace(/^FY\s*/i, '').split('-');
  const fyStartShort = parseInt(parts[0], 10);
  const fyStart = fyStartShort < 100 ? 2000 + fyStartShort : fyStartShort;
  const mm = parseInt(monthVal, 10);
  const year = mm >= 4 ? fyStart : fyStart + 1;
  const yyyy = String(year);
  const lastDay = new Date(year, mm, 0).getDate();
  return {
    from: `${yyyy}-${monthVal}-01`,
    to: `${yyyy}-${monthVal}-${String(lastDay).padStart(2, '0')}`,
  };
}

const REPORTS = [
  {
    id: 'gstr1',
    title: 'GSTR-1',
    subtitle: 'Outward Supplies',
    description:
      'B2B & B2C sales invoices, HSN summary (Table 12), document details (Table 13), and GSTIN validation. Filed monthly/quarterly with the GST portal.',
    icon: '📤',
    path: '/gst/gstr1',
    color: '#2f9e44',
    badges: ['B2B', 'B2C', 'HSN Summary', 'Exports', 'PDF', 'Excel', 'CSV'],
  },
  {
    id: 'gstr2',
    title: 'GSTR-2 / Inward & ITC',
    subtitle: 'Inward Supplies & Input Tax Credit',
    description:
      'Purchase inward register with ITC eligibility. Reconciles ERP books against GSTR-2B portal data (Matched / Books Only / Portal Only / Mismatch).',
    icon: '📥',
    path: '/gst/itc-reconciliation',
    color: '#1971c2',
    badges: ['Purchases', 'ITC Match', 'GSTR-2B Reconcile', 'PDF', 'Excel', 'CSV'],
  },
  {
    id: 'gstr3b',
    title: 'GSTR-3B',
    subtitle: 'Monthly GST Summary',
    description:
      'Consolidated monthly return: outward liability (Table 3.1), eligible ITC (Table 4), net tax payable. For CA review and return preparation.',
    icon: '📊',
    path: '/gst/gstr3b',
    color: '#e03131',
    badges: ['Table 3.1', 'Table 4 ITC', 'Net Payable', 'PDF', 'Excel', 'CSV'],
  },
];

export default function GSTReportsCenter() {
  usePageTitle('GST Reports');
  const navigate = useNavigate();
  const [financialYear, setFinancialYear] = useState(() => getCurrentFinancialYear());
  const [selectedMonth, setSelectedMonth] = useState('');

  const fyOptions = getDynamicFinancialYears();

  function openReport(report) {
    const range = getDateRange(financialYear, selectedMonth);
    const params = new URLSearchParams();
    params.set('financialYear', financialYear);
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    navigate(`${report.path}?${params.toString()}`);
  }

  const selectedMonthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label;

  return (
    <div className="page-body">
      <PageHeader
        title="GST Reports"
        description="Generate GSTR-1, GSTR-2 / Inward & ITC, and GSTR-3B from live ERP transactions."
      />

      {/* Period Selector Card */}
      <div className="card card-pad mb-6">
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>📅 Select Report Period</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12 }}>
              Financial Year
            </label>
            <select
              className="form-control"
              style={{ width: 160 }}
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              {fyOptions.map((fy) => (
                <option key={fy} value={fy}>
                  {formatFyLabel(fy)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12 }}>
              Month / Return Period
            </label>
            <select
              className="form-control"
              style={{ width: 180 }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="">— All Months (Full FY) —</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {selectedMonth && (
            <div style={{ paddingBottom: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              📋 Selected: <strong>{selectedMonthLabel} — FY {financialYear}</strong>
              {' '}
              {(() => {
                const r = getDateRange(financialYear, selectedMonth);
                return r.from ? <span className="mono" style={{ fontSize: 11 }}>({r.from} → {r.to})</span> : null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24 }}>
        {REPORTS.map((report) => (
          <div
            key={report.id}
            className="card"
            style={{ borderTop: `4px solid ${report.color}`, display: 'flex', flexDirection: 'column' }}
          >
            <div className="card-pad" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 36, lineHeight: 1 }}>{report.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: report.color, lineHeight: 1.2 }}>{report.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: 2 }}>
                    {report.subtitle}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.65, margin: '0 0 12px' }}>
                {report.description}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {report.badges.map((b) => (
                  <span key={b} className="badge badge-secondary" style={{ fontSize: 11 }}>{b}</span>
                ))}
              </div>
            </div>
            <div
              className="card-pad"
              style={{ borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, paddingTop: 12 }}
            >
              <button
                className="btn btn-primary"
                style={{ flex: 1, background: report.color, borderColor: report.color }}
                onClick={() => openReport(report)}
              >
                Open Report
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openReport(report)}>
                Generate
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* GST Filing Workflow guide */}
      <div className="card card-pad" style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>📌 GST Return Filing Workflow</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#2f9e44', marginBottom: 4 }}>① GSTR-1</div>
            File outward sales details by <strong>11th of following month</strong>. All B2B & B2C invoices must be reported.
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1971c2', marginBottom: 4 }}>② GSTR-2 / ITC Check</div>
            Verify inward purchase ITC before filing GSTR-3B. Reconcile with GSTR-2B portal data.
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#e03131', marginBottom: 4 }}>③ GSTR-3B</div>
            File summary return and pay net tax liability by <strong>20th of following month</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}
