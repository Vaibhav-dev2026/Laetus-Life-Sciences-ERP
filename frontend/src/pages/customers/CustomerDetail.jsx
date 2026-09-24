import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { customerApi } from '../../api/customerApi.js';
import { saleApi } from '../../api/saleApi.js';
import { paymentApi } from '../../api/paymentApi.js';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: customer, loading, error, reload } = useAsync(() => customerApi.getById(id), [id]);
  const { data: sales } = useAsync(() => saleApi.list(), []);
  const { data: payments } = useAsync(() => paymentApi.list(), []);
  usePageTitle(customer?.partyName || 'Customer');

  if (loading) return <div className="page-body"><CardSkeleton height={320} /></div>;
  if (error || !customer) return <div className="page-body"><ErrorState message={error || 'Customer not found.'} onRetry={reload} /></div>;

  const custSales = (sales || []).filter((s) => s.customerId === id);
  const custPayments = (payments || []).filter((p) => p.partyId === id);
  const totalSales = custSales.reduce((a, s) => a + s.lines.reduce((x, l) => x + calcLine(l).total, 0), 0);
  const outstanding = custSales.reduce((a, s) => a + (s.lines.reduce((x, l) => x + calcLine(l).total, 0) - (s.amountReceived || 0)), 0) + Number(customer.openingOutstanding || 0);

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Customers', to: '/customers' }, { label: customer.partyName }]} />
      <PageHeader
        title={customer.partyName}
        description={`${customer.type} · ${customer.city || ''} ${customer.mobile ? '· ' + customer.mobile : ''}`}
        actions={<>
          <button className="btn btn-secondary" onClick={() => navigate(`/customers/${id}/edit`)}>Edit Customer</button>
          <button className="btn btn-primary" onClick={() => navigate('/sales/new', { state: { customerId: id } })}>+ Create Invoice</button>
        </>}
      />

      <div className="stat-grid mb-6">
        <StatCard label="Total Sales" value={formatCurrency(totalSales)} icon="🧮" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon="📋" />
        <StatCard label="Invoices" value={custSales.length} icon="🧾" />
        <StatCard label="Status" value={<StatusBadge status={customer.status} />} icon="●" />
      </div>

      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Customer Profile</span></div>
        <div className="card-pad form-grid">
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>GSTIN</div><div className="mono">{customer.gstin || '-'}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>PAN</div><div className="mono">{customer.pan || '-'}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Drug Licence</div><div>{customer.drugLicence || '-'}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Payment Terms</div><div>{customer.paymentTerms}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Credit Limit</div><div>{formatCurrency(customer.creditLimit)}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Address</div><div>{customer.address}, {customer.city}, {customer.state} - {customer.pin}</div></div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Invoice History</span></div>
        <DataTable
          columns={[
            { key: 'invoiceNo', label: 'Invoice No', render: (r) => <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/sales/${r.id}`); }}>{r.invoiceNo}</a> },
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.lines.reduce((a, l) => a + calcLine(l).total, 0)) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={custSales}
          emptyTitle="No invoices yet."
          emptyDescription="This customer has no billing history."
        />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Payment History</span></div>
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'invoiceId', label: 'Against Invoice' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
            { key: 'mode', label: 'Mode' },
            { key: 'reference', label: 'Reference' },
          ]}
          rows={custPayments}
          emptyTitle="No payments recorded."
        />
      </div>
    </div>
  );
}
