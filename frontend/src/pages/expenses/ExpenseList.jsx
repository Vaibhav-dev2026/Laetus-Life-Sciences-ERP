import React, { useMemo, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import FormField from '../../components/common/FormField.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { expenseApi } from '../../api/expenseApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

import { formatDate, formatCurrency } from '../../utils/format.js';
import dayjs from 'dayjs';

const CATEGORIES = ['Rent', 'Salary', 'Transport', 'Electricity', 'Marketing', 'Office', 'Other'];

export default function ExpenseList() {
  usePageTitle('Expenses');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error, reload } = useAsync(() => expenseApi.list(), []);
  const [form, setForm] = useState({ date: dayjs().format('YYYY-MM-DD'), category: 'Rent', description: '', amount: '', mode: 'Cash', reference: '', status: 'Pending' });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = debouncedSearch.trim().toLowerCase();
    return data.filter((e) => !q || [e.description, e.category].join(' ').toLowerCase().includes(q));
  }, [data, debouncedSearch]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || !form.description) { toast.error('Description and amount are required.'); return; }
    await expenseApi.create({ ...form, amount: Number(form.amount), createdBy: 'Current User' });
    toast.success('Expense recorded successfully.');
    setModalOpen(false);
    setForm({ date: dayjs().format('YYYY-MM-DD'), category: 'Rent', description: '', amount: '', mode: 'Cash', reference: '', status: 'Pending' });
    reload();
  }

  const columns = [
    { key: 'id', label: 'Expense ID', className: 'mono' },
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', align: 'right', sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: 'mode', label: 'Payment Mode' },
    { key: 'reference', label: 'Reference' },
    { key: 'createdBy', label: 'Created By' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Expenses"
        description="Operational expenses across categories."
        actions={(
          <>
            <ExportActions reportKey="expenses" filename="expenses_register" />
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Expense</button>
          </>
        )}
      />

      <div className="card">
        <div className="list-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search description, category…" /></div>
        <DataTable columns={columns} rows={filtered} loading={loading} error={error} onRetry={reload} cardTitleKey="description"
          emptyTitle="No expenses recorded yet." />
      </div>
      <Modal open={modalOpen} title="Add Expense" onClose={() => setModalOpen(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Save Expense</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <FormField label="Date"><input type="date" className="form-control" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></FormField>
            <FormField label="Category">
              <select className="form-control" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Description" span2 required><input className="form-control" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></FormField>
            <FormField label="Amount (₹)" required><input type="number" min="0" className="form-control" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></FormField>
            <FormField label="Payment Mode">
              <select className="form-control" value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
                {['Cash', 'UPI', 'Bank Transfer', 'Cheque'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </FormField>
            <FormField label="Reference"><input className="form-control" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} /></FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
}
