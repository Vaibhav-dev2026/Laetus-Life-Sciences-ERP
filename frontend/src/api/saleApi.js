import { createCrudApi } from './genericCrudApi';
import axiosClient from './axiosClient';
import { downloadFile } from '../utils/download';

const baseCrud = createCrudApi('sales', 'INV');

export const saleApi = {
  ...baseCrud,
  async downloadPdf(id, invoiceNo = 'invoice') {
    const filename = `${String(invoiceNo).replace(/[\/\\]/g, '-')}.pdf`;
    await downloadFile(`/sales/${id}/pdf`, filename);
    return true;
  },
  async update(id, payload) {
    const { data } = await axiosClient.put(`/sales/${id}`, payload);
    return data?.data || data;
  },
  async cancel(id, reason = 'Not specified') {
    const { data } = await axiosClient.patch(`/sales/${id}/cancel`, { reason });
    return data?.data || data;
  },
};
