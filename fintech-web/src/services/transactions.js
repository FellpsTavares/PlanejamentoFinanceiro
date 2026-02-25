import api from './api';

export const transactionService = {
  // Listar transações
  list: async (params = {}) => {
    const response = await api.get('/transactions/', { params });
    return response.data;
  },

  // Obter transação por ID
  get: async (id) => {
    const response = await api.get(`/transactions/${id}/`);
    return response.data;
  },

  // Criar transação
  create: async (data) => {
    const response = await api.post('/transactions/', data);
    return response.data;
  },

  // Atualizar transação
  update: async (id, data) => {
    const response = await api.put(`/transactions/${id}/`, data);
    return response.data;
  },

  // Deletar transação
  delete: async (id) => {
    await api.delete(`/transactions/${id}/`);
  },

  // Obter resumo de transações
  getSummary: async (params = {}) => {
    const response = await api.get('/transactions/summary/', { params });
    return response.data;
  },

  // Obter transações por intervalo de datas
  getByDateRange: async (params = {}) => {
    const response = await api.get('/transactions/by_date_range/', { params });
    return response.data;
  },

  // Listar categorias
  listCategories: async () => {
    const response = await api.get('/categories/');
    return response.data;
  },

  // Obter categorias por tipo
  getCategoriesByType: async () => {
    const response = await api.get('/categories/by_type/');
    return response.data;
  },

  // Criar categoria
  createCategory: async (data) => {
    const response = await api.post('/categories/', data);
    return response.data;
  },
};
