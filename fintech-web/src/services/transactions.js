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

  // Recorrências / dívidas fixas
  createRecurring: async (data) => {
    const response = await api.post('/recurrings/', data);
    return response.data;
  },

  listRecurrings: async () => {
    const response = await api.get('/recurrings/');
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

  // Atualizar categoria
  updateCategory: async (id, data) => {
    const response = await api.patch(`/categories/${id}/`, data);
    return response.data;
  },

  // Excluir categoria
  deleteCategory: async (id) => {
    await api.delete(`/categories/${id}/`);
  },

  // Formas de pagamento
  listPaymentMethods: async () => {
    const response = await api.get('/payment-methods/');
    return response.data;
  },

  createPaymentMethod: async (data) => {
    const response = await api.post('/payment-methods/', data);
    return response.data;
  },

  updatePaymentMethod: async (id, data) => {
    const response = await api.patch(`/payment-methods/${id}/`, data);
    return response.data;
  },

  // Faturas de cartão
  listCreditCardInvoices: async (params = {}) => {
    const response = await api.get('/credit-card-invoices/', { params });
    return response.data;
  },

  markCreditCardInvoicePaid: async (id, paidAt) => {
    const response = await api.post(`/credit-card-invoices/${id}/mark-paid/`, {
      paid_at: paidAt,
    });
    return response.data;
  },
};
