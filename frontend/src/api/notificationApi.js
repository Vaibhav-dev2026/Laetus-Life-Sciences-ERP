import axiosClient from './axiosClient';

export const notificationApi = {
  async list() { return (await axiosClient.get('/notifications')).data.data; },
  async markAllRead() { return (await axiosClient.patch('/notifications/read-all')).data.data; },
  async markRead(id) { return (await axiosClient.patch(`/notifications/${id}/read`)).data.data; },
};
