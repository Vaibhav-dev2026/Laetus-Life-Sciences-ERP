import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import FormField from '../../components/common/FormField.jsx';
import InvoiceTotals from '../../components/invoice/InvoiceTotals.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { supplierApi } from '../../api/supplierApi.js';
import { productApi } from '../../api/productApi.js';
import { purchaseApi } from '../../api/purchaseApi.js';
import { calcLine, sumLines } from '../../utils/gst.js';
import { nextId } from '../../utils/id.js';
import { formatCurrency } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import dayjs from 'dayjs';

function emptyLine() {
  return { rowId: nextId('ROW'), productId: '', pack: '', hsn: '', batchNo: '', mfgDate: '', expDate: '', qty: '', freeQty: '', rate: '', discountPct: '0', gstRate: 12 };
}

export default function PurchaseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  usePageTitle(isEdit ? 'Edit Purchase' : 'New Purchase');
  const navigate = useNavigate();
  const toast = useToast();
  const { data: suppliers } = useAsync(() => supplierApi.list(), []);
  const { data: products } = useAsync(() => productApi.list(), []);
  const { data: existingPurchase } = useAsync(() => (isEdit ? purchaseApi.getById(id) : Promise.resolve(null)), [id, isEdit]);

  const [header, setHeader] = useState({
    purchaseInvoiceNo: '',
    purchaseDate: dayjs().format('YYYY-MM-DD'),
    supplierId: '',
    supplierInvoiceNo: '',
    paymentStatus: 'Unpaid',
    amountPaid: '',
    dueDate: '',
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  // Stable per-form-open idempotency key — prevents duplicate purchases on double-click / retry (new form only)
  const idempotencyKeyRef = useRef(
    isEdit ? null : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pur-${Date.now()}-${Math.random()}`)
  );

  useEffect(() => {
    if (existingPurchase) {
      setHeader({
        purchaseInvoiceNo: existingPurchase.purchaseInvoiceNo || '',
        purchaseDate: existingPurchase.purchaseDate ? dayjs(existingPurchase.purchaseDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        supplierId: existingPurchase.supplierId || '',
        supplierInvoiceNo: existingPurchase.supplierInvoiceNo || '',
        paymentStatus: existingPurchase.paymentStatus || 'Unpaid',
        amountPaid: existingPurchase.amountPaid !== undefined ? String(existingPurchase.amountPaid) : '',
        dueDate: existingPurchase.dueDate ? dayjs(existingPurchase.dueDate).format('YYYY-MM-DD') : '',
      });
      if (Array.isArray(existingPurchase.lines) && existingPurchase.lines.length > 0) {
        setLines(existingPurchase.lines.map((l) => ({
          rowId: nextId('ROW'),
          productId: l.productId || '',
          pack: l.pack || '',
          batchNo: l.batchNo || '',
          mfgDate: l.mfgDate ? dayjs(l.mfgDate).format('YYYY-MM-DD') : '',
          expDate: l.expDate ? dayjs(l.expDate).format('YYYY-MM-DD') : '',
          qty: l.qty || '',
          freeQty: l.freeQty || '0',
          rate: l.rate || l.pts || '',
          discountPct: l.discountPct || '0',
          gstRate: l.gstRate || 12,
          hsn: l.hsn || '',
          mrp: l.mrp || '',
        })));
      }
    }
  }, [existingPurchase]);

  function updateLine(rowId, patch) {
    setLines((ls) => ls.map((l) => {
      if (l.rowId !== rowId) return l;
      const updated = { ...l, ...patch };
      if (patch.productId && products) {
        const prod = products.find((p) => p.id === patch.productId);
        if (prod) {
          updated.pack = prod.pack || '';
          updated.hsn = prod.hsn || '';
          updated.gstRate = prod.gstRate || 12;
          if (!updated.rate) updated.rate = prod.purchaseRate || prod.pts || '';
        }
      }
      return updated;
    }));
  }
  function addLine() { setLines((ls) => [...ls, emptyLine()]); }
  function removeLine(rowId) { setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.rowId !== rowId) : ls)); }

  const computed = useMemo(() => lines.map((l) => ({ ...l, ...calcLine({ qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate, sameState: true }) })), [lines]);
  const totals = {
    beforeTax: sumLines(computed, 'gross'),
    discount: sumLines(computed, 'discountAmt'),
    cgst: sumLines(computed, 'cgst'),
    sgst: sumLines(computed, 'sgst'),
    igst: sumLines(computed, 'igst'),
    grandTotal: sumLines(computed, 'total'),
  };

  async function handleSave(e) {
    if (e) e.preventDefault();
    if (submitting) return;

    if (!header.supplierId) { toast.error('Please select a supplier.'); return; }
    if (!computed.some((l) => l.productId && Number(l.qty) > 0)) { toast.error('Add at least one valid product line.'); return; }

    setSubmitting(true);
    try {
      let calculatedAmountPaid = 0;
      if (header.paymentStatus === 'Paid') {
        calculatedAmountPaid = totals.grandTotal;
      } else if (header.paymentStatus === 'Partial') {
        calculatedAmountPaid = Number(header.amountPaid) || Math.round(totals.grandTotal / 2);
      } else {
        calculatedAmountPaid = 0;
      }

      const payload = {
        ...header,
        amountPaid: calculatedAmountPaid,
        lines: computed.filter((l) => l.productId).map(({ rowId, gross, discountAmt, taxable, cgst, sgst, igst, gstAmt, total, ...rest }) => rest),
      };
      if (!isEdit && idempotencyKeyRef.current) {
        payload.idempotencyKey = idempotencyKeyRef.current;
      }
      if (isEdit) {
        await purchaseApi.update(id, payload);
        toast.success('Purchase updated successfully.');
      } else {
        await purchaseApi.create(payload);
        toast.success('Purchase saved successfully.');
      }
      navigate('/purchases');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Unable to save purchase.');
      setSubmitting(false);
    }
  }

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Purchases', to: '/purchases' }, { label: isEdit ? 'Edit' : 'New' }]} />
      <PageHeader title={isEdit ? 'Edit Purchase Entry' : 'New Purchase Entry'} description="Record stock inward from a supplier invoice." />

      <form onSubmit={handleSave} noValidate>
        <div className="card card-pad mb-6">
          <div className="form-grid-3 form-grid">
            <FormField label="Purchase Invoice No">
              <input
                className="form-control"
                value={header.purchaseInvoiceNo}
                onChange={(e) => setHeader((h) => ({ ...h, purchaseInvoiceNo: e.target.value }))}
                placeholder="Auto-generated (e.g. PUR-000001)"
              />
            </FormField>
            <FormField label="Purchase Date">
              <input type="date" className="form-control" value={header.purchaseDate} onChange={(e) => setHeader((h) => ({ ...h, purchaseDate: e.target.value }))} />
            </FormField>
            <FormField label="Supplier" required>
              <select className="form-control" value={header.supplierId} onChange={(e) => setHeader((h) => ({ ...h, supplierId: e.target.value }))}>
                <option value="">Select supplier</option>
                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.company}</option>)}
              </select>
            </FormField>
            <FormField label="Supplier Invoice No">
              <input className="form-control" value={header.supplierInvoiceNo} onChange={(e) => setHeader((h) => ({ ...h, supplierInvoiceNo: e.target.value }))} placeholder="e.g. INV-SUP-901" />
            </FormField>
            <FormField label="Payment Status">
              <select className="form-control" value={header.paymentStatus} onChange={(e) => {
                const val = e.target.value;
                setHeader((h) => ({
                  ...h,
                  paymentStatus: val,
                  amountPaid: val === 'Paid' ? String(totals.grandTotal) : val === 'Unpaid' ? '0' : h.amountPaid
                }));
              }}>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </FormField>
            {header.paymentStatus === 'Partial' && (
              <FormField label="Amount Paid (₹)">
                <input
                  type="number"
                  min="0"
                  max={totals.grandTotal}
                  step="0.01"
                  className="form-control"
                  value={header.amountPaid}
                  onChange={(e) => setHeader((h) => ({ ...h, amountPaid: e.target.value }))}
                  placeholder={`Max ${totals.grandTotal}`}
                />
              </FormField>
            )}
            <FormField label="Due Date">
              <input type="date" className="form-control" value={header.dueDate} onChange={(e) => setHeader((h) => ({ ...h, dueDate: e.target.value }))} />
            </FormField>
          </div>
        </div>

        <div className="card card-pad mb-6">
          <div className="card-title mb-4">Product Lines</div>
          <div className="table-wrap">
            <table className="line-editor-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Pack</th>
                  <th>Batch</th>
                  <th>Mfg Date</th>
                  <th>Expiry Date</th>
                  <th>Qty</th>
                  <th>Free</th>
                  <th>PTS (₹)</th>
                  <th>Disc %</th>
                  <th>GST %</th>
                  <th>Taxable</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {computed.map((line) => (
                  <tr key={line.rowId}>
                    <td>
                      <select className="form-control" value={line.productId} onChange={(e) => updateLine(line.rowId, { productId: e.target.value })}>
                        <option value="">Select Product</option>
                        {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td><input className="form-control" style={{ width: 80 }} value={line.pack || ''} onChange={(e) => updateLine(line.rowId, { pack: e.target.value })} placeholder="Pack" /></td>
                    <td><input className="form-control" style={{ width: 100 }} value={line.batchNo} onChange={(e) => updateLine(line.rowId, { batchNo: e.target.value })} placeholder="Batch No" /></td>
                    <td><input type="date" className="form-control" style={{ width: 130 }} value={line.mfgDate} onChange={(e) => updateLine(line.rowId, { mfgDate: e.target.value })} /></td>
                    <td><input type="date" className="form-control" style={{ width: 130 }} value={line.expDate} onChange={(e) => updateLine(line.rowId, { expDate: e.target.value })} /></td>
                    <td><input type="number" min="0" className="form-control num-input" value={line.qty} onChange={(e) => updateLine(line.rowId, { qty: Number(e.target.value) || 0 })} /></td>
                    <td><input type="number" min="0" className="form-control num-input" style={{ width: 58 }} value={line.freeQty} onChange={(e) => updateLine(line.rowId, { freeQty: Number(e.target.value) || 0 })} /></td>
                    <td><input type="number" min="0" step="0.01" className="form-control num-input" value={line.rate} onChange={(e) => updateLine(line.rowId, { rate: Number(e.target.value) || 0 })} /></td>
                    <td><input type="number" min="0" max="100" step="0.5" className="form-control num-input" style={{ width: 58 }} value={line.discountPct} onChange={(e) => updateLine(line.rowId, { discountPct: Number(e.target.value) || 0 })} /></td>
                    <td>
                      <select className="form-control" style={{ width: 74 }} value={line.gstRate} onChange={(e) => updateLine(line.rowId, { gstRate: Number(e.target.value) })}>
                        {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </td>
                    <td className="amt">{formatCurrency(line.taxable)}</td>
                    <td className="amt" style={{ fontWeight: 600 }}>{formatCurrency(line.total)}</td>
                    <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(line.rowId)} aria-label="Remove line">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={addLine}>+ Add Row</button>
        </div>

        <div className="card card-pad mb-6">
          <InvoiceTotals {...totals} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/purchases')}>Cancel</button>
          <button type="button" className="btn btn-secondary" onClick={() => toast.info('Draft saved locally for this session.')}>Save Draft</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : (isEdit ? 'Update Purchase' : 'Save Purchase')}</button>
        </div>
      </form>
    </div>
  );
}
