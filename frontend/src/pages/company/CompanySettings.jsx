import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import FormField from '../../components/common/FormField.jsx';
import FileUploader from '../../components/common/FileUploader.jsx';
import { COMPANY_CONFIG } from '../../config/company.js';
import { useToast } from '../../context/ToastContext.jsx';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import { useCompany } from '../../context/CompanyContext.jsx';
import { updateCompany } from '../../api/companyApi.js';

const TABS = ['Company Profile', 'Invoice Settings', 'Financial Years', 'Bank Details', 'Terms & Conditions', 'Signatory'];

export default function CompanySettings() {
  usePageTitle('Company Settings');
  const toast = useToast();
  const { company, setCompany } = useCompany();
  const [tab, setTab] = useState('Company Profile');
  const [newFyInput, setNewFyInput] = useState('');
  const [form, setForm] = useState({
    ...COMPANY_CONFIG,
    bank: { ...COMPANY_CONFIG.bank },
    invoice: { ...COMPANY_CONFIG.invoice },
    terms: [...COMPANY_CONFIG.terms],
    currentFinancialYear: COMPANY_CONFIG.currentFinancialYear || '2026-27',
    availableFinancialYears: COMPANY_CONFIG.availableFinancialYears || ['2024-25', '2025-26', '2026-27', '2027-28'],
  });

  useEffect(() => {
    if (company) {
      setForm({
        ...COMPANY_CONFIG,
        ...company,
        bank: { ...COMPANY_CONFIG.bank, ...(company.bank || {}) },
        invoice: { ...COMPANY_CONFIG.invoice, ...(company.invoice || {}) },
        terms: Array.isArray(company.terms) && company.terms.length ? company.terms : [...COMPANY_CONFIG.terms],
        currentFinancialYear: company.currentFinancialYear || '2026-27',
        availableFinancialYears: Array.isArray(company.availableFinancialYears) && company.availableFinancialYears.length
          ? company.availableFinancialYears
          : ['2024-25', '2025-26', '2026-27', '2027-28'],
      });
    }
  }, [company]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function setInvoice(k, v) { setForm((f) => ({ ...f, invoice: { ...f.invoice, [k]: v } })); }
  function setBank(k, v) { setForm((f) => ({ ...f, bank: { ...f.bank, [k]: v } })); }

  function handleAddFy(e) {
    e.preventDefault();
    if (!newFyInput.trim()) return;
    const input = newFyInput.trim();
    let fyCode = '';
    const num = parseInt(input, 10);
    if (!isNaN(num) && num > 2000 && num < 2100) {
      fyCode = `${num}-${String(num + 1).slice(-2)}`;
    } else if (/^\d{2,4}-\d{2,4}$/.test(input)) {
      const parts = input.split('-');
      let s = parseInt(parts[0], 10);
      let eYr = parseInt(parts[1], 10);
      if (s < 100) s += 2000;
      if (eYr < 100) eYr += 2000;
      fyCode = `${s}-${String(eYr).slice(-2)}`;
    } else {
      toast.error('Invalid Financial Year format. Enter a year (e.g. 2027) or format like 2027-28');
      return;
    }

    if (form.availableFinancialYears.includes(fyCode)) {
      toast.warning(`Financial Year ${fyCode} is already registered.`);
      return;
    }

    const updatedList = [...form.availableFinancialYears, fyCode].sort((a, b) => parseInt(a.split('-')[0], 10) - parseInt(b.split('-')[0], 10));
    setForm((f) => ({ ...f, availableFinancialYears: updatedList }));
    setNewFyInput('');
    toast.success(`Added Financial Year ${fyCode}. Click "Save Settings" to persist.`);
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const updated = await updateCompany(form);
      setCompany(updated || form);
      toast.success('Company settings saved successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to save company settings.');
    }
  }

  return (
    <div className="page-body">
      <PageHeader title="Company Settings" description="Manage the profile, invoice numbering, bank, financial year, and signatory details used across the ERP." />
      <div className="list-toolbar card" style={{ marginBottom: 'var(--space-5)', borderBottom: 'none' }}>
        <div className="toolbar-left flex-gap-2 flex-wrap">
          {TABS.map((t) => <button key={t} type="button" className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>

      <form className="card card-pad" onSubmit={handleSave}>
        {tab === 'Company Profile' && (
          <div className="form-grid">
            <FormField label="Company Name" span2><input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} /></FormField>
            <FormField label="Logo" span2><FileUploader label="Upload company logo" accept="image/*" onFileSelected={() => toast.info('Logo preview will apply after backend upload is connected.')} /></FormField>
            <FormField label="Address Line 1"><input className="form-control" value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} /></FormField>
            <FormField label="Address Line 2"><input className="form-control" value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} /></FormField>
            <FormField label="Phone"><input className="form-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></FormField>
            <FormField label="Email"><input className="form-control" value={form.email} onChange={(e) => set('email', e.target.value)} /></FormField>
            <FormField label="GSTIN"><input className="form-control mono" value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} /></FormField>
            <FormField label="PAN"><input className="form-control mono" value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} /></FormField>
            <FormField label="State"><input className="form-control" value={form.state} onChange={(e) => set('state', e.target.value)} /></FormField>
            <FormField label="State Code"><input className="form-control" value={form.stateCode} onChange={(e) => set('stateCode', e.target.value)} /></FormField>
            <FormField label="Drug Licence" span2><input className="form-control" value={form.drugLicence} onChange={(e) => set('drugLicence', e.target.value)} /></FormField>
          </div>
        )}
        {tab === 'Invoice Settings' && (
          <div className="form-grid">
            <FormField label="Invoice Prefix"><input className="form-control" value={form.invoice.prefix} onChange={(e) => setInvoice('prefix', e.target.value)} /></FormField>
            <FormField label="Invoice Number Format" help="Placeholders: {FY} financial year, {SEQ} running number"><input className="form-control" value={form.invoice.numberFormat} onChange={(e) => setInvoice('numberFormat', e.target.value)} /></FormField>
            <FormField label="Financial Year Start Month">
              <select className="form-control" value={form.invoice.financialYearStart} onChange={(e) => setInvoice('financialYearStart', e.target.value)}>
                <option>April</option><option>January</option>
              </select>
            </FormField>
            <FormField label="Invoice Start Number"><input type="number" className="form-control" value={form.invoice.startNumber} onChange={(e) => setInvoice('startNumber', e.target.value)} /></FormField>
            <FormField label="Due Date Behavior (days after invoice)"><input type="number" className="form-control" value={form.invoice.dueDateDays} onChange={(e) => setInvoice('dueDateDays', e.target.value)} /></FormField>
          </div>
        )}
        {tab === 'Financial Years' && (
          <div>
            <div style={{ background: '#e7f5ff', border: '1px solid #74c0fc', color: '#1864ab', padding: '12px 16px', borderRadius: 6, marginBottom: 20 }}>
              <strong>📅 Financial Year Management & Data Safety Policy</strong>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                Adding or switching Financial Years will <strong>NEVER</strong> delete or reset historical transactions. All past invoices, purchases, payments, and ledger entries remain safely stored in MongoDB and accessible via report filters.
              </p>
            </div>

            <div className="form-grid mb-6">
              <FormField label="Active Financial Year" help="Default financial year context for the company">
                <select className="form-control" value={form.currentFinancialYear} onChange={(e) => set('currentFinancialYear', e.target.value)}>
                  {form.availableFinancialYears.map((fy) => (
                    <option key={fy} value={fy}>FY {fy} (01-Apr-{fy.split('-')[0]} to 31-Mar-20{fy.split('-')[1]})</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>➕ Add Future Financial Year</h4>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: 260 }}
                  placeholder="Enter Year (e.g. 2027 or 2027-28)"
                  value={newFyInput}
                  onChange={(e) => setNewFyInput(e.target.value)}
                />
                <button type="button" className="btn btn-secondary" onClick={handleAddFy}>+ Add Financial Year</button>
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginTop: 4 }}>
                Automatically computes period from April 1 to March 31 of following year.
              </span>
            </div>

            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📋 Registered Financial Years</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Financial Year Code</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.availableFinancialYears.map((fy) => {
                      const startYr = parseInt(fy.split('-')[0], 10);
                      const isCurrent = fy === form.currentFinancialYear;
                      return (
                        <tr key={fy} style={isCurrent ? { background: '#f8f9fa', fontWeight: 600 } : {}}>
                          <td className="mono">FY {fy}</td>
                          <td>01-Apr-{startYr}</td>
                          <td>31-Mar-20{fy.split('-')[1]}</td>
                          <td>
                            {isCurrent ? (
                              <span className="badge badge-success">ACTIVE CURRENT FY</span>
                            ) : (
                              <span className="badge badge-secondary">AVAILABLE</span>
                            )}
                          </td>
                          <td>
                            {!isCurrent && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  set('currentFinancialYear', fy);
                                  toast.info(`Set FY ${fy} as active. Click "Save Settings" to confirm.`);
                                }}
                              >
                                Set as Active
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {tab === 'Bank Details' && (
          <div className="form-grid">
            <FormField label="Bank Name"><input className="form-control" value={form.bank.bankName} onChange={(e) => setBank('bankName', e.target.value)} /></FormField>
            <FormField label="Account Number"><input className="form-control" value={form.bank.accountNumber} onChange={(e) => setBank('accountNumber', e.target.value)} /></FormField>
            <FormField label="IFSC Code"><input className="form-control" value={form.bank.ifsc} onChange={(e) => setBank('ifsc', e.target.value.toUpperCase())} /></FormField>
          </div>
        )}
        {tab === 'Terms & Conditions' && (
          <FormField label="Terms shown on invoice"><textarea className="form-control" rows={6} value={form.terms.join('\n')} onChange={(e) => set('terms', e.target.value.split('\n'))} /></FormField>
        )}
        {tab === 'Signatory' && (
          <FormField label="Signatory Label"><input className="form-control" value={form.signatoryLabel} onChange={(e) => set('signatoryLabel', e.target.value)} /></FormField>
        )}
        <div className="form-actions"><button type="submit" className="btn btn-primary">Save Settings</button></div>
      </form>
    </div>
  );
}
