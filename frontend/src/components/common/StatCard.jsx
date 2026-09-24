import React from 'react';
import './common.css';

export default function StatCard({ label, value, trend, trendDirection, icon }) {
  return (
    <div className="stat-card">
      <div className="flex-between">
        <span className="stat-label">{label}</span>
        {icon && <span aria-hidden style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <span className="stat-value">{value}</span>
      {trend && <span className={`stat-trend ${trendDirection || ''}`}>{trend}</span>}
    </div>
  );
}
