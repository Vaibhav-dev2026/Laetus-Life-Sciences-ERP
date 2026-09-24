import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import RowActions from '../../components/common/RowActions.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { productApi } from '../../api/productApi.js';
import { formatCurrency } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function ProductList() {
  usePageTitle('Products');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const { data, loading, error, reload } = useAsync(() => productApi.list(), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = debouncedSearch.trim().toLowerCase();
    return data.filter((p) => !q || [p.sku, p.name, p.genericName, p.hsn].join(' ').toLowerCase().includes(q));
  }, [data, debouncedSearch]);

  const columns = [
    { key: 'sku', label: 'SKU', className: 'mono', sortable: true },
    { key: 'name', label: 'Product Name', sortable: true, render: (r) => <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/products/${r.id}`); }}>{r.name}</a> },
    { key: 'genericName', label: 'Generic Name' },
    { key: 'brand', label: 'Brand' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'category', label: 'Category' },
    { key: 'hsn', label: 'HSN', className: 'mono' },
    { key: 'gstRate', label: 'GST %', align: 'right', render: (r) => `${r.gstRate}%` },
    { key: 'pack', label: 'Pack' },
    { key: 'mrp', label: 'MRP', align: 'right', render: (r) => formatCurrency(r.mrp) },
    { key: 'purchaseRate', label: 'Purchase Rate', align: 'right', render: (r) => formatCurrency(r.purchaseRate) },
    { key: 'saleRate', label: 'Sale Rate', align: 'right', render: (r) => formatCurrency(r.saleRate) },
    { key: 'currentStock', label: 'Current Stock', align: 'right', sortable: true },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.currentStock === 0 ? 'Out of Stock' : r.currentStock <= r.reorderLevel ? 'Low Stock' : r.status} /> },
    { key: 'actions', label: '', render: (r) => <RowActions onView={() => navigate(`/products/${r.id}`)} onEdit={() => navigate(`/products/${r.id}/edit`)} /> },
  ];

  return (
    <div className="page-body">
      <PageHeader title="Products" description="Pharmaceutical product master with pricing and GST configuration."
        actions={<><ExportActions reportKey="products" filename="products" /><button className="btn btn-primary" onClick={() => navigate('/products/new')}>+ Add Product</button></>} />
      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left"><SearchBox value={search} onChange={setSearch} placeholder="Search SKU, name, generic, HSN…" /></div>
          <div className="toolbar-right text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{filtered.length} products</div>
        </div>
        <DataTable columns={columns} rows={filtered} loading={loading} error={error} onRetry={reload} cardTitleKey="name"
          emptyTitle="No products found." emptyDescription="Add a product to start purchasing and billing."
          emptyAction={!loading && !error && <button className="btn btn-primary btn-sm" onClick={() => navigate('/products/new')}>+ Add Product</button>} />
      </div>
    </div>
  );
}
