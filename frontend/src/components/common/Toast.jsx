import React from 'react';
import './common.css';

const ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };

export default function Toast({ type = 'info', children, onClose }) {
  return (
    <div className={`toast toast-${type}`} role="status">
      <span className="toast-icon">{ICONS[type] || ICONS.info}</span>
      <span className="toast-msg">{children}</span>
      <button className="toast-close" aria-label="Dismiss notification" onClick={onClose}>×</button>
    </div>
  );
}
