import axiosClient from './axiosClient';
import { COMPANY_CONFIG } from '../config/company';

export async function getCompany() {
  try {
    const res = await axiosClient.get('/company');
    return res.data?.data || res.data || COMPANY_CONFIG;
  } catch (_) {
    return COMPANY_CONFIG;
  }
}

export async function updateCompany(payload) {
  const res = await axiosClient.put('/company', payload);
  return res.data?.data || res.data;
}
