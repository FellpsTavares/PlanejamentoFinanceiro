import api from './api';

export const tenantAuditService = {
  list: async ({
    limit = 50,
    module,
    action,
    entity_type,
    user_email,
    q,
    start_date,
    end_date,
  } = {}) => {
    const response = await api.get('/tenants/current/audit-logs/', {
      params: {
        limit,
        module,
        action,
        entity_type,
        user_email,
        q,
        start_date,
        end_date,
      },
    });
    return response.data;
  },
};
