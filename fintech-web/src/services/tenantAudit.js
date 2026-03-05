import api from './api';

export const tenantAuditService = {
  list: async (limit = 50) => {
    const response = await api.get('/tenants/current/audit-logs/', { params: { limit } });
    return response.data;
  },
};
