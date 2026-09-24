import { createCrudApi } from './genericCrudApi';
import axiosClient from './axiosClient';

const base = createCrudApi('batches', 'BAT');

export const batchApi = {
  ...base,
  list(params = {}) {
    return base.list({ limit: 1000, ...params });
  },
  async adjust(payload) {
    const res = await axiosClient.post('/batches/adjust', payload);
    return res.data.data;
  },
};
