import api from './api';

export const authService = {
  // Login
  login: async (email, password) => {
    const response = await api.post('/auth/login/', {
      username: email,
      password,
    });
    
    const { access, refresh, user } = response.data;
    
    // Salvar tokens
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    
    return { access, refresh, user };
  },

  // Logout
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  // Registrar novo usuário
  register: async (email, password, passwordConfirm, firstName, lastName, tenantSlug) => {
    const response = await api.post('/users/register/', {
      email,
      password,
      password_confirm: passwordConfirm,
      first_name: firstName,
      last_name: lastName,
      tenant_slug: tenantSlug,
    });
    
    return response.data;
  },

  // Obter usuário atual
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Verificar se está autenticado
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  },

  // Obter informações do usuário do servidor
  getMe: async () => {
    const response = await api.get('/users/me/');
    return response.data;
  },
};
