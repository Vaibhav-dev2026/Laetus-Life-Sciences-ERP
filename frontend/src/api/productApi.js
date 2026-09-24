import { createCrudApi } from './genericCrudApi';

const baseCrud = createCrudApi('products', 'PRD');

export const productApi = {
  ...baseCrud,
  list(params = {}) {
    return baseCrud.list({ limit: 1000, ...params });
  },
};
