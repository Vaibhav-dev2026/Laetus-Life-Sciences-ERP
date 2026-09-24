import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import FormField from '../../components/common/FormField.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { supplierApi } from '../../api/supplierApi.js';
import { getSupplierLedger } from '../../api/ledgerApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

// Same fix as CustomerLedger.jsx: uses the real, authoritative ledger API
// (SupplierLedger collection) instead of reconstructing an approximation
// client-side from Purchases + Payments, which silently omitted Return,
// Adjustment, Cancellation and Purchase-Edit ledger entries.
export default function SupplierLedger() {
  usePageTitle('Supplier Ledger');
  const toast = useToast();
  const [supplierId, setSupplierId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const { data: suppliers } = useAsync(() => supplierApi.list(), []);
  const [ledger, setLedger] = useState(null); // { supplier, entries } from the backend
  const [loading, setLoading] = useState(false);

  const supplier = suppliers?.find((s) => s.id === supplierId);

  useEffect(() => {
    if (!supplierId) { setLedger(null); return; }
    let cancelled = false;
    setLoading(true);
    getSupplierLedger(supplierId)
      .then((data) => { if (!cancelled) setLedger(data); })
      .catch((err) => { if (!cancelled) toast.error(err?.response?.data?.message || 'Could not load ledger.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const rows = useMemo(() => {
    if (!ledger) return [];
    const opening = { date: '-', type: 'Opening', reference: '-', debit: 0, credit: ledger.supplier?.openingPayable || 0, balance: ledger.supplier?.openingPayable || 0 };
    const entries = (ledger.entries || []).map((e) => ({
      date: e.date, type: e.type, reference: e.refNo || e.refId, debit: e.debit, credit: e.credit, balance: e.balance,
    }));
    return [opening, ...entries].filter((r) => (
      (!range.from || r.date === '-' || r.date >= range.from) && (!range.to || r.date === '-' || r.date <= range.to)
    ));
  }, [ledger, range]);

  const columns = [
    { key: 'date', label: 'Date', render: (r) => (r.date === '-' ? '-' : formatDate(r.date)) },
    { key: 'type', label: 'Type' },
    { key: 'reference', label: 'Reference' },
    { key: 'debit', label: 'Debit', align: 'right', render: (r) => (r.debit ? formatCurrency(r.debit) : '-') },
    { key: 'credit', label: 'Credit', align: 'right', render: (r) => (r.credit ? formatCurrency(r.credit) : '-') },
    { key: 'balance', label: 'Balance', align: 'right', render: (r) => formatCurrency(r.balance) },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Supplier Ledger"
        description="Running account statement for a selected supplier."
        actions={(
          <ExportActions
            pdfUrl={supplierId ? '/ledger/supplier/pdf' : null}
            filename={supplier ? `${supplier.company}-ledger` : 'supplier-ledger'}
            params={{ supplierId, from: range.from, to: range.to }}
          />
        )}
      />
      <div className="card card-pad mb-6">
        <div className="form-grid">
          <FormField label="Supplier">
            <select className="form-control" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select supplier</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.company}</option>)}
            </select>
          </FormField>
          <FormField label="Date Range"><DateRangeFilter from={range.from} to={range.to} onChange={setRange} /></FormField>
        </div>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={supplier ? rows : []} loading={loading} cardTitleKey="type"
          emptyTitle={supplier ? 'No ledger entries in this range.' : 'Select a supplier to view their ledger.'} />
      </div>
    </div>
  );
}
