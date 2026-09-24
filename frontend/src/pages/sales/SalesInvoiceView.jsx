import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import InvoicePreview from '../../components/invoice/InvoicePreview.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { saleApi } from '../../api/saleApi.js';
import { customerApi } from '../../api/customerApi.js';
import { productApi } from '../../api/productApi.js';
import ExportActions from '../../components/common/ExportActions.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function SalesInvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const { data: invoice, loading, error, reload } = useAsync(() => saleApi.getById(id), [id]);
  const { data: customers } = useAsync(() => customerApi.list(), []);
  const { data: products } = useAsync(() => productApi.list(), []);
  usePageTitle(invoice?.invoiceNo || 'Invoice');

  if (loading) return <div className="page-body"><CardSkeleton height={420} /></div>;
  if (error || !invoice) return <div className="page-body"><ErrorState message={error || 'Invoice not found.'} onRetry={reload} /></div>;

  const customer = customers?.find((c) => c.id === invoice.customerId);
  const enrichedLines = (invoice.lines || []).map((l) => {
    const p = products?.find((pp) => pp.id === l.productId);
    return { ...l, productName: p?.name || l.productId, hsn: l.hsn || p?.hsn, mfg: l.mfg || p?.mfg || '-' };
  });

  const isCancelled = invoice.status === 'Cancelled';

  async function handleCancelConfirm() {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason.');
      return;
    }
    setCancelling(true);
    try {
      await saleApi.cancel(id, cancelReason.trim());
      toast.success('Invoice cancelled. Stock and ledger reversed.');
      setShowCancel(false);
      reload();
    } catch (err) {
      toast.error(err.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Sales / Billing', to: '/sales' }, { label: invoice.invoiceNo }]} />
      <PageHeader
        title={invoice.invoiceNo}
        description={customer?.partyName || 'Tax Invoice'}
        actions={(
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <ExportActions
              pdfUrl={`/sales/${id}/pdf`}
              filename={invoice.invoiceNo || 'invoice'}
              params={{ id }}
            />
            {!isCancelled && (
              <button
                className="btn btn-secondary no-print"
                onClick={() => navigate(`/sales/${id}/edit`)}
              >
                Edit Invoice
              </button>
            )}
            {!isCancelled && (
              <button
                className="btn btn-danger no-print"
                onClick={() => setShowCancel(true)}
              >
                Cancel Invoice
              </button>
            )}
          </div>
        )}
      />

      <div style={{ margin: '1.5rem 0' }}>
        <InvoicePreview invoice={{ ...invoice, lines: enrichedLines }} customer={customer} />
      </div>

      <ConfirmDialog
        isOpen={showCancel}
        title="Cancel Invoice?"
        message={`Are you sure you want to cancel ${invoice.invoiceNo}? This will restore deducted stock batches and reverse the customer ledger entry.`}
        confirmLabel="Yes, Cancel Invoice"
        danger
        loading={cancelling}
        onConfirm={handleCancelConfirm}
        onCancel={() => setShowCancel(false)}
      >
        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Reason for cancellation</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. Billed wrong customer, order cancelled"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
