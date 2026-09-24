import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import Modal from '../../components/common/Modal.jsx';
import FormField from '../../components/common/FormField.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { paymentApi } from '../../api/paymentApi.js';
import { customerApi } from '../../api/customerApi.js';
import { supplierApi } from '../../api/supplierApi.js';
import { saleApi } from '../../api/saleApi.js';
import { calcLine } from '../../utils/gst.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import ExportActions from '../../components/common/ExportActions.jsx';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import { downloadFile } from '../../utils/download.js';

import dayjs from 'dayjs';

export default function PaymentList() {
  usePageTitle('Payments');
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState(null);

  async function handleDownloadReceipt(payment) {
    setDownloadingId(payment.id);
    try {
      await downloadFile(`/payments/${payment.id}/pdf`, `${payment.id}.pdf`);
    } catch (err) {
      toast.error(err.message || 'Could not download receipt.');
    } finally {
      setDownloadingId(null);
    }
  }
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: payments, loading, error, reload } = useAsync(() => paymentApi.list(), []);
  const { data: customers, reload: reloadCustomers } = useAsync(() => customerApi.list(), []);
  const { data: suppliers, reload: reloadSuppliers } = useAsync(() => supplierApi.list(), []);
  const { data: sales, reload: reloadSales } = useAsync(() => saleApi.list(), []);

  const [form, setForm] = useState({ partyType: 'Customer', partyId: '', invoiceId: '', amount: '', date: dayjs().format('YYYY-MM-DD'), mode: 'Cash', reference: '', remarks: '' });
  const [partyQuery, setPartyQuery] = useState('');

  function handleOpenModal() {
    reloadCustomers();
    reloadSuppliers();
    reloadSales();
    setPartyQuery('');
    setForm({ partyType: 'Customer', partyId: '', invoiceId: '', amount: '', date: dayjs().format('YYYY-MM-DD'), mode: 'Cash', reference: '', remarks: '' });
    setModalOpen(true);
  }

  const rows = useMemo(() => {
    if (!payments) return [];
    return payments.map((p) => ({
      ...p,
      partyName: p.partyType === 'Customer'
        ? (customers?.find((c) => c.id === p.partyId)?.partyName || p.partyId)
        : (suppliers?.find((s) => s.id === p.partyId)?.company || p.partyId),
    }));
  }, [payments, customers, suppliers]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => !q || [r.partyName, r.reference, r.invoiceId, r.id].join(' ').toLowerCase().includes(q));
  }, [rows, debouncedSearch]);

  const filteredParties = useMemo(() => {
    const list = form.partyType === 'Customer' ? customers : suppliers;
    if (!list) return [];
    const q = partyQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const haystack = [
        p.partyName,
        p.company,
        p.doctorName,
        p.organization,
        p.type,
        p.mobile,
        p.gstin,
        p.id,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [form.partyType, customers, suppliers, partyQuery]);

  // Auto-select single matching party if query is typed and not yet set
  useEffect(() => {
    if (partyQuery.trim() && filteredParties.length === 1 && !form.partyId) {
      setForm((f) => ({ ...f, partyId: filteredParties[0].id }));
    }
  }, [partyQuery, filteredParties, form.partyId]);

  const selectedParty = useMemo(() => {
    if (!form.partyId) return null;
    const list = form.partyType === 'Customer' ? customers : suppliers;
    return list?.find((p) => p.id === form.partyId) || null;
  }, [form.partyType, form.partyId, customers, suppliers]);

  const outstandingForInvoice = useMemo(() => {
    if (!form.invoiceId || form.partyType !== 'Customer') return null;
    const sale = sales?.find((s) => s.id === form.invoiceId);
    if (!sale) return null;
    const total = sale.lines.reduce((a, l) => a + calcLine(l).total, 0);
    return total - (sale.amountReceived || 0);
  }, [form.invoiceId, form.partyType, sales]);

  const [partyOutstanding, setPartyOutstanding] = useState(null);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  useEffect(() => {
    if (!form.partyId) {
      setPartyOutstanding(null);
      return;
    }
    let isMounted = true;
    setLoadingOutstanding(true);
    const endpoint = form.partyType === 'Customer' ? `/customers/${form.partyId}/outstanding` : `/suppliers/${form.partyId}/outstanding`;
    import('../../api/axiosClient.js').then(({ default: axiosClient }) => {
      axiosClient.get(endpoint)
        .then((res) => {
          if (isMounted) setPartyOutstanding(res.data?.data?.outstanding ?? 0);
        })
        .catch(() => {
          if (isMounted) setPartyOutstanding(0);
        })
        .finally(() => {
          if (isMounted) setLoadingOutstanding(false);
        });
    });

    return () => { isMounted = false; };
  }, [form.partyType, form.partyId]);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (submitting) return;

    if (!form.partyId) {
      toast.error(`Please select a ${form.partyType.toLowerCase()} first.`);
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Please enter a valid positive payment amount.');
      return;
    }

    if (partyOutstanding !== null && partyOutstanding <= 0.01) {
      toast.error(`Cannot record payment: ${form.partyType} has no positive outstanding balance.`);
      return;
    }

    if (partyOutstanding !== null && Number(form.amount) > partyOutstanding + 0.01) {
      toast.error(`Payment amount cannot exceed ${form.partyType}'s current outstanding balance (${formatCurrency(partyOutstanding)}).`);
      return;
    }

    if (outstandingForInvoice !== null && Number(form.amount) > outstandingForInvoice + 0.01) {
      toast.error('Payment amount cannot exceed the outstanding balance for this invoice.');
      return;
    }

    setSubmitting(true);
    try {
      await paymentApi.create({ ...form, amount: Number(form.amount), createdBy: 'Current User' });
      toast.success('Payment recorded successfully.');
      setModalOpen(false);
      setPartyQuery('');
      setForm({ partyType: 'Customer', partyId: '', invoiceId: '', amount: '', date: dayjs().format('YYYY-MM-DD'), mode: 'Cash', reference: '', remarks: '' });
      reload();
      reloadCustomers();
      reloadSuppliers();
      reloadSales();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Unable to record payment.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderPartyLabel(p) {
    if (!p) return '';
    if (form.partyType === 'Customer') {
      const details = [];
      if (p.type) details.push(p.type);
      if (p.organization) details.push(p.organization);
      if (p.doctorName && p.doctorName !== p.partyName) details.push(`Dr. ${p.doctorName}`);
      if (p.mobile) details.push(p.mobile);
      return `${p.partyName}${details.length ? ` (${details.join(' · ')})` : ''}`;
    }
    const suppDetails = [];
    if (p.contact) suppDetails.push(p.contact);
    if (p.mobile) suppDetails.push(p.mobile);
    return `${p.company}${suppDetails.length ? ` (${suppDetails.join(' · ')})` : ''}`;
  }

  const columns = [
    { key: 'id', label: 'Payment ID', className: 'mono' },
    { key: 'partyName', label: 'Party' },
    { key: 'partyType', label: 'Party Type' },
    { key: 'invoiceId', label: 'Invoice' },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
    { key: 'mode', label: 'Mode' },
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
    { key: 'reference', label: 'Reference' },
    { key: 'createdBy', label: 'Created By' },
    {
      key: 'receipt',
      label: 'Receipt',
      render: (r) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm no-print"
          onClick={() => handleDownloadReceipt(r)}
          disabled={downloadingId === r.id}
        >
          {downloadingId === r.id ? 'Downloading…' : '📄 PDF'}
        </button>
      ),
    },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Payments"
        description="Receipts from customers and payments made to suppliers."
        actions={(
          <>
            <ExportActions reportKey="payments" filename="payments_register" />
            <button className="btn btn-primary" onClick={handleOpenModal}>+ Record Payment</button>
          </>
        )}
      />

      <div className="card">
        <div className="list-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search party, reference, payment ID…" /></div>
        <DataTable columns={columns} rows={filtered} loading={loading} error={error} onRetry={reload} cardTitleKey="partyName"
          emptyTitle="No payments recorded yet." />
      </div>

      <Modal open={modalOpen} title="Record Payment / Receipt" onClose={() => setModalOpen(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving…' : 'Save Payment'}</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <FormField label="Party Type">
              <select className="form-control" value={form.partyType} onChange={(e) => {
                setForm((f) => ({ ...f, partyType: e.target.value, partyId: '', invoiceId: '' }));
                setPartyQuery('');
              }}>
                <option>Customer</option><option>Supplier</option>
              </select>
            </FormField>

            <FormField label={`Select ${form.partyType}`} required>
              {selectedParty ? (
                <div className="customer-picked-card mb-2" style={{ padding: '0.4rem 0.65rem', background: '#eef2ff', borderRadius: 6, border: '1px solid #c7d2fe', fontSize: '0.85rem' }}>
                  <div className="flex-between">
                    <div>
                      <span className="text-muted">Selected: </span>
                      <strong>{renderPartyLabel(selectedParty)}</strong>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: 22 }} onClick={() => { setForm((f) => ({ ...f, partyId: '', invoiceId: '' })); setPartyQuery(''); }}>✕ Change</button>
                  </div>
                  {loadingOutstanding ? (
                    <div style={{ fontSize: '0.8rem', color: '#6366f1', marginTop: 4 }}>Checking current balance…</div>
                  ) : partyOutstanding !== null ? (
                    <div style={{ marginTop: 4, fontSize: '0.82rem' }}>
                      {partyOutstanding > 0.01 ? (
                        <span style={{ color: '#047857', fontWeight: 600 }}>
                          Current Outstanding Balance: {formatCurrency(partyOutstanding)}
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                          ⚠️ No Outstanding Balance available for this {form.partyType.toLowerCase()}.
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="form-control mb-1"
                    placeholder={`Search ${form.partyType.toLowerCase()} by name, doctor, clinic, mobile...`}
                    value={partyQuery}
                    onChange={(e) => setPartyQuery(e.target.value)}
                  />
                  {partyQuery.trim() && filteredParties.length > 0 && (
                    <div className="customer-search-result mb-1" style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {filteredParties.slice(0, 6).map((p) => (
                        <button type="button" key={p.id} onClick={() => { setForm((f) => ({ ...f, partyId: p.id })); setPartyQuery(''); }}>
                          {renderPartyLabel(p)}
                        </button>
                      ))}
                    </div>
                  )}
                  <select className="form-control" value={form.partyId} onChange={(e) => setForm((f) => ({ ...f, partyId: e.target.value }))}>
                    <option value="">-- Select {form.partyType} --</option>
                    {filteredParties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {renderPartyLabel(p)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </FormField>

            {form.partyType === 'Customer' && (
              <FormField label="Invoice">
                <select className="form-control" value={form.invoiceId} onChange={(e) => setForm((f) => ({ ...f, invoiceId: e.target.value }))}>
                  <option value="">General payment / Advance receipt</option>
                  {sales?.filter((s) => s.customerId === form.partyId).map((s) => <option key={s.id} value={s.id}>{s.invoiceNo}</option>)}
                </select>
                {outstandingForInvoice !== null && <span className="form-help">Outstanding on this invoice: {formatCurrency(outstandingForInvoice)}</span>}
              </FormField>
            )}
            <FormField label="Amount (₹)" required><input type="number" min="0" step="0.01" className="form-control" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></FormField>
            <FormField label="Date"><input type="date" className="form-control" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></FormField>
            <FormField label="Mode">
              <select className="form-control" value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
                {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </FormField>
            <FormField label="Reference"><input className="form-control" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="e.g. UTR / Cheque No" /></FormField>
            <FormField label="Remarks" span2><textarea className="form-control" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional notes" /></FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
}
