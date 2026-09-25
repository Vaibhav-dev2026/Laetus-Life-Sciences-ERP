import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import Modal from '../../components/common/Modal.jsx';
import FormField from '../../components/common/FormField.jsx';
import InvoiceTotals from '../../components/invoice/InvoiceTotals.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { customerApi } from '../../api/customerApi.js';
import { productApi } from '../../api/productApi.js';
import { batchApi } from '../../api/batchApi.js';
import { saleApi } from '../../api/saleApi.js';
import { calcLine, sumLines } from '../../utils/gst.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { nextId } from '../../utils/id.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import './billing.css';

export default function SalesInvoiceEditForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  usePageTitle('Edit Invoice');

  const { data: invoice, loading: invoiceLoading, error: invoiceError } = useAsync(() => saleApi.getById(id), [id]);
  const { data: customers, reload: reloadCustomers } = useAsync(() => customerApi.list({ limit: 1000 }), []);
  const { data: products, reload: reloadProducts } = useAsync(() => productApi.list({ limit: 1000 }), []);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customer, setCustomer] = useState(null);
  const [productQuery, setProductQuery] = useState('');

  const [batchPickerProduct, setBatchPickerProduct] = useState(null);
  const [productBatches, setProductBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [lines, setLines] = useState([]);
  const [amountReceived, setAmountReceived] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    reloadCustomers();
    reloadProducts();
  }, []);

  // Populate form once invoice and customers are loaded
  useEffect(() => {
    if (invoice && customers && products && !initialized) {
      const c = customers.find((c) => c.id === invoice.customerId);
      setCustomer(c || null);
      setAmountReceived(String(invoice.amountReceived || ''));
      setLines(
        (invoice.lines || []).map((l) => {
          const prod = products.find((p) => p.id === l.productId);
          return {
            rowId: nextId('ROW'),
            productId: l.productId,
            productName: l.productName || prod?.name || l.productId,
            pack: l.pack || prod?.pack || '-',
            mfg: l.mfg || prod?.mfg || '-',
            batchId: l.batchId,
            batchNo: l.batchNo || '',
            expDate: l.expDate || '',
            hsn: l.hsn || prod?.hsn || '-',
            mrp: l.mrp ?? 0,
            qty: Number(l.qty) || 1,
            freeQty: Number(l.freeQty) || 0,
            rate: Number(l.rate) || 0,
            discountPct: Number(l.discountPct) || 0,
            gstRate: Number(l.gstRate) || 12,
            maxQty: 9999, // default generous edit cap
          };
        })
      );
      setInitialized(true);
    }
  }, [invoice, customers, products, initialized]);

  const customerMatches = useMemo(() => {
    if (!customerQuery.trim() || !customers) return [];
    const q = customerQuery.toLowerCase();
    return customers.filter((c) => [c.partyName, c.doctorName, c.organization, c.mobile, c.gstin, c.id].join(' ').toLowerCase().includes(q)).slice(0, 8);
  }, [customerQuery, customers]);

  const productMatches = useMemo(() => {
    if (!productQuery.trim() || !products) return [];
    const q = productQuery.toLowerCase();
    return products.filter((p) => [p.sku, p.name, p.genericName, p.hsn].join(' ').toLowerCase().includes(q)).slice(0, 8);
  }, [productQuery, products]);

  function pickCustomer(c) { setCustomer(c); setCustomerQuery(''); }

  async function openBatchPicker(product) {
    setBatchPickerProduct(product);
    setProductQuery('');
    setLoadingBatches(true);
    try {
      const fetched = await batchApi.list({ productId: product.id, limit: 1000 });
      setProductBatches(fetched || []);
    } catch (err) {
      toast.error('Failed to load batches for selected product.');
      setProductBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  }

  function addLineFromBatch(product, batch) {
    setLines((ls) => [...ls, {
      rowId: nextId('ROW'),
      productId: product.id,
      productName: product.name,
      pack: product.pack || '-',
      mfg: product.mfg || batch.mfg || '-',
      batchId: batch.id,
      batchNo: batch.batchNo,
      expDate: batch.expDate,
      hsn: product.hsn || '-',
      mrp: batch.mrp,
      qty: 1,
      freeQty: 0,
      rate: batch.saleRate || batch.ptr || 0,
      discountPct: 0,
      gstRate: product.gstRate || 12,
      maxQty: batch.currentQty,
    }]);
    setBatchPickerProduct(null);
  }

  function updateLine(rowId, patch) { setLines((ls) => ls.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l))); }
  function removeLine(rowId) { setLines((ls) => ls.filter((l) => l.rowId !== rowId)); }

  const sameState = (customer?.stateCode || '24') === '24';
  const computed = useMemo(() => lines.map((l) => ({ ...l, ...calcLine({ ...l, sameState }) })), [lines, sameState]);
  const totals = {
    beforeTax: sumLines(computed, 'gross'),
    discount: sumLines(computed, 'discountAmt'),
    cgst: sumLines(computed, 'cgst'),
    sgst: sumLines(computed, 'sgst'),
    igst: sumLines(computed, 'igst'),
    grandTotal: sumLines(computed, 'total'),
  };
  const received = Number(amountReceived || 0);
  const balance = totals.grandTotal - received;
  const paymentStatus = received <= 0 ? 'Unpaid' : received >= totals.grandTotal ? 'Paid' : 'Partial';

  async function handleUpdate() {
    if (!customer) { toast.error('Please select a customer.'); return; }
    if (computed.length === 0) { toast.error('Add at least one product line before saving.'); return; }
    setSaving(true);
    try {
      await saleApi.update(id, {
        customerId: customer.id,
        date: invoice?.date || dayjs().format('YYYY-MM-DD'),
        lines: computed.map(({ rowId, gross, discountAmt, taxable, cgst, sgst, igst, gstAmt, total, maxQty, ...rest }) => rest),
        amountReceived: received,
      });
      toast.success('Invoice updated. GST recalculated, stock and ledger reconciled.');
      navigate(`/sales/${id}`);
    } catch (err) {
      toast.error(err?.message || 'Unable to update invoice.');
    } finally {
      setSaving(false);
    }
  }

  if (invoiceLoading) return <div className="page-body"><CardSkeleton height={400} /></div>;
  if (invoiceError || !invoice) return <div className="page-body"><ErrorState message={invoiceError || 'Invoice not found.'} /></div>;
  if (invoice.status === 'Cancelled') return (
    <div className="page-body">
      <ErrorState message="This invoice is cancelled and cannot be edited." />
    </div>
  );

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Sales / Billing', to: '/sales' }, { label: invoice.invoiceNo, to: `/sales/${id}` }, { label: 'Edit' }]} />
      <PageHeader title={`Edit Invoice: ${invoice.invoiceNo}`} description="Modify rate, quantity, or lines. GST, stock and ledger will be reconciled." />

      {/* Customer */}
      <div className="card card-pad mb-4">
        <div className="form-label mb-2"><strong>Customer</strong></div>
        {customer ? (
          <div className="d-flex align-items-center gap-3">
            <span><strong>{customer.partyName}</strong>{customer.gstin ? ` — ${customer.gstin}` : ''}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCustomer(null)}>Change</button>
          </div>
        ) : (
          <div style={{ maxWidth: 450 }}>
            <SearchBox value={customerQuery} onChange={setCustomerQuery} placeholder="Search customer by name, mobile, GSTIN…" />
            {customerMatches.map((c) => (
              <div key={c.id} className="batch-row" onClick={() => pickCustomer(c)} style={{ cursor: 'pointer', padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>
                <strong>{c.partyName}</strong>{c.gstin ? <span className="text-muted ms-2">{c.gstin}</span> : null}
              </div>
            ))}
            <div className="mt-2">
              <select className="form-control" value="" onChange={(e) => {
                const c = customers?.find((item) => item.id === e.target.value);
                if (c) pickCustomer(c);
              }}>
                <option value="">-- Or select customer from list --</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.partyName} ({c.type}) {c.mobile ? `· ${c.mobile}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Lines Table */}
      <div className="card mb-4" style={{ overflowX: 'auto' }}>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Product</th><th>Pack</th><th>Batch</th><th>Expiry</th><th>HSN</th><th>MRP</th>
              <th>Qty</th><th>Free</th><th>Rate</th><th>Disc%</th><th>GST%</th>
              <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Amount</th><th></th>
            </tr>
          </thead>
          <tbody>
            {computed.map((l) => (
              <tr key={l.rowId}>
                <td>{l.productName}</td>
                <td><input className="form-control" style={{ width: 70 }} value={l.pack || ''} onChange={(e) => updateLine(l.rowId, { pack: e.target.value })} /></td>
                <td className="mono">{l.batchNo}</td>
                <td>{formatDate(l.expDate)}</td>
                <td className="mono">{l.hsn}</td>
                <td>{formatCurrency(l.mrp)}</td>
                <td><input type="number" className="form-control" style={{ width: 70 }} min={1} max={l.maxQty} value={l.qty} onChange={(e) => updateLine(l.rowId, { qty: Number(e.target.value) })} /></td>
                <td><input type="number" className="form-control" style={{ width: 60 }} min={0} value={l.freeQty} onChange={(e) => updateLine(l.rowId, { freeQty: Number(e.target.value) })} /></td>
                <td><input type="number" className="form-control" style={{ width: 80 }} min={0} step={0.01} value={l.rate} onChange={(e) => updateLine(l.rowId, { rate: Number(e.target.value) })} /></td>
                <td><input type="number" className="form-control" style={{ width: 65 }} min={0} max={100} step={0.01} value={l.discountPct} onChange={(e) => updateLine(l.rowId, { discountPct: Number(e.target.value) })} /></td>
                <td>
                  <select
                    className="form-control"
                    style={{ width: 72 }}
                    value={l.gstRate}
                    onChange={(e) => updateLine(l.rowId, { gstRate: Number(e.target.value) })}
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                    {![0, 5, 12, 18, 28].includes(Number(l.gstRate)) && (
                      <option value={l.gstRate}>{l.gstRate}%</option>
                    )}
                  </select>
                </td>
                <td className="text-end mono">{formatCurrency(l.taxableValue)}</td>
                <td className="text-end mono">{formatCurrency(l.cgst)}</td>
                <td className="text-end mono">{formatCurrency(l.sgst)}</td>
                <td className="text-end mono">{formatCurrency(l.igst)}</td>
                <td className="text-end mono"><strong>{formatCurrency(l.total)}</strong></td>
                <td><button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(l.rowId)}>✕</button></td>
              </tr>
            ))}
            {computed.length === 0 && (
              <tr><td colSpan={17} className="text-center text-muted py-3">No lines. Select or search a product below.</td></tr>
            )}
          </tbody>
        </table>

        {/* Add product */}
        <div className="card-pad border-top">
          <div className="form-label mb-2"><strong>Add Product to Invoice</strong></div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <FormField label="Select Product (Dropdown)">
              <select
                className="form-control"
                value=""
                onChange={(e) => {
                  const selected = products?.find((p) => p.id === e.target.value);
                  if (selected) openBatchPicker(selected);
                }}
              >
                <option value="">-- Choose Product from Dropdown List --</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''} {p.pack ? `· ${p.pack}` : ''} · MRP {formatCurrency(p.mrp)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Or Search Product by Name / SKU / HSN">
              <SearchBox value={productQuery} onChange={setProductQuery} placeholder="Search product by SKU, name, HSN…" />
              {productMatches.map((p) => (
                <div key={p.id} className="batch-row" onClick={() => openBatchPicker(p)} style={{ cursor: 'pointer', padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>
                  <strong>{p.name}</strong> <span className="text-muted">{p.sku}</span>
                </div>
              ))}
            </FormField>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="card card-pad mb-4" style={{ maxWidth: 400, marginLeft: 'auto' }}>
        <InvoiceTotals totals={totals} />
        <div className="form-row mt-3">
          <label className="form-label">Amount Received</label>
          <input type="number" className="form-control" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} min={0} step={0.01} />
        </div>
        <div className="mt-2 text-muted" style={{ fontSize: 13 }}>
          Balance: <strong>{formatCurrency(balance)}</strong> — Status: <strong>{paymentStatus}</strong>
        </div>
      </div>

      {/* Actions */}
      <div className="invoice-actions-bar no-print" style={{ gap: '0.5rem' }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/sales/${id}`)} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleUpdate} disabled={saving}>
          {saving ? 'Saving…' : 'Update Invoice'}
        </button>
      </div>

      {/* Batch Picker Modal */}
      <Modal open={!!batchPickerProduct} title={`Select Batch — ${batchPickerProduct?.name}`} onClose={() => setBatchPickerProduct(null)}>
        {loadingBatches ? (
          <p className="text-muted p-3 text-center">Fetching live stock batches from database…</p>
        ) : productBatches.length === 0 ? (
          <div className="empty-state p-4 text-center">
            <p className="text-muted mb-2">No stock batches found for <strong>{batchPickerProduct?.name}</strong>.</p>
            <p style={{ fontSize: '0.85rem' }} className="text-muted">Inward stock via <strong>Purchases → New Purchase</strong> to add available batches for billing.</p>
          </div>
        ) : (
          <table className="invoice-table">
            <thead>
              <tr><th>Batch No</th><th>Expiry</th><th>MRP</th><th>Rate</th><th>Qty</th><th>Action</th></tr>
            </thead>
            <tbody>
              {productBatches.map((b) => {
                const isOut = b.currentQty === 0;
                return (
                  <tr key={b.id} className={isOut ? 'disabled' : ''}>
                    <td className="mono">{b.batchNo}</td>
                    <td>{formatDate(b.expDate)}</td>
                    <td>{formatCurrency(b.mrp)}</td>
                    <td>{formatCurrency(b.saleRate || b.ptr)}</td>
                    <td><strong>{b.currentQty}</strong></td>
                    <td><button type="button" className="btn btn-primary btn-sm" disabled={isOut} onClick={() => !isOut && addLineFromBatch(batchPickerProduct, b)}>Select Batch</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
