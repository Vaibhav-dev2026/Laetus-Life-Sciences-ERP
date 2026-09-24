import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import FormField from '../../components/common/FormField.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { saleApi } from '../../api/saleApi.js';
import { customerApi } from '../../api/customerApi.js';
import { COMPANY_CONFIG } from '../../config/company.js';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate, daysBetween } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function OutstandingReport() {
  usePageTitle('Outstanding Report');
  const navigate = useNavigate();
  const { id: routeCustomerId } = useParams();

  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(routeCustomerId || '');
  const [range, setRange] = useState({ from: '', to: '' });
  const [ageingFilter, setAgeingFilter] = useState('All');
  const debouncedSearch = useDebounce(search, 250);

  const { data: sales, loading, error, reload } = useAsync(() => saleApi.list(), []);
  const { data: customers } = useAsync(() => customerApi.list(), []);

  // Update selected customer if route param changes
  React.useEffect(() => {
    if (routeCustomerId) {
      setSelectedCustomerId(routeCustomerId);
    }
  }, [routeCustomerId]);

  const rows = useMemo(() => {
    if (!sales || !customers) return [];
    
    // Sort sales by Customer ID and then by Date
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const activeSales = sales.filter((s) => s.status !== 'Cancelled');
    const sorted = [...activeSales].sort((a, b) => {
      const cA = customerMap.get(a.customerId)?.partyName || a.customerId || '';
      const cB = customerMap.get(b.customerId)?.partyName || b.customerId || '';
      const comp = cA.localeCompare(cB);
      if (comp !== 0) return comp;
      return (a.date || '').localeCompare(b.date || '');
    });

    const partyCumulative = {};
    const today = dayjs().format('YYYY-MM-DD');

    return sorted.map((s) => {
      const customer = customerMap.get(s.customerId);
      const sameState = (customer?.stateCode || COMPANY_CONFIG.stateCode) === COMPANY_CONFIG.stateCode;
      const billAmount = s.grandTotal || (s.lines || []).reduce((a, l) => a + calcLine({ ...l, sameState }).total, 0);
      const received = Number(s.amountReceived || 0);
      const balance = Math.max(0, billAmount - received);
      
      const dueDate = s.dueDate || s.date;
      const daysOverdue = Math.max(0, daysBetween(dueDate, today));
      
      // Calculate party-wise cumulative
      partyCumulative[s.customerId] = (partyCumulative[s.customerId] || 0) + balance;

      let bucket = '0-30';
      if (daysOverdue > 90) bucket = '90+';
      else if (daysOverdue > 60) bucket = '61-90';
      else if (daysOverdue > 30) bucket = '31-60';

      return {
        id: s.id,
        customerId: s.customerId,
        partyName: customer?.partyName || s.customerId,
        billNo: s.invoiceNo,
        billDate: s.date,
        billAmount,
        received,
        balance,
        cumulativeTotal: partyCumulative[s.customerId],
        dueDate: s.dueDate || s.date,
        daysOverdue,
        bucket,
        pdc: '0',
        remark: s.paymentStatus || s.status,
      };
    }).filter((r) => r.balance > 0.5);
  }, [sales, customers]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesCustomer = !selectedCustomerId || r.customerId === selectedCustomerId;
      const matchesQ = !q || r.partyName.toLowerCase().includes(q) || r.billNo.toLowerCase().includes(q);
      const matchesAgeing = ageingFilter === 'All' || r.bucket === ageingFilter;
      const matchesDate = (!range.from || r.billDate >= range.from) && (!range.to || r.billDate <= range.to);
      return matchesCustomer && matchesQ && matchesAgeing && matchesDate;
    });
  }, [rows, debouncedSearch, selectedCustomerId, ageingFilter, range]);

  const ageingTotals = useMemo(() => {
    const t = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    rows.forEach((r) => { if (t[r.bucket] !== undefined) t[r.bucket] += r.balance; });
    return t;
  }, [rows]);

  const totalOutstanding = filtered.reduce((a, r) => a + r.balance, 0);

  const columns = [
    {
      key: 'partyName',
      label: 'Party Name',
      sortable: true,
      render: (r) => (
        <a href="#" onClick={(e) => { e.preventDefault(); setSelectedCustomerId(r.customerId); }}>
          <strong>{r.partyName}</strong>
        </a>
      ),
    },
    { key: 'billNo', label: 'Bill No' },
    { key: 'billDate', label: 'Bill Date', render: (r) => formatDate(r.billDate) },
    { key: 'billAmount', label: 'Bill Amt', align: 'right', render: (r) => formatCurrency(r.billAmount) },
    { key: 'received', label: 'Received', align: 'right', render: (r) => formatCurrency(r.received) },
    { key: 'balance', label: 'Balance', align: 'right', sortable: true, render: (r) => <strong>{formatCurrency(r.balance)}</strong> },
    { key: 'cumulativeTotal', label: 'Cumulative Total', align: 'right', render: (r) => formatCurrency(r.cumulativeTotal) },
    { key: 'dueDate', label: 'Due Date', render: (r) => formatDate(r.dueDate) },
    { key: 'daysOverdue', label: 'Days', align: 'right', sortable: true },
    { key: 'pdc', label: 'P.D.C.' },
    { key: 'remark', label: 'Remark' },
  ];

  return (
    <div className="page-body print-area-a5">
      <PageHeader
        title="Outstanding Report"
        description="Party-wise receivable positions grouped by invoice."
        actions={<ExportActions reportKey="outstanding" filename="outstanding_report" />}
      />

      {/* Printable Header (Visible only when printing) */}
      <div className="print-header no-screen" style={{ display: 'none' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #222', paddingBottom: 6, marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{COMPANY_CONFIG.name}</div>
          <div style={{ fontSize: 10 }}>
            {COMPANY_CONFIG.addressLine1}, {COMPANY_CONFIG.addressLine2} &nbsp;·&nbsp; Phone: {COMPANY_CONFIG.phone}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>OUTSTANDING REPORT</div>
          <div style={{ fontSize: 10 }}>As on {formatDate(dayjs().format('YYYY-MM-DD'))}</div>
        </div>
      </div>

      <div className="stat-grid mb-6 no-print">
        <StatCard label="0–30 Days" value={formatCurrency(ageingTotals['0-30'])} />
        <StatCard label="31–60 Days" value={formatCurrency(ageingTotals['31-60'])} />
        <StatCard label="61–90 Days" value={formatCurrency(ageingTotals['61-90'])} />
        <StatCard label="90+ Days" value={formatCurrency(ageingTotals['90+'])} />
      </div>

      <div className="card">
        <div className="list-toolbar no-print">
          <div className="toolbar-left" style={{ flexWrap: 'wrap' }}>
            <SearchBox value={search} onChange={setSearch} placeholder="Search party, bill no…" />
            <select
              className="form-control"
              style={{ width: 180 }}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{c.partyName}</option>
              ))}
            </select>
            <select
              className="form-control"
              style={{ width: 130 }}
              value={ageingFilter}
              onChange={(e) => setAgeingFilter(e.target.value)}
            >
              {['All', '0-30', '31-60', '61-90', '90+'].map((b) => <option key={b}>{b}</option>)}
            </select>
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
            {selectedCustomerId && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomerId('')}>
                Clear Filter
              </button>
            )}
          </div>
          <div className="toolbar-right">
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              Filtered Balance: <strong>{formatCurrency(totalOutstanding)}</strong>
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          onRetry={reload}
          cardTitleKey="partyName"
          emptyTitle="No outstanding invoices."
          emptyDescription="All customer invoices in this selection are fully settled."
        />
      </div>
    </div>
  );
}

