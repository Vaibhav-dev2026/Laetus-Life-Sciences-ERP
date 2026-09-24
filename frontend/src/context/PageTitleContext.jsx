import React, { createContext, useContext, useEffect, useState } from 'react';
import { APP_NAME } from '../config/company.js';

const PageTitleContext = createContext(null);

export function PageTitleProvider({ children }) {
  const [title, setTitle] = useState('Dashboard');
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitleState() {
  const ctx = useContext(PageTitleContext);
  if (!ctx) throw new Error('usePageTitleState must be used within PageTitleProvider');
  return ctx;
}

// Call inside a page component: usePageTitle('Customers')
export function usePageTitle(title) {
  const { setTitle } = usePageTitleState();
  useEffect(() => {
    setTitle(title);
    document.title = `${title} | ${APP_NAME}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}
