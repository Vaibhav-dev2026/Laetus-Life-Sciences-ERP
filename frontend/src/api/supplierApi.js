import { createCrudApi } from './genericCrudApi';

const baseCrud = createCrudApi('suppliers', 'SUP');

export const supplierApi = {
  ...baseCrud,
  list(params = {}) {
    return baseCrud.list({ limit: 1000, ...params });
  },
};
