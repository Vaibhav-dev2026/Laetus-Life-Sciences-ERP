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
import { supplierApi } from '../../api/supplierApi.js';
import { purchaseApi } from '../../api/purchaseApi.js';
import { paymentApi } from '../../api/paymentApi.js';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: supplier, loading, error, reload } = useAsync(() => supplierApi.getById(id), [id]);
  const { data: purchases } = useAsync(() => purchaseApi.list(), []);
  const { data: payments } = useAsync(() => paymentApi.list(), []);
  usePageTitle(supplier?.company || 'Supplier');

  if (loading) return <div className="page-body"><CardSkeleton height={320} /></div>;
  if (error || !supplier) return <div className="page-body"><ErrorState message={error || 'Supplier not found.'} onRetry={reload} /></div>;

  const supPurchases = (purchases || []).filter((p) => p.supplierId === id);
  const supPayments = (payments || []).filter((p) => p.partyId === id);
  const totalPurchase = supPurchases.reduce((a, p) => a + p.lines.reduce((x, l) => x + calcLine(l).total, 0), 0);

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Suppliers', to: '/suppliers' }, { label: supplier.company }]} />
      <PageHeader title={supplier.company} description={`${supplier.contact || ''} · ${supplier.city || ''}`}
        actions={<button className="btn btn-secondary" onClick={() => navigate(`/suppliers/${id}/edit`)}>Edit Supplier</button>} />

      <div className="stat-grid mb-6">
        <StatCard label="Total Purchases" value={formatCurrency(totalPurchase)} icon="🧾" />
        <StatCard label="Payable" value={formatCurrency(supplier.openingPayable)} icon="📕" />
        <StatCard label="Purchase Orders" value={supPurchases.length} icon="📦" />
        <StatCard label="Status" value={<StatusBadge status={supplier.status} />} icon="●" />
      </div>

      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Purchase History</span></div>
        <DataTable
          columns={[
            { key: 'purchaseInvoiceNo', label: 'Purchase Invoice' },
            { key: 'purchaseDate', label: 'Date', render: (r) => formatDate(r.purchaseDate) },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.lines.reduce((a, l) => a + calcLine(l).total, 0)) },
            { key: 'paymentStatus', label: 'Status', render: (r) => <StatusBadge status={r.paymentStatus} /> },
          ]}
          rows={supPurchases}
          emptyTitle="No purchases recorded."
        />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Payments Made</span></div>
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'invoiceId', label: 'Against Invoice' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
            { key: 'mode', label: 'Mode' },
          ]}
          rows={supPayments}
          emptyTitle="No payments recorded."
        />
      </div>
    </div>
  );
}
