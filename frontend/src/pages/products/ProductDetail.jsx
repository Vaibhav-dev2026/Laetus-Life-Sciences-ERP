import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { productApi } from '../../api/productApi.js';
import { batchApi } from '../../api/batchApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: product, loading, error, reload } = useAsync(() => productApi.getById(id), [id]);
  const { data: batches } = useAsync(() => batchApi.list(), []);
  usePageTitle(product?.name || 'Product');

  if (loading) return <div className="page-body"><CardSkeleton height={300} /></div>;
  if (error || !product) return <div className="page-body"><ErrorState message={error || 'Product not found.'} onRetry={reload} /></div>;

  const productBatches = (batches || []).filter((b) => b.productId === id);
  const stockValue = productBatches.reduce((a, b) => a + b.currentQty * b.purchaseRate, 0);

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Products', to: '/products' }, { label: product.name }]} />
      <PageHeader title={product.name} description={`${product.genericName || ''} · ${product.sku}`}
        actions={<button className="btn btn-secondary" onClick={() => navigate(`/products/${id}/edit`)}>Edit Product</button>} />
      <div className="stat-grid mb-6">
        <StatCard label="Current Stock" value={product.currentStock} icon="📦" />
        <StatCard label="Stock Value" value={formatCurrency(stockValue)} icon="₹" />
        <StatCard label="MRP" value={formatCurrency(product.mrp)} icon="🏷️" />
        <StatCard label="GST Rate" value={`${product.gstRate}%`} icon="🧷" />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Batches</span></div>
        <DataTable
          columns={[
            { key: 'batchNo', label: 'Batch Number', className: 'mono' },
            { key: 'expDate', label: 'Expiry', render: (r) => formatDate(r.expDate) },
            { key: 'currentQty', label: 'Qty', align: 'right' },
            { key: 'saleRate', label: 'Rate', align: 'right', render: (r) => formatCurrency(r.saleRate) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={productBatches}
          emptyTitle="No batches recorded for this product."
        />
      </div>
    </div>
  );
}
