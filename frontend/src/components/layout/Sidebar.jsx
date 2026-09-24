import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_SECTIONS } from './navConfig.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCompany } from '../../context/CompanyContext.jsx';
import { COMPANY_CONFIG } from '../../config/company.js';
import './layout.css';

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const { user, hasRole } = useAuth();
  const { company: contextCompany } = useCompany();
  const company = contextCompany || COMPANY_CONFIG;

  const visibleSections = NAV_SECTIONS.filter((s) => !s.roles || hasRole(...s.roles));

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-brand">
          {company.logo ? (
            <img src={company.logo} alt="" style={{ maxHeight: 32, maxWidth: 32, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 34, height: 34, fontSize: 11, background: 'linear-gradient(135deg,#D4A84F,#9C7430)', color: '#050505', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, border: '1.5px solid rgba(212,168,79,0.4)', flexShrink: 0 }}>
              {(company.name || 'LLS').split(' ').map((w) => w[0]).join('').slice(0, 3)}
            </div>
          )}
          <div className="brand-text">
            <div className="brand-name">{company.displayName || company.name || 'LAETUS LIFE SCIENCES'}</div>
            <div className="brand-sub">{user?.role || 'ERP'}</div>
          </div>
          <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="sidebar-scroll">
          {visibleSections.map((section, idx) => (
            <div key={idx}>
              {section.title && <div className="sidebar-group-title">{section.title}</div>}
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <span className="icon" aria-hidden>{item.icon}</span>
                  <span className="label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className={`sidebar-mobile-backdrop ${mobileOpen ? 'show' : ''}`} onClick={onCloseMobile} />
    </>
  );
}
