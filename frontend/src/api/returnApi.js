import axiosClient from './axiosClient';

export const returnApi = {
  async listSalesReturns() {
    return (await axiosClient.get('/returns/sales')).data.data;
  },
  async createSalesReturn(payload) {
    // payload: { saleId, lineIndex, qty, reason }
    return (await axiosClient.post('/returns/sales', payload)).data.data;
  },
  async listPurchaseReturns() {
    return (await axiosClient.get('/returns/purchases')).data.data;
  },
  async createPurchaseReturn(payload) {
    // payload: { purchaseId, lineIndex, qty, reason }
    return (await axiosClient.post('/returns/purchases', payload)).data.data;
  },
};
