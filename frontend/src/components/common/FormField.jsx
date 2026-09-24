import React from 'react';

export default function FormField({ label, required, error, help, children, span2 }) {
  return (
    <div className={`form-field ${span2 ? 'span-2' : ''}`}>
      {label && <label>{label}{required && <span className="required">*</span>}</label>}
      {children}
      {error ? <span className="form-error">{error}</span> : help ? <span className="form-help">{help}</span> : null}
    </div>
  );
}
