import api from './api';

export const tenantUsersService = {
  list: async () => {
    const response = await api.get('/users/current-tenant-users/');
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/users/current-tenant-users/', data);
    return response.data;
  },

  update: async (userId, patch) => {
    const response = await api.patch(`/users/current-tenant-users/${userId}/`, patch);
    return response.data;
  },
};
