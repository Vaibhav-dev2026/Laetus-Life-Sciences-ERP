import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx';
import FormField from '../../components/common/FormField.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import { productApi } from '../../api/productApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { validateForm, isRequired, isPositive } from '../../utils/validators.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

const EMPTY = {
  sku: '', name: '', genericName: '', brand: '', manufacturer: '', category: '', productType: 'Tablet',
  hsn: '', gstRate: 12, unit: 'Strip', pack: '', mrp: '', purchaseRate: '', saleRate: '', minStock: '', reorderLevel: '', currentStock: 0, status: 'Active',
};
const SCHEMA = { sku: [isRequired], name: [isRequired], hsn: [isRequired], mrp: [isRequired, isPositive], saleRate: [isRequired, isPositive] };

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  usePageTitle(isEdit ? 'Edit Product' : 'New Product');
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [status, setStatus] = useState('idle');

  useEffect(() => { if (isEdit) productApi.getById(id).then((r) => { if (r) setValues(r); setLoading(false); }); }, [id, isEdit]);
  function set(k, v) { setValues((s) => ({ ...s, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm(values, SCHEMA);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus('submitting');
    try {
      if (isEdit) await productApi.update(id, values); else await productApi.create(values);
      toast.success(`Product ${isEdit ? 'updated' : 'created'} successfully.`);
      navigate('/products');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Unable to save product.');
      setStatus('idle');
    }
  }

  if (loading) return <div className="page-body"><CardSkeleton height={400} /></div>;

  return (
    <div className="page-body">
      <Breadcrumbs items={[{ label: 'Products', to: '/products' }, { label: isEdit ? 'Edit' : 'New' }]} />
      <PageHeader title={isEdit ? `Edit ${values.name}` : 'Add Product'} description="Define product identity, tax and pricing." />
      <form className="card card-pad" onSubmit={handleSubmit} noValidate>
        <div className="form-section">
          <div className="form-section-title">Product Identity</div>
          <div className="form-grid">
            <FormField label="SKU" required error={errors.sku}><input className={`form-control ${errors.sku ? 'has-error' : ''}`} value={values.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} /></FormField>
            <FormField label="Product Name" required error={errors.name}><input className={`form-control ${errors.name ? 'has-error' : ''}`} value={values.name} onChange={(e) => set('name', e.target.value)} /></FormField>
            <FormField label="Generic Name"><input className="form-control" value={values.genericName} onChange={(e) => set('genericName', e.target.value)} /></FormField>
            <FormField label="Brand"><input className="form-control" value={values.brand} onChange={(e) => set('brand', e.target.value)} /></FormField>
            <FormField label="Manufacturer"><input className="form-control" value={values.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} /></FormField>
            <FormField label="Category"><input className="form-control" value={values.category} onChange={(e) => set('category', e.target.value)} /></FormField>
            <FormField label="Product Type">
              <select className="form-control" value={values.productType} onChange={(e) => set('productType', e.target.value)}>
                {['Tablet', 'Syrup', 'Cream', 'Injection', 'Capsule', 'Face Wash', 'Other'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Active/Inactive"><select className="form-control" value={values.status} onChange={(e) => set('status', e.target.value)}><option>Active</option><option>Inactive</option></select></FormField>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Tax</div>
          <div className="form-grid">
            <FormField label="HSN Code" required error={errors.hsn}><input className={`form-control ${errors.hsn ? 'has-error' : ''}`} value={values.hsn} onChange={(e) => set('hsn', e.target.value)} /></FormField>
            <FormField label="GST Rate (%)">
              <select className="form-control" value={values.gstRate} onChange={(e) => set('gstRate', Number(e.target.value))}>
                {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
              </select>
            </FormField>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Pricing</div>
          <div className="form-grid-3 form-grid">
            <FormField label="Unit"><input className="form-control" value={values.unit} onChange={(e) => set('unit', e.target.value)} /></FormField>
            <FormField label="Pack"><input className="form-control" value={values.pack} onChange={(e) => set('pack', e.target.value)} placeholder="e.g. 10 Tab / 60ml" /></FormField>
            <FormField label="MRP (₹)" required error={errors.mrp}><input type="number" min="0" className={`form-control ${errors.mrp ? 'has-error' : ''}`} value={values.mrp} onChange={(e) => set('mrp', e.target.value)} /></FormField>
            <FormField label="Purchase Rate (₹)"><input type="number" min="0" className="form-control" value={values.purchaseRate} onChange={(e) => set('purchaseRate', e.target.value)} /></FormField>
            <FormField label="Sale Rate (₹)" required error={errors.saleRate}><input type="number" min="0" className={`form-control ${errors.saleRate ? 'has-error' : ''}`} value={values.saleRate} onChange={(e) => set('saleRate', e.target.value)} /></FormField>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Inventory Controls</div>
          <div className="form-grid">
            <FormField label="Minimum Stock"><input type="number" min="0" className="form-control" value={values.minStock} onChange={(e) => set('minStock', e.target.value)} /></FormField>
            <FormField label="Reorder Level"><input type="number" min="0" className="form-control" value={values.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value)} /></FormField>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/products')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>{status === 'submitting' ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}</button>
        </div>
      </form>
    </div>
  );
}
