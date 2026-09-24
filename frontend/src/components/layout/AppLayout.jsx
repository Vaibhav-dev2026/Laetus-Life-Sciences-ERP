import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { usePageTitleState } from '../../context/PageTitleContext.jsx';
import './layout.css';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { title } = usePageTitleState();

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="content-area">
        <Topbar onHamburger={() => setMobileOpen(true)} pageTitle={title} />
        <Outlet />
      </div>
    </div>
  );
}
