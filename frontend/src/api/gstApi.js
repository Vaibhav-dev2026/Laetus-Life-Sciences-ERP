import axiosClient from './axiosClient';

export const gstApi = {
  async gstr1(params) { return (await axiosClient.get('/gst/gstr1', { params })).data.data; },
  async itcReconciliation(params) { return (await axiosClient.get('/gst/itc-reconciliation', { params })).data.data; },
  async gstr2bReconciliation(params) { return (await axiosClient.get('/gst/gstr2b-reconciliation', { params })).data.data; },
  async gstr3bSummary(params) { return (await axiosClient.get('/gst/gstr3b', { params })).data.data; },
  async importGstr2b(body) { return (await axiosClient.post('/gst/gstr2b/import', body)).data; },
};
