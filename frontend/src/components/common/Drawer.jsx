import React from 'react';
import './common.css';

export default function Drawer({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" aria-label="Close panel" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
