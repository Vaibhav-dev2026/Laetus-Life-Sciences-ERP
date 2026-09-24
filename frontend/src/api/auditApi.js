import axiosClient from './axiosClient';

export const auditApi = {
  async list(params) {
    return (await axiosClient.get('/audit-logs', { params })).data.data;
  },
};
