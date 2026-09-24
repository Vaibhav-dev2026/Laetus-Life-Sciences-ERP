import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCompany } from '../api/companyApi.js';
import { COMPANY_CONFIG } from '../config/company.js';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState(COMPANY_CONFIG);

  const reloadCompany = async () => {
    try {
      const data = await getCompany();
      if (data && typeof data === 'object' && data.name) {
        setCompanyState((prev) => ({ ...prev, ...data }));
      }
    } catch (_) {
      /* fallback to COMPANY_CONFIG */
    }
  };

  useEffect(() => {
    reloadCompany();
  }, []);

  const updateCompanyInContext = (data) => {
    setCompanyState((prev) => ({ ...prev, ...data }));
  };

  return (
    <CompanyContext.Provider value={{ company, setCompany: updateCompanyInContext, reloadCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    return { company: COMPANY_CONFIG, setCompany: () => {}, reloadCompany: () => {} };
  }
  return ctx;
}

