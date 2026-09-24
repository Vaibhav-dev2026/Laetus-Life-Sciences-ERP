import axiosClient from './axiosClient';

export async function getCustomerLedger(customerId) {
  const { data } = await axiosClient.get(`/ledger/customer`, { params: { customerId } });
  return data.data;
}

export async function getSupplierLedger(supplierId) {
  const { data } = await axiosClient.get(`/ledger/supplier`, { params: { supplierId } });
  return data.data;
}
