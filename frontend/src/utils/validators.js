export const isRequired = (v) => (v !== undefined && v !== null && String(v).trim() !== '') || 'This field is required';
export const isEmail = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Enter a valid email address';
export const isMobile = (v) => !v || /^[6-9]\d{9}$/.test(v) || 'Enter a valid 10-digit mobile number';
export const isGSTIN = (v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v) || 'Enter a valid GSTIN';
export const isPositive = (v) => v === '' || v === undefined || Number(v) >= 0 || 'Must be zero or greater';

export function runValidators(value, validators = []) {
  for (const fn of validators) {
    const res = fn(value);
    if (res !== true) return res;
  }
  return null;
}

export function validateForm(values, schema) {
  const errors = {};
  Object.keys(schema).forEach((key) => {
    const msg = runValidators(values[key], schema[key]);
    if (msg) errors[key] = msg;
  });
  return errors;
}
