// Central sidebar navigation config, filtered per-role by AppLayout.
export const NAV_SECTIONS = [
  {
    title: null,
    items: [{ label: 'Dashboard', icon: '⌂', path: '/dashboard' }],
  },
  {
    title: 'Masters',
    items: [
      { label: 'Customers', icon: '👥', path: '/customers' },
      { label: 'Suppliers', icon: '🚚', path: '/suppliers' },
      { label: 'Products', icon: '💊', path: '/products' },
      { label: 'Batches', icon: '🧪', path: '/batches' },
      { label: 'Inventory', icon: '📦', path: '/inventory' },
    ],
  },
  {
    title: 'Transactions',
    items: [
      { label: 'Purchases', icon: '🧾', path: '/purchases' },
      { label: 'Sales / Billing', icon: '🧮', path: '/sales' },
      { label: 'Payments', icon: '💳', path: '/payments' },
      { label: 'Sales Return', icon: '↩️', path: '/sales-return' },
      { label: 'Purchase Return', icon: '↪️', path: '/purchase-return' },
      { label: 'Expenses', icon: '💰', path: '/expenses' },
    ],
  },
  {
    title: 'Accounts',
    items: [
      { label: 'Outstanding', icon: '📋', path: '/outstanding' },
      { label: 'Customer Ledger', icon: '📖', path: '/ledger/customer' },
      { label: 'Supplier Ledger', icon: '📕', path: '/ledger/supplier' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Sales Report', icon: '📈', path: '/reports/sales' },
      { label: 'Purchase Report', icon: '📉', path: '/reports/purchases' },
      { label: 'Stock Report', icon: '📊', path: '/reports/stock' },
      { label: 'Financial Reports', icon: '🏦', path: '/reports/financial' },
    ],
  },
  {
    title: 'GST',
    items: [
      { label: 'GST Reports', icon: '🏛️', path: '/gst/reports' },
      { label: 'GSTR-1', icon: '📤', path: '/gst/gstr1' },
      { label: 'GSTR-2 / ITC', icon: '📥', path: '/gst/itc-reconciliation' },
      { label: 'GSTR-3B', icon: '📊', path: '/gst/gstr3b' },
    ],
  },
  {
    title: 'Administration',
    roles: ['Admin'],
    items: [
      { label: 'Company Settings', icon: '⚙️', path: '/settings/company' },
      { label: 'Audit Logs', icon: '📝', path: '/audit-logs' },
      { label: 'My Account', icon: '🛡️', path: '/settings/account' },
      { label: 'Database Maintenance', icon: '🗄️', path: '/settings/maintenance' },
      { label: 'Backup', icon: '💾', path: '/settings/backup' },
    ],
  },
  {
    title: null,
    items: [{ label: 'Notifications', icon: '🔔', path: '/notifications' }],
  },
];
