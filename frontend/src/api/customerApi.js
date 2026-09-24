import { createCrudApi } from './genericCrudApi';

const baseCrud = createCrudApi('customers', 'CUST');

export const customerApi = {
  ...baseCrud,
  list(params = {}) {
    return baseCrud.list({ limit: 1000, ...params });
  },
};
