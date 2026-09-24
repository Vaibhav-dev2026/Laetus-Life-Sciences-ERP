import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { dashboardApi } from '../../api/dashboardApi.js';
import { formatCurrency } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import './dashboard.css';

const PIE_COLORS = ['#0d3b3e', '#c8952f', '#1c6fa8'];

export default function Dashboard() {
  usePageTitle('Dashboard');
  const [range, setRange] = React.useState({ from: '', to: '' });

  const summary = useAsync(() => dashboardApi.getSummary(range), [range]);
  const trend = useAsync(() => dashboardApi.getSalesTrend(range), [range]);
  const topProducts = useAsync(() => dashboardApi.getTopProducts(range), [range]);
  const ageing = useAsync(() => dashboardApi.getOutstandingAgeing(range), [range]);
  const gstSummary = useAsync(() => dashboardApi.getGstSummary(range), [range]);

  const s = summary.data;

  return (
    <div className="page-body">
      <PageHeader
        title="Executive Dashboard"
        description="Live snapshot of sales, inventory and receivables for Laetus Life Sciences."
        actions={<DateRangeFilter from={range.from} to={range.to} onChange={setRange} />}
      />

      {summary.loading ? (
        <div className="stat-grid">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} height={92} />)}</div>
      ) : summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : (
        <div className="stat-grid">
          <StatCard label="Sales Today" value={formatCurrency(s.salesToday)} icon="🧮" />
          <StatCard label="Monthly Sales" value={formatCurrency(s.monthlySales)} icon="📈" trend="+ this financial year" trendDirection="up" />
          <StatCard label="Purchase Today" value={formatCurrency(s.purchaseToday)} icon="🧾" />
          <StatCard label="Outstanding Receivable" value={formatCurrency(s.outstandingReceivable)} icon="📋" trendDirection="down" trend="Across all customers" />
          <StatCard label="Supplier Payable" value={formatCurrency(s.supplierPayable)} icon="🚚" />
          <StatCard label="Current Stock Value" value={formatCurrency(s.stockValue)} icon="📦" />
          <StatCard label="Low Stock Products" value={s.lowStock} icon="⚠️" />
          <StatCard label="Near Expiry Batches" value={s.nearExpiry} icon="⏳" />
          <StatCard label="Expired Batches" value={s.expired} icon="⛔" />
          <StatCard label="Total Customers" value={s.totalCustomers} icon="👥" />
          <StatCard label="Total Suppliers" value={s.totalSuppliers} icon="🏭" />
        </div>
      )}

      <div className="chart-grid mt-6">
        <div className="card card-pad chart-card">
          <div className="card-title mb-4">Daily Sales Trend</div>
          {trend.loading ? <CardSkeleton height={260} /> : trend.error ? <ErrorState message={trend.error} onRetry={trend.reload} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#0d3b3e" strokeWidth={2} dot={false} name="Sales" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad chart-card">
          <div className="card-title mb-4">Purchase vs Sales</div>
          {trend.loading ? <CardSkeleton height={260} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="purchase" fill="#c8952f" name="Purchase" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" fill="#0d3b3e" name="Sales" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad chart-card">
          <div className="card-title mb-4">Top Selling Products</div>
          {topProducts.loading ? <CardSkeleton height={260} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts.data} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="value" fill="#14555a" radius={[0, 4, 4, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad chart-card">
          <div className="card-title mb-4">Outstanding Ageing</div>
          {ageing.loading ? <CardSkeleton height={260} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ageing.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="amount" fill="#b5790a" radius={[4, 4, 0, 0]} name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad chart-card">
          <div className="card-title mb-4">GST Summary</div>
          {gstSummary.loading ? <CardSkeleton height={260} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={gstSummary.data} dataKey="value" nameKey="name" outerRadius={90} label>
                  {gstSummary.data.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
