import React from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { batchApi } from '../../api/batchApi.js';
import { productApi } from '../../api/productApi.js';
import { supplierApi } from '../../api/supplierApi.js';
import dayjs from 'dayjs';
import { formatCurrency, formatDate, daysBetween } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function BatchDetail() {
  const { id } = useParams();
  const { data: batch, loading, error, reload } = useAsync(() => batchApi.getById(id), [id]);
  const { data: products } = useAsync(() => productApi.list(), []);
  const { data: suppliers } = useAsync(() => supplierApi.list(), []);
  usePageTitle(batch?.batchNo || 'Batch');

  if (loading) return <div className="page-body"><CardSkeleton height={300} /></div>;
  if (error || !batch) return <div className="page-body"><ErrorState message={error || 'Batch not found.'} onRetry={reload} /></div>;

  const product = products?.find((p) => p.id === batch.productId);
  const supplier = suppliers?.find((s) => s.id === batch.supplierId);
  const daysToExpiry = daysBetween(dayjs(), batch.expDate);

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Batches', to: '/batches' }, { label: batch.batchNo }]} />
      <PageHeader title={`Batch ${batch.batchNo}`} description={product?.name || batch.productId} />
      <div className="stat-grid mb-6">
        <StatCard label="Current Qty" value={batch.currentQty} icon="📦" />
        <StatCard label="Stock Value" value={formatCurrency(batch.currentQty * batch.purchaseRate)} icon="₹" />
        <StatCard label="Days to Expiry" value={daysToExpiry >= 0 ? daysToExpiry : `Expired ${Math.abs(daysToExpiry)}d ago`} icon="⏳" />
        <StatCard label="Status" value={<StatusBadge status={batch.status} />} icon="●" />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Batch Information</span></div>
        <div className="card-pad form-grid">
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Product</div><div>{product?.name || '-'}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Manufacturer</div><div>{product?.manufacturer || '-'}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Mfg Date</div><div>{formatDate(batch.mfgDate)}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Expiry Date</div><div>{formatDate(batch.expDate)}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>MRP</div><div>{formatCurrency(batch.mrp)}</div></div>
          <div><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Purchase Source</div><div>{supplier?.company || '-'}</div></div>
        </div>
      </div>
    </div>
  );
}
