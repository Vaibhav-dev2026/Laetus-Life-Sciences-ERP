import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import Modal from '../../components/common/Modal.jsx';
import FormField from '../../components/common/FormField.jsx';
import InvoiceTotals from '../../components/invoice/InvoiceTotals.jsx';
import InvoicePreview from '../../components/invoice/InvoicePreview.jsx';
import InvoiceActions from '../../components/invoice/InvoiceActions.jsx';
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

const EXPIRY_POLICY = 'Warn'; // 'Block' | 'Warn' — configurable via Company Settings

export default function SalesInvoiceForm() {
  usePageTitle('New Sales Invoice');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const { data: customers, reload: reloadCustomers } = useAsync(() => customerApi.list({ limit: 1000 }), []);
  const { data: products, reload: reloadProducts } = useAsync(() => productApi.list({ limit: 1000 }), []);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customer, setCustomer] = useState(null);
  const [productQuery, setProductQuery] = useState('');

  const [batchPickerProduct, setBatchPickerProduct] = useState(null);
  const [productBatches, setProductBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [expiredWarnBatch, setExpiredWarnBatch] = useState(null);
  const [lines, setLines] = useState([]);
  const [amountReceived, setAmountReceived] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Stable per-form-open idempotency key — prevents duplicate invoices on double-click / retry
  const idempotencyKeyRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sale-${Date.now()}-${Math.random()}`
  );

  useEffect(() => {
    reloadCustomers();
    reloadProducts();
  }, []);

  useEffect(() => {
    const presetId = location.state?.customerId;
    if (presetId && customers) {
      const c = customers.find((c) => c.id === presetId);
      if (c) setCustomer(c);
    }
  }, [location.state, customers]);

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
    if (batch.status === 'Expired') {
      if (EXPIRY_POLICY === 'Block') { toast.error('This batch has expired and cannot be sold.'); return; }
      setExpiredWarnBatch({ product, batch });
      return;
    }
    commitLine(product, batch);
  }

  function commitLine(product, batch) {
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
      gstRate: typeof product.gstRate === 'number' ? product.gstRate : 12,
      maxQty: batch.currentQty,
    }]);
    setBatchPickerProduct(null);
    setExpiredWarnBatch(null);
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
  const paymentStatus = received <= 0 ? 'Unpaid' : received >= totals.grandTotal ? 'Paid' : 'Partial';

  async function handleSave() {
    if (!customer) { toast.error('Please select a customer.'); return; }
    if (computed.length === 0) { toast.error('Add at least one product line before saving.'); return; }
    setSaving(true);
    try {
      await saleApi.create({
        customerId: customer.id,
        date: dayjs().format('YYYY-MM-DD'),
        dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
        lines: computed.map(({ rowId, gross, discountAmt, taxable, cgst, sgst, igst, gstAmt, total, maxQty, ...rest }) => rest),
        amountReceived: received,
        idempotencyKey: idempotencyKeyRef.current,
      });
      toast.success('Invoice saved successfully.');
      navigate('/sales');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Unable to save invoice.');
    } finally {
      setSaving(false);
    }
  }

  const previewInvoice = { invoiceNo: 'PREVIEW', date: dayjs().format('YYYY-MM-DD'), dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'), lines: computed };

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Sales / Billing', to: '/sales' }, { label: 'New Invoice' }]} />
      <PageHeader title="New Sales Invoice" description="Fast, keyboard-friendly GST billing." />

      <div className="billing-grid">
        <div>
          {/* Customer selection */}
          <div className="card card-pad mb-4">
            <div className="card-title mb-3">Customer</div>
            {!customer ? (
              <div style={{ position: 'relative' }}>
                <SearchBox value={customerQuery} onChange={setCustomerQuery} placeholder="Search customer by name, doctor, clinic, mobile, GSTIN…" />
                {customerMatches.length > 0 && (
                  <div className="customer-search-result">
                    {customerMatches.map((c) => (
                      <button type="button" key={c.id} onClick={() => pickCustomer(c)}>
                        <strong>{c.partyName}</strong> — {c.type} · {c.mobile} {c.gstin ? `· ${c.gstin}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <select className="form-control" value="" onChange={(e) => {
                    const c = customers?.find((item) => item.id === e.target.value);
                    if (c) pickCustomer(c);
                  }}>
                    <option value="">-- Or select customer from dropdown list --</option>
                    {customers?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.partyName} ({c.type}) {c.mobile ? `· ${c.mobile}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="customer-picked-card">
                <div className="flex-between">
                  <div>
                    <strong>{customer.partyName}</strong> <span className="text-muted">({customer.type})</span>
                    <div className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{customer.address}, {customer.city}, {customer.state}</div>
                    <div className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{customer.mobile} {customer.gstin ? `· GSTIN: ${customer.gstin}` : '· Non-GST'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Outstanding</div>
                    <div style={{ fontWeight: 700 }}>{formatCurrency(customer.openingOutstanding)}</div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomer(null)}>Change</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product selection: Dropdown + Search Box */}
          <div className="card card-pad mb-4">
            <div className="card-title mb-3">Add Product to Invoice</div>
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
                <div className="product-search-wrap">
                  <SearchBox value={productQuery} onChange={setProductQuery} placeholder="Type product name (e.g. L COUGH D), SKU, HSN…" />
                  {productMatches.length > 0 && (
                    <div className="customer-search-result">
                      {productMatches.map((p) => (
                        <button type="button" key={p.id} onClick={() => openBatchPicker(p)}>
                          <strong>{p.name}</strong> — {p.genericName} · {p.pack} · MRP {formatCurrency(p.mrp)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>
            </div>
          </div>

          {/* Line editor */}
          <div className="card card-pad">
            <div className="card-title mb-3">Invoice Lines</div>
            {computed.length === 0 ? (
              <p className="text-muted">No products added yet. Select or search a product above to add to invoice.</p>
            ) : (
              <div className="table-wrap">
                <table className="line-editor-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Pack</th>
                      <th>Batch</th>
                      <th>Exp</th>
                      <th>HSN</th>
                      <th>MRP</th>
                      <th>Qty</th>
                      <th>Free</th>
                      <th>Rate (PTR)</th>
                      <th>Disc %</th>
                      <th>GST %</th>
                      <th>Taxable</th>
                      <th>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.map((l) => (
                      <tr key={l.rowId}>
                        <td><strong>{l.productName}</strong></td>
                        <td>{l.pack}</td>
                        <td className="mono">{l.batchNo}</td>
                        <td>{formatDate(l.expDate)}</td>
                        <td>{l.hsn}</td>
                        <td className="amt">{formatCurrency(l.mrp)}</td>
                        <td><input type="number" min="1" max={l.maxQty} className="form-control num-input" value={l.qty} onChange={(e) => updateLine(l.rowId, { qty: Number(e.target.value) || 0 })} /></td>
                        <td><input type="number" min="0" className="form-control num-input" style={{ width: 58 }} value={l.freeQty} onChange={(e) => updateLine(l.rowId, { freeQty: Number(e.target.value) || 0 })} /></td>
                        <td><input type="number" min="0" step="0.01" className="form-control num-input" value={l.rate} onChange={(e) => updateLine(l.rowId, { rate: Number(e.target.value) || 0 })} /></td>
                        <td><input type="number" min="0" max="100" step="0.5" className="form-control num-input" style={{ width: 58 }} value={l.discountPct} onChange={(e) => updateLine(l.rowId, { discountPct: Number(e.target.value) || 0 })} /></td>
                        <td>
                          <select
                            className="form-control num-input"
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
                        <td className="amt">{formatCurrency(l.taxable)}</td>
                        <td className="amt" style={{ fontWeight: 600 }}>{formatCurrency(l.total)}</td>
                        <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(l.rowId)} aria-label="Remove line">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="card card-pad sticky-summary">
          <div className="card-title mb-3">Payment &amp; Summary</div>
          <InvoiceTotals {...totals} />
          <div className="form-field mt-4">
            <label>Amount Received (₹)</label>
            <input type="number" min="0" className="form-control" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
          </div>
          <div className="flex-between mt-3">
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>Payment Status</span>
            <strong>{paymentStatus}</strong>
          </div>
          <InvoiceActions
            saving={saving}
            onSave={handleSave}
            onSaveAndPreview={() => setPreviewOpen(true)}
            onCancel={() => navigate('/sales')}
          />
        </div>
      </div>

      {/* Batch picker modal */}
      <Modal open={!!batchPickerProduct} title={batchPickerProduct ? `Select Batch — ${batchPickerProduct.name}` : ''} onClose={() => setBatchPickerProduct(null)}>
        {loadingBatches ? (
          <p className="text-muted p-3 text-center">Fetching live stock batches from database…</p>
        ) : productBatches.length === 0 ? (
          <div className="empty-state p-4 text-center">
            <p className="text-muted mb-2">No stock batches found for <strong>{batchPickerProduct?.name}</strong>.</p>
            <p style={{ fontSize: '0.85rem' }} className="text-muted">Inward stock via <strong>Purchases → New Purchase</strong> to add available batches for billing.</p>
          </div>
        ) : (
          <table className="batch-picker-table">
            <thead>
              <tr>
                <th>Batch No</th>
                <th>Expiry</th>
                <th>Stock Qty</th>
                <th>MRP</th>
                <th>Rate (PTR)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {productBatches.map((b) => {
                const isExpired = b.status === 'Expired';
                const isOut = b.currentQty === 0;
                const disabled = isOut || (isExpired && EXPIRY_POLICY === 'Block');
                return (
                  <tr key={b.id} className={disabled ? 'disabled' : ''}>
                    <td className="mono"><strong>{b.batchNo}</strong></td>
                    <td>{formatDate(b.expDate)}</td>
                    <td><strong>{b.currentQty}</strong></td>
                    <td>{formatCurrency(b.mrp)}</td>
                    <td>{formatCurrency(b.saleRate || b.ptr)}</td>
                    <td><span className={`status-badge status-${(b.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{isOut ? 'Out of Stock' : b.status}</span></td>
                    <td>
                      <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => !disabled && addLineFromBatch(batchPickerProduct, b)}>
                        Select Batch
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Modal>

      {/* Expired-batch warn confirmation */}
      <Modal open={!!expiredWarnBatch} title="Expired batch selected" onClose={() => setExpiredWarnBatch(null)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setExpiredWarnBatch(null)}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={() => commitLine(expiredWarnBatch.product, expiredWarnBatch.batch)}>Add Anyway</button>
        </>}>
        <p>Batch <strong>{expiredWarnBatch?.batch.batchNo}</strong> expired on {formatDate(expiredWarnBatch?.batch.expDate)}. Are you sure you want to bill this batch?</p>
      </Modal>

      {/* Invoice preview modal */}
      <Modal open={previewOpen} title="Invoice Preview" size="lg" onClose={() => setPreviewOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setPreviewOpen(false)}>Close</button>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Confirm & Save'}</button>
        </>}>
        <InvoicePreview invoice={previewInvoice} customer={customer} />
      </Modal>
    </div>
  );
}
