import axiosClient from './axiosClient';

export const backupApi = {
  async list() { return (await axiosClient.get('/backup')).data.data; },
  async createBackup() { return (await axiosClient.post('/backup')).data.data; },
  async restoreBackup(id) { return (await axiosClient.post(`/backup/${id}/restore`, { confirm: 'RESTORE' })).data.data; },
  async testRestore(id) { return (await axiosClient.post(`/backup/${id}/test-restore`)).data.data; },
  async removeBackup(id) { return (await axiosClient.delete(`/backup/${id}`)).data.data; },
};
