import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { notificationApi } from '../../api/notificationApi.js';
import Dropdown from '../common/Dropdown.jsx';
import './layout.css';

export default function Topbar({ onHamburger, pageTitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('laetus_theme') || 'dark');

  useEffect(() => {
    notificationApi.list().then((list) => setUnread(list.filter((n) => !n.read).length));
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('laetus_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  const initials = (user?.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-hamburger" onClick={onHamburger} aria-label="Open menu">☰</button>
        <span className="topbar-title">{pageTitle}</span>
      </div>
      <div className="topbar-right">
        <button className="topbar-icon-btn" aria-label="Toggle theme" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="topbar-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
          🔔
          {unread > 0 && <span className="topbar-badge">{unread}</span>}
        </button>
        <Dropdown trigger={
          <div className="user-menu-trigger">
            <div className="user-avatar">{initials}</div>
            <div className="user-meta">
              <span className="u-name">{user?.name}</span>
              <span className="u-role">{user?.role}</span>
            </div>
          </div>
        }>
          <button onClick={() => navigate('/settings/company')}>Company Settings</button>
          <button className="danger" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </Dropdown>
      </div>
    </header>
  );
}
