import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { purchaseApi } from '../../api/purchaseApi.js';
import { supplierApi } from '../../api/supplierApi.js';
import { productApi } from '../../api/productApi.js';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';

export default function PurchaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: purchase, loading, error, reload } = useAsync(() => purchaseApi.getById(id), [id]);
  const { data: suppliers } = useAsync(() => supplierApi.list(), []);
  const { data: products } = useAsync(() => productApi.list(), []);
  usePageTitle(purchase?.purchaseInvoiceNo || 'Purchase');

  if (loading) return <div className="page-body"><CardSkeleton height={320} /></div>;
  if (error || !purchase) return <div className="page-body"><ErrorState message={error || 'Purchase not found.'} onRetry={reload} /></div>;

  const supplier = suppliers?.find((s) => s.id === purchase.supplierId);
  const total = purchase.grandTotal || purchase.lines.reduce((a, l) => a + calcLine(l).total, 0);

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Purchases', to: '/purchases' }, { label: purchase.purchaseInvoiceNo }]} />
      <PageHeader title={purchase.purchaseInvoiceNo} description={`${supplier?.company || ''} · ${formatDate(purchase.purchaseDate)}`}
        actions={(
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <ExportActions pdfUrl={`/purchases/${id}/pdf`} filename={purchase.purchaseInvoiceNo || 'purchase'} />
            {purchase.status !== 'Cancelled' && (
              <button className="btn btn-secondary" onClick={() => navigate(`/purchases/${id}/edit`)}>Edit Purchase</button>
            )}
            <StatusBadge status={purchase.paymentStatus} />
          </div>
        )} />
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Pack</th>
                <th>Batch</th>
                <th>Mfg</th>
                <th>Expiry</th>
                <th>HSN</th>
                <th className="num">MRP</th>
                <th className="num">PTS (₹)</th>
                <th className="num">Qty</th>
                <th className="num">Free</th>
                <th className="num">Disc %</th>
                <th className="num">GST</th>
                <th className="num">Taxable</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.lines.map((l, i) => {
                const c = calcLine({ ...l, sameState: true });
                const p = products?.find((pr) => pr.id === l.productId);
                return (
                  <tr key={i}>
                    <td><strong>{l.productName || p?.name || l.productId}</strong></td>
                    <td>{l.pack || p?.pack || '-'}</td>
                    <td className="mono">{l.batchNo}</td>
                    <td>{l.mfgDate ? formatDate(l.mfgDate) : (l.mfg || '-')}</td>
                    <td>{formatDate(l.expDate)}</td>
                    <td>{l.hsn || p?.hsn || '-'}</td>
                    <td className="num">{formatCurrency(l.mrp || p?.mrp || 0)}</td>
                    <td className="num">{formatCurrency(l.pts || l.rate)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{l.qty}</td>
                    <td className="num">{l.freeQty || 0}</td>
                    <td className="num">{l.discountPct || 0}%</td>
                    <td className="num">{l.gstRate}%</td>
                    <td className="num">{formatCurrency(l.taxableValue || c.taxable)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{formatCurrency(l.total || c.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={13}><strong>Grand Total</strong></td>
                <td className="num" style={{ fontWeight: 700 }}>{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

