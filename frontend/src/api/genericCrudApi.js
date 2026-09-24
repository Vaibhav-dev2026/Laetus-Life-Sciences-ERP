import axiosClient from './axiosClient';

// Real REST factory — calls the Express backend. Every response follows the
// { success, message, data } envelope documented in API_CONTRACT.md; we
// unwrap `data` here so calling pages never need to know about the envelope.
function createRestCrudApi(resourcePath) {
  return {
    async list(params) {
      const res = await axiosClient.get(`/${resourcePath}`, { params });
      return res.data.data;
    },
    async getById(id) {
      const res = await axiosClient.get(`/${resourcePath}/${id}`);
      return res.data.data;
    },
    async create(payload) {
      const res = await axiosClient.post(`/${resourcePath}`, payload);
      return res.data.data;
    },
    async update(id, payload) {
      const res = await axiosClient.put(`/${resourcePath}/${id}`, payload);
      return res.data.data;
    },
    async setStatus(id, status) {
      const res = await axiosClient.patch(`/${resourcePath}/${id}/status`, { status });
      return res.data.data;
    },
    async remove(id) {
      await axiosClient.patch(`/${resourcePath}/${id}/status`, { status: 'Inactive' });
      return true;
    },
  };
}

// Public factory used by every domain api module. Pass the REST resource
// path (usually the plural, lowercase collection name).
export function createCrudApi(collectionName, idPrefix, resourcePath = collectionName) {
  return createRestCrudApi(resourcePath);
}
