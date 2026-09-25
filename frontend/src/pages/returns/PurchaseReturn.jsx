import React, { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import FormField from '../../components/common/FormField.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { purchaseApi } from '../../api/purchaseApi.js';
import { supplierApi } from '../../api/supplierApi.js';
import { productApi } from '../../api/productApi.js';
import { returnApi } from '../../api/returnApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

// Same fix as SalesReturn.jsx — this page previously never called the
// backend at all; "Process Return" only faked a row in local state. It now
// actually calls POST /api/returns/purchases, which was already fully
// implemented and working on the backend the whole time.
export default function PurchaseReturn() {
  usePageTitle('Purchase Return');
  const toast = useToast();
  const { data: purchases } = useAsync(() => purchaseApi.list(), []);
  const { data: suppliers } = useAsync(() => supplierApi.list(), []);
  const { data: products } = useAsync(() => productApi.list(), []);
  const { data: returns, loading: returnsLoading, reload: reloadReturns } = useAsync(() => returnApi.listPurchaseReturns(), []);
  const [purchaseId, setPurchaseId] = useState('');
  const [lineId, setLineId] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const purchase = purchases?.find((p) => p.id === purchaseId);
  const supplier = suppliers?.find((s) => s.id === purchase?.supplierId);
  const lineIndex = purchase?.lines.findIndex((l, i) => `${purchaseId}-${i}` === lineId);
  const line = lineIndex != null && lineIndex >= 0 ? purchase?.lines[lineIndex] : undefined;

  const previouslyReturned = (line && returns)
    ? returns.filter((r) => r.purchaseId === purchaseId && r.productId === line.productId).reduce((a, b) => a + Number(b.qty || 0), 0)
    : 0;
  const maxReturnable = line ? Math.max(0, line.qty - previouslyReturned) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!purchase || !line) { toast.error('Select a purchase and product line to return.'); return; }
    if (!returnQty || Number(returnQty) <= 0 || Number(returnQty) > maxReturnable) {
      toast.error(`Enter a valid return quantity (cannot exceed available returnable quantity of ${maxReturnable}).`);
      return;
    }
    setSubmitting(true);
    try {
      await returnApi.createPurchaseReturn({ purchaseId, lineIndex, qty: Number(returnQty), reason });
      toast.success('Purchase return recorded — stock and supplier ledger updated.');
      setPurchaseId(''); setLineId(''); setReturnQty(''); setReason('');
      reloadReturns();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not process this return.');
    } finally {
      setSubmitting(false);
    }
  }

  function productName(productId) { return products?.find((p) => p.id === productId)?.name || productId; }
  function supplierName(supplierId) { return suppliers?.find((s) => s.id === supplierId)?.company || supplierId; }

  return (
    <div className="page-body">
      <PageHeader title="Purchase Return" description="Return stock to a supplier against a purchase invoice." />
      <form className="card card-pad mb-6" onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField label="Original Purchase" required>
            <select className="form-control" value={purchaseId} onChange={(e) => { setPurchaseId(e.target.value); setLineId(''); }}>
              <option value="">Search / select purchase</option>
              {purchases?.map((p) => <option key={p.id} value={p.id}>{p.purchaseInvoiceNo} — {supplierName(p.supplierId)}</option>)}
            </select>
          </FormField>
          <FormField label="Supplier"><input className="form-control" value={supplier?.company || ''} disabled /></FormField>
          <FormField label="Product / Batch" required>
            <select className="form-control" value={lineId} onChange={(e) => setLineId(e.target.value)} disabled={!purchase}>
              <option value="">Select product line</option>
              {purchase?.lines.map((l, i) => {
                const retQty = returns ? returns.filter((r) => r.purchaseId === purchaseId && r.productId === l.productId).reduce((a, b) => a + Number(b.qty || 0), 0) : 0;
                const rem = Math.max(0, l.qty - retQty);
                return (
                  <option key={i} value={`${purchaseId}-${i}`} disabled={rem <= 0}>
                    {productName(l.productId)} — Batch {l.batchNo} (Available: {rem} / Purchased: {l.qty})
                  </option>
                );
              })}
            </select>
          </FormField>
          <FormField label="Purchased Qty / Max Returnable">
            <input className="form-control" value={line ? `Purchased: ${line.qty} | Returned: ${previouslyReturned} | Available: ${maxReturnable}` : ''} disabled />
          </FormField>
          <FormField label="Return Quantity" required>
            <input type="number" min="1" max={maxReturnable} className="form-control" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} disabled={!line || maxReturnable <= 0} />
          </FormField>
          <FormField label="Reason">
            <select className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select reason</option>
              <option>Damaged stock</option><option>Wrong item supplied</option><option>Near expiry</option><option>Quality issue</option>
            </select>
          </FormField>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Processing…' : 'Process Return'}</button>
        </div>
      </form>
      <div className="card">
        <div className="card-header"><span className="card-title">Recent Purchase Returns</span></div>
        <DataTable
          columns={[
            { key: 'purchaseInvoiceNo', label: 'Purchase' },
            { key: 'supplierId', label: 'Supplier', render: (r) => supplierName(r.supplierId) },
            { key: 'productId', label: 'Product', render: (r) => productName(r.productId) },
            { key: 'qty', label: 'Return Qty', align: 'right' },
            { key: 'reason', label: 'Reason' },
            { key: 'payableAdjustment', label: 'Payable Adjustment', align: 'right', render: (r) => formatCurrency(r.payableAdjustment) },
            { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
          ]}
          rows={returns || []}
          loading={returnsLoading}
          emptyTitle="No purchase returns processed yet."
        />
      </div>
    </div>
  );
}
