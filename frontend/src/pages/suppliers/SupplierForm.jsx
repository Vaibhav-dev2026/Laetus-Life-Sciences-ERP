import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import FormField from '../../components/common/FormField.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import { supplierApi } from '../../api/supplierApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { validateForm, isRequired, isMobile, isGSTIN, isPositive } from '../../utils/validators.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

const EMPTY = {
  company: '', contact: '', address: '', city: '', state: 'Gujarat', stateCode: '24', pin: '', mobile: '', email: '',
  gstin: '', pan: '', drugLicence: '', paymentTerms: '30 Days', openingPayable: '', bankName: '', accountNumber: '', ifsc: '', notes: '', status: 'Active',
};
const SCHEMA = { company: [isRequired], mobile: [isRequired, isMobile], gstin: [isGSTIN], openingPayable: [isPositive] };

export default function SupplierForm() {
  const { id } = useParams();
  const isEdit = !!id;
  usePageTitle(isEdit ? 'Edit Supplier' : 'New Supplier');
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      supplierApi.getById(id).then((r) => {
        if (r) {
          const sanitized = {};
          Object.keys(r).forEach((k) => {
            sanitized[k] = r[k] === null ? '' : r[k];
          });
          setValues((prev) => ({ ...prev, ...sanitized }));
        }
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  function set(k, v) { setValues((s) => ({ ...s, [k]: v })); }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (submitting) return;

    const errs = validateForm(values, SCHEMA);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      if (isEdit) await supplierApi.update(id, values); else await supplierApi.create(values);
      toast.success(`Supplier ${isEdit ? 'updated' : 'created'} successfully.`);
      navigate('/suppliers');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Unable to save supplier.');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-body"><CardSkeleton height={400} /></div>;

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Suppliers', to: '/suppliers' }, { label: isEdit ? 'Edit' : 'New' }]} />
      <PageHeader title={isEdit ? `Edit ${values.company || ''}` : 'Add Supplier'} description="Enter supplier master details." />
      <form className="card card-pad" onSubmit={handleSubmit} noValidate>
        <div className="form-section">
          <div className="form-section-title">Basic Information</div>
          <div className="form-grid">
            <FormField label="Supplier ID"><input className="form-control" value={isEdit ? (values.id ?? '') : ''} disabled placeholder="Auto-generated" /></FormField>
            <FormField label="Company Name" required error={errors.company}><input className={`form-control ${errors.company ? 'has-error' : ''}`} value={values.company ?? ''} onChange={(e) => set('company', e.target.value)} /></FormField>
            <FormField label="Contact Person"><input className="form-control" value={values.contact ?? ''} onChange={(e) => set('contact', e.target.value)} /></FormField>
            <FormField label="Active/Inactive">
              <select className="form-control" value={values.status ?? 'Active'} onChange={(e) => set('status', e.target.value)}><option>Active</option><option>Inactive</option></select>
            </FormField>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Contact Information</div>
          <div className="form-grid">
            <FormField label="Address" span2><textarea className="form-control" value={values.address ?? ''} onChange={(e) => set('address', e.target.value)} /></FormField>
            <FormField label="City"><input className="form-control" value={values.city ?? ''} onChange={(e) => set('city', e.target.value)} /></FormField>
            <FormField label="State"><input className="form-control" value={values.state ?? ''} onChange={(e) => set('state', e.target.value)} /></FormField>
            <FormField label="State Code"><input className="form-control" value={values.stateCode ?? ''} onChange={(e) => set('stateCode', e.target.value)} /></FormField>
            <FormField label="PIN"><input className="form-control" value={values.pin ?? ''} onChange={(e) => set('pin', e.target.value)} /></FormField>
            <FormField label="Mobile" required error={errors.mobile}><input className={`form-control ${errors.mobile ? 'has-error' : ''}`} value={values.mobile ?? ''} onChange={(e) => set('mobile', e.target.value)} /></FormField>
            <FormField label="Email"><input className="form-control" value={values.email ?? ''} onChange={(e) => set('email', e.target.value)} /></FormField>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Tax Information</div>
          <div className="form-grid">
            <FormField label="GSTIN" error={errors.gstin}><input className={`form-control ${errors.gstin ? 'has-error' : ''}`} value={values.gstin ?? ''} onChange={(e) => set('gstin', e.target.value.toUpperCase())} /></FormField>
            <FormField label="PAN"><input className="form-control" value={values.pan ?? ''} onChange={(e) => set('pan', e.target.value.toUpperCase())} /></FormField>
            <FormField label="Drug Licence"><input className="form-control" value={values.drugLicence ?? ''} onChange={(e) => set('drugLicence', e.target.value)} /></FormField>
            <FormField label="Payment Terms">
              <select className="form-control" value={values.paymentTerms ?? '30 Days'} onChange={(e) => set('paymentTerms', e.target.value)}>
                {['15 Days', '30 Days', '45 Days', '60 Days', 'Advance'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Bank Details</div>
          <div className="form-grid-3 form-grid">
            <FormField label="Bank Name"><input className="form-control" value={values.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} /></FormField>
            <FormField label="Account Number"><input className="form-control" value={values.accountNumber ?? ''} onChange={(e) => set('accountNumber', e.target.value)} /></FormField>
            <FormField label="IFSC"><input className="form-control" value={values.ifsc ?? ''} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} /></FormField>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Additional Information</div>
          <div className="form-grid">
            <FormField label="Opening Payable (₹)" error={errors.openingPayable}><input type="number" min="0" className={`form-control ${errors.openingPayable ? 'has-error' : ''}`} value={values.openingPayable ?? ''} onChange={(e) => set('openingPayable', e.target.value)} /></FormField>
            <FormField label="Notes"><textarea className="form-control" value={values.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></FormField>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/suppliers')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Supplier'}</button>
        </div>
      </form>
    </div>
  );
}
