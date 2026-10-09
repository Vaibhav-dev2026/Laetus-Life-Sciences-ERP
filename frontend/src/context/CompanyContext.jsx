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
        // Deep merge: preserve nested bank/invoice objects correctly
        setCompanyState((prev) => ({
          ...prev,
          ...data,
          bank: { ...(prev.bank || {}), ...(data.bank || {}) },
          invoice: { ...(prev.invoice || {}), ...(data.invoice || {}) },
          terms: Array.isArray(data.terms) ? data.terms : (prev.terms || []),
          availableFinancialYears: Array.isArray(data.availableFinancialYears) && data.availableFinancialYears.length
            ? data.availableFinancialYears
            : prev.availableFinancialYears,
        }));
      }
    } catch (_) {
      /* fallback to COMPANY_CONFIG */
    }
  };

  useEffect(() => {
    reloadCompany();

    function handleAuthLogin() {
      reloadCompany();
    }

    window.addEventListener('auth:login', handleAuthLogin);
    return () => window.removeEventListener('auth:login', handleAuthLogin);
  }, []);

  const updateCompanyInContext = (data) => {
    if (!data) return;
    setCompanyState((prev) => ({
      ...prev,
      ...data,
      bank: { ...(prev.bank || {}), ...(data.bank || {}) },
      invoice: { ...(prev.invoice || {}), ...(data.invoice || {}) },
      terms: Array.isArray(data.terms) ? data.terms : (prev.terms || []),
      availableFinancialYears: Array.isArray(data.availableFinancialYears) && data.availableFinancialYears.length
        ? data.availableFinancialYears
        : prev.availableFinancialYears,
    }));
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
