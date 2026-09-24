import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import FormField from '../../components/common/FormField.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import { customerApi } from '../../api/customerApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { validateForm, isRequired, isMobile, isEmail, isGSTIN, isPositive } from '../../utils/validators.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

const EMPTY = {
  partyName: '', type: 'Medical Store', doctorName: '', organization: '', address: '', city: '', state: 'Gujarat', stateCode: '24', pin: '',
  mobile: '', altMobile: '', email: '', gstin: '', pan: '', drugLicence: '', paymentTerms: '30 Days', creditLimit: '', openingOutstanding: '', notes: '', status: 'Active',
};

const SCHEMA = {
  partyName: [isRequired],
  mobile: [isRequired, isMobile],
  email: [isEmail],
  gstin: [isGSTIN],
  creditLimit: [isPositive],
  openingOutstanding: [isPositive],
};

export default function CustomerForm() {
  const { id } = useParams();
  const isEdit = !!id;
  usePageTitle(isEdit ? 'Edit Customer' : 'New Customer');
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!isEdit) return;
    customerApi.getById(id).then((rec) => { if (rec) setValues(rec); setLoading(false); });
  }, [id, isEdit]);

  function set(key, val) { setValues((v) => ({ ...v, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm(values, SCHEMA);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus('submitting');
    try {
      if (isEdit) await customerApi.update(id, values);
      else await customerApi.create(values);
      toast.success(`Customer ${isEdit ? 'updated' : 'created'} successfully.`);
      navigate('/customers');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Unable to save customer.');
      setStatus('idle');
    }
  }

  if (loading) return <div className="page-body"><CardSkeleton height={400} /></div>;

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Customers', to: '/customers' }, { label: isEdit ? 'Edit' : 'New' }]} />
      <PageHeader title={isEdit ? `Edit ${values.partyName}` : 'Add Customer'} description="Enter customer master details." />
      <form className="card card-pad" onSubmit={handleSubmit} noValidate>
        <div className="form-section">
          <div className="form-section-title">Basic Information</div>
          <div className="form-grid">
            <FormField label="Customer ID" help={isEdit ? undefined : 'Auto-generated on save'}>
              <input className="form-control" value={isEdit ? values.id : ''} disabled placeholder="Auto-generated" />
            </FormField>
            <FormField label="Party Name" required error={errors.partyName}>
              <input className={`form-control ${errors.partyName ? 'has-error' : ''}`} value={values.partyName} onChange={(e) => set('partyName', e.target.value)} />
            </FormField>
            <FormField label="Customer Type">
              <select className="form-control" value={values.type} onChange={(e) => set('type', e.target.value)}>
                {['Doctor', 'Clinic', 'Hospital', 'Medical Store', 'Distributor', 'Other'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Doctor Name"><input className="form-control" value={values.doctorName} onChange={(e) => set('doctorName', e.target.value)} /></FormField>
            <FormField label="Organization Name"><input className="form-control" value={values.organization} onChange={(e) => set('organization', e.target.value)} /></FormField>
            <FormField label="Active/Inactive">
              <select className="form-control" value={values.status} onChange={(e) => set('status', e.target.value)}>
                <option>Active</option><option>Inactive</option>
              </select>
            </FormField>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Contact Information</div>
          <div className="form-grid">
            <FormField label="Address" span2><textarea className="form-control" value={values.address} onChange={(e) => set('address', e.target.value)} /></FormField>
            <FormField label="City"><input className="form-control" value={values.city} onChange={(e) => set('city', e.target.value)} /></FormField>
            <FormField label="State"><input className="form-control" value={values.state} onChange={(e) => set('state', e.target.value)} /></FormField>
            <FormField label="State Code"><input className="form-control" value={values.stateCode} onChange={(e) => set('stateCode', e.target.value)} /></FormField>
            <FormField label="PIN"><input className="form-control" value={values.pin} onChange={(e) => set('pin', e.target.value)} /></FormField>
            <FormField label="Mobile" required error={errors.mobile}>
              <input className={`form-control ${errors.mobile ? 'has-error' : ''}`} value={values.mobile} onChange={(e) => set('mobile', e.target.value)} />
            </FormField>
            <FormField label="Alternate Mobile"><input className="form-control" value={values.altMobile} onChange={(e) => set('altMobile', e.target.value)} /></FormField>
            <FormField label="Email" error={errors.email}>
              <input className={`form-control ${errors.email ? 'has-error' : ''}`} value={values.email} onChange={(e) => set('email', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Tax Information</div>
          <div className="form-grid">
            <FormField label="GSTIN" error={errors.gstin} help="Leave blank for non-GST retail customers">
              <input className={`form-control ${errors.gstin ? 'has-error' : ''}`} value={values.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
            </FormField>
            <FormField label="PAN"><input className="form-control" value={values.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} /></FormField>
            <FormField label="Drug Licence Number" span2><input className="form-control" value={values.drugLicence} onChange={(e) => set('drugLicence', e.target.value)} /></FormField>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Credit &amp; Payment Information</div>
          <div className="form-grid-3 form-grid">
            <FormField label="Payment Terms">
              <select className="form-control" value={values.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)}>
                {['7 Days', '15 Days', '30 Days', '45 Days', '60 Days', 'Advance'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Credit Limit (₹)" error={errors.creditLimit}>
              <input type="number" min="0" className={`form-control ${errors.creditLimit ? 'has-error' : ''}`} value={values.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} />
            </FormField>
            <FormField label="Opening Outstanding (₹)" error={errors.openingOutstanding}>
              <input type="number" min="0" className={`form-control ${errors.openingOutstanding ? 'has-error' : ''}`} value={values.openingOutstanding} onChange={(e) => set('openingOutstanding', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Additional Information</div>
          <div className="form-grid">
            <FormField label="Notes" span2><textarea className="form-control" value={values.notes} onChange={(e) => set('notes', e.target.value)} /></FormField>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/customers')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
