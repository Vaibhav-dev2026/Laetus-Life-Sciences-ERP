import React, { useMemo, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import FormField from '../../components/common/FormField.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { batchApi } from '../../api/batchApi.js';
import { productApi } from '../../api/productApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

const TABS = ['Current Inventory', 'Low Stock', 'Near Expiry', 'Expired'];

export default function InventoryDashboard() {
  usePageTitle('Inventory');
  const toast = useToast();
  const { data: batches, loading, error, reload } = useAsync(() => batchApi.list(), []);
  const { data: products } = useAsync(() => productApi.list(), []);
  const [tab, setTab] = useState('Current Inventory');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjust, setAdjust] = useState({ productId: '', batchId: '', type: 'Increase', qty: '', reason: '', remarks: '' });

  const rows = useMemo(() => {
    if (!batches) return [];
    const withProduct = batches.map((b) => ({ ...b, productName: products?.find((p) => p.id === b.productId)?.name || b.productId }));
    if (tab === 'Low Stock') return withProduct.filter((b) => b.status === 'Low Stock');
    if (tab === 'Near Expiry') return withProduct.filter((b) => b.status === 'Near Expiry');
    if (tab === 'Expired') return withProduct.filter((b) => b.status === 'Expired');
    return withProduct;
  }, [batches, products, tab]);

  const columns = [
    { key: 'productName', label: 'Product', sortable: true },
    { key: 'batchNo', label: 'Batch', className: 'mono' },
    { key: 'expDate', label: 'Expiry', render: (r) => formatDate(r.expDate) },
    { key: 'mrp', label: 'MRP', align: 'right', render: (r) => formatCurrency(r.mrp) },
    { key: 'saleRate', label: 'Rate', align: 'right', render: (r) => formatCurrency(r.saleRate) },
    { key: 'currentQty', label: 'Current Qty', align: 'right', sortable: true },
    { key: 'value', label: 'Stock Value', align: 'right', render: (r) => formatCurrency(r.currentQty * r.purchaseRate) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  async function submitAdjustment(e) {
    e.preventDefault();
    if (!adjust.productId || !adjust.batchId || !adjust.qty) { toast.error('Product, batch and quantity are required.'); return; }
    try {
      await batchApi.adjust({ batchId: adjust.batchId, type: adjust.type, qty: adjust.qty, reason: adjust.reason, remarks: adjust.remarks });
      toast.success(`Stock ${adjust.type.toLowerCase()} of ${adjust.qty} units recorded.`);
      setAdjustOpen(false);
      setAdjust({ productId: '', batchId: '', type: 'Increase', qty: '', reason: '', remarks: '' });
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Unable to record stock adjustment.');
    }
  }

  return (
    <div className="page-body">
      <PageHeader title="Inventory" description="Stock status across all products and batches."
        actions={<button className="btn btn-primary" onClick={() => setAdjustOpen(true)}>+ Stock Adjustment</button>} />
      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left flex-gap-2">
            {TABS.map((t) => (
              <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
        </div>
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={reload} cardTitleKey="productName"
          emptyTitle={`No batches in "${tab}".`} />
      </div>

      <Modal open={adjustOpen} title="Stock Adjustment" onClose={() => setAdjustOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setAdjustOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={submitAdjustment}>Save Adjustment</button>
        </>}>
        <form onSubmit={submitAdjustment}>
          <div className="form-grid">
            <FormField label="Product" required>
              <select className="form-control" value={adjust.productId} onChange={(e) => setAdjust((a) => ({ ...a, productId: e.target.value }))}>
                <option value="">Select product</option>
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Batch">
              <select className="form-control" value={adjust.batchId} onChange={(e) => setAdjust((a) => ({ ...a, batchId: e.target.value }))}>
                <option value="">Select batch</option>
                {batches?.filter((b) => b.productId === adjust.productId).map((b) => <option key={b.id} value={b.id}>{b.batchNo}</option>)}
              </select>
            </FormField>
            <FormField label="Adjustment Type">
              <select className="form-control" value={adjust.type} onChange={(e) => setAdjust((a) => ({ ...a, type: e.target.value }))}>
                <option>Increase</option><option>Decrease</option>
              </select>
            </FormField>
            <FormField label="Quantity" required><input type="number" min="1" className="form-control" value={adjust.qty} onChange={(e) => setAdjust((a) => ({ ...a, qty: e.target.value }))} /></FormField>
            <FormField label="Reason" span2>
              <select className="form-control" value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))}>
                <option value="">Select reason</option>
                <option>Physical count correction</option>
                <option>Damaged stock</option>
                <option>Expired disposal</option>
                <option>Sample given</option>
                <option>Other</option>
              </select>
            </FormField>
            <FormField label="Remarks" span2><textarea className="form-control" value={adjust.remarks} onChange={(e) => setAdjust((a) => ({ ...a, remarks: e.target.value }))} /></FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
}
