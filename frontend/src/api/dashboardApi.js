import axiosClient from './axiosClient';

export const dashboardApi = {
  async getSummary(params) { return (await axiosClient.get('/dashboard/summary', { params })).data.data; },
  async getSalesTrend(params) { return (await axiosClient.get('/dashboard/sales-trend', { params })).data.data; },
  async getTopProducts(params) { return (await axiosClient.get('/dashboard/top-products', { params })).data.data; },
  async getOutstandingAgeing(params) { return (await axiosClient.get('/dashboard/outstanding-ageing', { params })).data.data; },
  async getGstSummary(params) { return (await axiosClient.get('/dashboard/gst-summary', { params })).data.data; },
  async getPurchaseVsSales(params) { return (await axiosClient.get('/dashboard/purchase-vs-sales', { params })).data.data; },
};
