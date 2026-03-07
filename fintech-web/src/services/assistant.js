import api from './api';

export const assistantService = {
  async parse(message) {
    const response = await api.post('/assistant/parse/', { message });
    return response.data;
  },

  async execute(intent, draft) {
    const response = await api.post('/assistant/execute/', { intent, draft, confirm: true });
    return response.data;
  },
};
