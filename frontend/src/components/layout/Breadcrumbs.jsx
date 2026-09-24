import React from 'react';
import { Link } from 'react-router-dom';
import './layout.css';

export default function Breadcrumbs({ items = [] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/dashboard">Dashboard</Link>
      {items.map((item, idx) => (
        <span key={idx}>
          {' '}/{' '}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span className="current">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
