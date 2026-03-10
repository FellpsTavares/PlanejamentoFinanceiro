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
    // Buscar /users/me/ para garantir dados atualizados e persistir
    try {
      const me = await api.get('/users/me/');
      localStorage.setItem('user', JSON.stringify(me.data));
      // Notificar app que o usuário foi atualizado
      try {
        window.dispatchEvent(new Event('auth:userChanged'));
      } catch (err) {
        // ignore
      }
      return { access, refresh, user: me.data };
    } catch (e) {
      // fallback para o payload retornado no login
      localStorage.setItem('user', JSON.stringify(user));
      try {
        window.dispatchEvent(new Event('auth:userChanged'));
      } catch (err) {
        // ignore
      }
      return { access, refresh, user };
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    try {
      window.dispatchEvent(new Event('auth:userChanged'));
    } catch (err) {
      // ignore
    }
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

  registerAccount: async ({
    tenantName,
    tenantSlug,
    tenantEmail,
    tenantPhone,
    firstName,
    lastName,
    email,
    password,
    passwordConfirm,
  }) => {
    const response = await api.post('/users/register-account/', {
      tenant_name: tenantName,
      tenant_slug: tenantSlug,
      tenant_email: tenantEmail,
      tenant_phone: tenantPhone,
      first_name: firstName,
      last_name: lastName,
      email,
      password,
      password_confirm: passwordConfirm,
    });

    return response.data;
  },

  // Obter usuário atual
  getCurrentUser: () => {
    const stored = localStorage.getItem('user');
    const access = localStorage.getItem('access_token');
    let user = stored ? JSON.parse(stored) : null;

    // Decodificar token para extrair flags (sem validar)
    try {
      if (access) {
        const parts = access.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          user = user || {};
          user.tenant = user.tenant || {};
          if (payload.has_module_transport !== undefined) {
            user.tenant.has_module_transport = Boolean(payload.has_module_transport);
          }
          if (payload.has_module_investments !== undefined) {
            user.tenant.has_module_investments = Boolean(payload.has_module_investments);
          }
          if (payload.is_platform_admin !== undefined) {
            user.is_platform_admin = Boolean(payload.is_platform_admin);
          }
          if (payload.is_superuser !== undefined) {
            user.is_superuser = Boolean(payload.is_superuser);
          }
          if (payload.role !== undefined) {
            user.role = payload.role;
          }
          if (payload.tenant_account_status !== undefined) {
            user.tenant.account_status = payload.tenant_account_status;
          }
          if (payload.tenant_billing_due_date !== undefined) {
            user.tenant.billing_due_date = payload.tenant_billing_due_date;
          }
        }
      }
    } catch (e) {
      // falhar silenciosamente — retornar stored user se houver
    }

    return user;
  },

  // Verificar se está autenticado
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  },

  // Obter informações do usuário do servidor
  getMe: async () => {
    const response = await api.get('/users/me/');
    // Persistir user atualizado
    try {
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (e) {
      /* ignore */
    }
    try {
      window.dispatchEvent(new Event('auth:userChanged'));
    } catch (err) {
      // ignore
    }
    return response.data;
  },
};
