import axiosClient from './axiosClient';

export const reportApi = {
  async salesReport(params) { return (await axiosClient.get('/reports/sales', { params })).data.data; },
  async purchaseReport(params) { return (await axiosClient.get('/reports/purchases', { params })).data.data; },
  async stockReport(params) { return (await axiosClient.get('/reports/stock', { params })).data.data; },
  async financialReport(params) { return (await axiosClient.get('/reports/financial', { params })).data.data; },
};
