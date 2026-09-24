import React from 'react';
import './common.css';

export default function SearchBox({ value, onChange, placeholder = 'Search…', ...rest }) {
  return (
    <div className="search-box">
      <span className="search-icon" aria-hidden>⌕</span>
      <input
        type="search"
        className="form-control"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        {...rest}
      />
    </div>
  );
}
