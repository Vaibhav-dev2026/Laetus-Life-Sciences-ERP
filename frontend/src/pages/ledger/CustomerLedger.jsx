import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import FormField from '../../components/common/FormField.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { customerApi } from '../../api/customerApi.js';
import { getCustomerLedger } from '../../api/ledgerApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

// This page now calls the real, authoritative ledger API
// (CustomerLedger collection, the same source the PDF export and Outstanding
// report use) instead of reconstructing an approximation client-side from
// Sales + Payments lists. The old approximation silently omitted Return,
// Adjustment, Cancellation, and Sale-Edit ledger entries entirely, which
// meant this on-screen table could disagree with the PDF export and with
// Outstanding for the same customer.
export default function CustomerLedger() {
  usePageTitle('Customer Ledger');
  const toast = useToast();
  const [customerId, setCustomerId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const { data: customers } = useAsync(() => customerApi.list(), []);
  const [ledger, setLedger] = useState(null); // { customer, entries } from the backend
  const [loading, setLoading] = useState(false);

  const customer = customers?.find((c) => c.id === customerId);

  useEffect(() => {
    if (!customerId) { setLedger(null); return; }
    let cancelled = false;
    setLoading(true);
    getCustomerLedger(customerId)
      .then((data) => { if (!cancelled) setLedger(data); })
      .catch((err) => { if (!cancelled) toast.error(err?.response?.data?.message || 'Could not load ledger.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const rows = useMemo(() => {
    if (!ledger) return [];
    const opening = { date: '-', type: 'Opening', reference: '-', debit: 0, credit: 0, balance: ledger.customer?.openingOutstanding || 0 };
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
        title="Customer Ledger"
        description="Running account statement for a selected customer."
        actions={(
          <ExportActions
            pdfUrl={customerId ? '/ledger/customer/pdf' : null}
            filename={customer ? `${customer.partyName}-ledger` : 'customer-ledger'}
            params={{ customerId, from: range.from, to: range.to }}
          />
        )}
      />
      <div className="card card-pad mb-6">
        <div className="form-grid">
          <FormField label="Customer">
            <select className="form-control" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer</option>
              {customers?.map((c) => <option key={c.id} value={c.id}>{c.partyName}</option>)}
            </select>
          </FormField>
          <FormField label="Date Range"><DateRangeFilter from={range.from} to={range.to} onChange={setRange} /></FormField>
        </div>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={customer ? rows : []} loading={loading} cardTitleKey="type"
          emptyTitle={customer ? 'No ledger entries in this range.' : 'Select a customer to view their ledger.'} />
      </div>
    </div>
  );
}
