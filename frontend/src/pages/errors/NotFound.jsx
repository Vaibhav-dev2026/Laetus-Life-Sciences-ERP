import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function NotFound() {
  usePageTitle('Page Not Found');
  const navigate = useNavigate();
  return (
    <div className="state-block" style={{ minHeight: '70vh', justifyContent: 'center' }}>
      <div className="state-icon">🔍</div>
      <div className="state-title">Page not found</div>
      <div className="state-desc">The page you are looking for doesn't exist or has been moved.</div>
      <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
    </div>
  );
}
