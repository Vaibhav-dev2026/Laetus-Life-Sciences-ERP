import React, { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import FormField from '../../components/common/FormField.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { saleApi } from '../../api/saleApi.js';
import { customerApi } from '../../api/customerApi.js';
import { productApi } from '../../api/productApi.js';
import { returnApi } from '../../api/returnApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

// Previously this page never called the backend at all — "Process Return"
// only pushed a fake row into local React state, showed a false success
// message, and lost the fake row on refresh. No stock was ever reversed, no
// ledger entry was ever posted, no SalesReturn document ever existed. It now
// actually calls POST /api/returns/sales, which was already fully
// implemented and working on the backend the whole time.
export default function SalesReturn() {
  usePageTitle('Sales Return');
  const toast = useToast();
  const { data: sales } = useAsync(() => saleApi.list(), []);
  const { data: customers } = useAsync(() => customerApi.list(), []);
  const { data: products } = useAsync(() => productApi.list(), []);
  const { data: returns, loading: returnsLoading, reload: reloadReturns } = useAsync(() => returnApi.listSalesReturns(), []);
  const [invoiceId, setInvoiceId] = useState('');
  const [lineId, setLineId] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const invoice = sales?.find((s) => s.id === invoiceId);
  const customer = customers?.find((c) => c.id === invoice?.customerId);
  const lineIndex = invoice?.lines.findIndex((l, i) => `${invoiceId}-${i}` === lineId);
  const line = lineIndex != null && lineIndex >= 0 ? invoice?.lines[lineIndex] : undefined;

  const previouslyReturned = (line && returns)
    ? returns.filter((r) => r.saleId === invoiceId && r.productId === line.productId && r.batchId === line.batchId).reduce((a, b) => a + Number(b.qty || 0), 0)
    : 0;
  const maxReturnable = line ? Math.max(0, line.qty - previouslyReturned) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!invoice || !line) { toast.error('Select an invoice and product line to return.'); return; }
    if (!returnQty || Number(returnQty) <= 0) { toast.error('Enter a valid return quantity.'); return; }
    if (Number(returnQty) > maxReturnable) {
      toast.error(`Return quantity (${returnQty}) exceeds available returnable quantity (${maxReturnable}).`);
      return;
    }
    setSubmitting(true);
    try {
      await returnApi.createSalesReturn({ saleId: invoiceId, lineIndex, qty: Number(returnQty), reason });
      toast.success('Sales return recorded — stock and customer ledger updated.');
      setInvoiceId(''); setLineId(''); setReturnQty(''); setReason('');
      reloadReturns();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not process this return.');
    } finally {
      setSubmitting(false);
    }
  }

  function productName(productId) { return products?.find((p) => p.id === productId)?.name || productId; }
  function customerName(customerId) { return customers?.find((c) => c.id === customerId)?.partyName || customerId; }

  return (
    <div className="page-body">
      <PageHeader title="Sales Return" description="Process a return against a previously billed invoice." />
      <form className="card card-pad mb-6" onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField label="Original Invoice" required>
            <select className="form-control" value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setLineId(''); }}>
              <option value="">Search / select invoice</option>
              {sales?.map((s) => <option key={s.id} value={s.id}>{s.invoiceNo} — {customerName(s.customerId)}</option>)}
            </select>
          </FormField>
          <FormField label="Customer"><input className="form-control" value={customer?.partyName || ''} disabled /></FormField>
          <FormField label="Product / Batch" required>
            <select className="form-control" value={lineId} onChange={(e) => setLineId(e.target.value)} disabled={!invoice}>
              <option value="">Select product line</option>
              {invoice?.lines.map((l, i) => {
                const retQty = returns ? returns.filter((r) => r.saleId === invoiceId && r.productId === l.productId && r.batchId === l.batchId).reduce((a, b) => a + Number(b.qty || 0), 0) : 0;
                const rem = Math.max(0, l.qty - retQty);
                return (
                  <option key={i} value={`${invoiceId}-${i}`} disabled={rem <= 0}>
                    {productName(l.productId)} — Batch {l.batchNo || l.batchId} (Available: {rem} / Sold: {l.qty})
                  </option>
                );
              })}
            </select>
          </FormField>
          <FormField label="Sold Qty / Max Returnable">
            <input className="form-control" value={line ? `Sold: ${line.qty} | Returned: ${previouslyReturned} | Available: ${maxReturnable}` : ''} disabled />
          </FormField>
          <FormField label="Return Quantity" required>
            <input type="number" min="1" max={maxReturnable} className="form-control" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} disabled={!line || maxReturnable <= 0} />
          </FormField>
          <FormField label="Return Reason">
            <select className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select reason</option>
              <option>Damaged in transit</option><option>Near expiry return</option><option>Wrong product delivered</option><option>Customer request</option>
            </select>
          </FormField>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Processing…' : 'Process Return'}</button>
        </div>
      </form>

      <div className="card">
        <div className="card-header"><span className="card-title">Recent Sales Returns</span></div>
        <DataTable
          columns={[
            { key: 'invoiceNo', label: 'Invoice' },
            { key: 'customerId', label: 'Customer', render: (r) => customerName(r.customerId) },
            { key: 'productId', label: 'Product', render: (r) => productName(r.productId) },
            { key: 'qty', label: 'Return Qty', align: 'right' },
            { key: 'reason', label: 'Reason' },
            { key: 'refundAmount', label: 'Credit / Refund', align: 'right', render: (r) => formatCurrency(r.refundAmount) },
            { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
          ]}
          rows={returns || []}
          loading={returnsLoading}
          emptyTitle="No sales returns processed yet."
        />
      </div>
    </div>
  );
}
