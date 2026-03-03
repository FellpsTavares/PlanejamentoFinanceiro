import api from './api';

export const tenantParametersService = {
  getByModule: async (module) => {
    const res = await api.get('/tenants/current/parameters/', { params: { module } });
    return res.data;
  },
  updateByModule: async (module, parameters) => {
    const res = await api.put('/tenants/current/parameters/', { module, parameters });
    return res.data;
  },
};
