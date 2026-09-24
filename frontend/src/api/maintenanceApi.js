import axiosClient from './axiosClient';

export const maintenanceApi = {
  async getDiagnostics() { return (await axiosClient.get('/maintenance/diagnostics')).data.data; },
  async scanCandidates(retentionMonths = 12) { return (await axiosClient.get('/maintenance/candidates', { params: { retentionMonths } })).data.data; },
  async runCleanup(options) { return (await axiosClient.post('/maintenance/cleanup', options)).data; },
};
