import { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';

export default function AdminTenants() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    role: 'operator',
    is_active: true,
  });
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    email: '',
    phone: '',
    has_module_investments: false,
    has_module_transport: true,
    is_active: true,
    admin_username: '',
    admin_email: '',
    admin_password: '',
    admin_password_confirm: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_role: 'admin',
  });

  const loadTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tenants/');
      setTenants(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Erro ao carregar tenants', err);
      toast('Erro ao carregar tenants', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const suggestSlug = (name) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

  const handleNameBlur = () => {
    if (!form.slug && form.name) {
      setForm((prev) => ({ ...prev, slug: suggestSlug(prev.name) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.slug || !form.email) {
      toast('Preencha nome, slug e email', 'error');
      return;
    }

    if (!form.admin_username || !form.admin_email || !form.admin_password || !form.admin_password_confirm) {
      toast('Preencha os dados do usuário inicial do tenant', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/tenants/create/', form);
      toast('Tenant criado com sucesso', 'success');
      setForm({
        name: '',
        slug: '',
        description: '',
        email: '',
        phone: '',
        has_module_investments: false,
        has_module_transport: true,
        is_active: true,
        admin_username: '',
        admin_email: '',
        admin_password: '',
        admin_password_confirm: '',
        admin_first_name: '',
        admin_last_name: '',
        admin_role: 'admin',
      });
      await loadTenants();
    } catch (err) {
      console.error('Erro ao criar tenant', err);
      const msg = err?.response?.data;
      toast(typeof msg === 'string' ? msg : `Erro ao criar tenant: ${JSON.stringify(msg || {})}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const loadUsers = async (tenantSlug) => {
    try {
      setUsersLoading(true);
      const res = await api.get(`/tenants/${tenantSlug}/users/`);
      setUsers(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários', err);
      toast('Erro ao carregar usuários do tenant', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const selectTenant = async (tenant) => {
    setSelectedTenant(tenant);
    await loadUsers(tenant.slug);
  };

  const handleUserChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!selectedTenant) {
      toast('Selecione um tenant para criar usuário', 'error');
      return;
    }
    try {
      setCreatingUser(true);
      await api.post(`/tenants/${selectedTenant.slug}/users/`, userForm);
      toast('Usuário criado com sucesso', 'success');
      setUserForm({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        password_confirm: '',
        role: 'operator',
        is_active: true,
      });
      await loadUsers(selectedTenant.slug);
    } catch (err) {
      console.error('Erro ao criar usuário', err);
      const msg = err?.response?.data;
      toast(typeof msg === 'string' ? msg : `Erro ao criar usuário: ${JSON.stringify(msg || {})}`, 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (userId, patch) => {
    if (!selectedTenant) return;
    try {
      await api.patch(`/tenants/${selectedTenant.slug}/users/${userId}/`, patch);
      await loadUsers(selectedTenant.slug);
      toast('Usuário atualizado', 'success');
    } catch (err) {
      console.error('Erro ao atualizar usuário', err);
      const msg = err?.response?.data;
      toast(typeof msg === 'string' ? msg : `Erro ao atualizar usuário: ${JSON.stringify(msg || {})}`, 'error');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Administração de Tenants</h1>
      <p className="text-sm text-gray-600 mt-1">Acesso restrito a administradores da plataforma.</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 border rounded bg-white">
          <h2 className="text-lg font-semibold mb-3">Novo Tenant</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Nome *</label>
              <input name="name" value={form.name} onChange={handleChange} onBlur={handleNameBlur} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Slug *</label>
              <input name="slug" value={form.slug} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Telefone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium">Descrição</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="input-field" rows={3} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="has_module_transport" checked={form.has_module_transport} onChange={handleChange} />
                Transportadora
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="has_module_investments" checked={form.has_module_investments} onChange={handleChange} />
                Investimentos
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                Ativo
              </label>
            </div>

            <div className="pt-2 border-t mt-3">
              <h3 className="text-sm font-semibold mb-2">Usuário Inicial do Tenant</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium">Username *</label>
                  <input name="admin_username" value={form.admin_username} onChange={handleChange} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Email *</label>
                  <input type="email" name="admin_email" value={form.admin_email} onChange={handleChange} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Nome</label>
                  <input name="admin_first_name" value={form.admin_first_name} onChange={handleChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Sobrenome</label>
                  <input name="admin_last_name" value={form.admin_last_name} onChange={handleChange} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Senha *</label>
                  <input type="password" name="admin_password" value={form.admin_password} onChange={handleChange} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Confirmar Senha *</label>
                  <input type="password" name="admin_password_confirm" value={form.admin_password_confirm} onChange={handleChange} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Perfil Inicial</label>
                  <select name="admin_role" value={form.admin_role} onChange={handleChange} className="input-field">
                    <option value="admin">Admin</option>
                    <option value="manager">Gerente</option>
                    <option value="operator">Operador</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Criando...' : 'Criar Tenant'}
              </button>
            </div>
          </form>
        </div>

        <div className="p-4 border rounded bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Tenants</h2>
            <button className="btn btn-secondary btn-sm" onClick={loadTenants}>Atualizar</button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-600">Carregando...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum tenant encontrado.</p>
          ) : (
            <ul className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {tenants.map((t) => (
                <li key={t.id} className={`p-3 border rounded ${selectedTenant?.id === t.id ? 'border-blue-500 bg-blue-50' : ''}`}>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-gray-600">Slug: {t.slug}</div>
                  <div className="text-xs text-gray-600">Email: {t.email}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {t.has_module_transport ? 'Transportadora' : ''}
                    {t.has_module_transport && t.has_module_investments ? ' • ' : ''}
                    {t.has_module_investments ? 'Investimentos' : ''}
                    {!t.has_module_transport && !t.has_module_investments ? 'Sem módulos' : ''}
                  </div>
                  <div className="mt-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => selectTenant(t)}>Gerenciar usuários</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border rounded bg-white lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Usuários do Tenant</h2>
            <div className="text-sm text-gray-600">{selectedTenant ? `Tenant: ${selectedTenant.name}` : 'Selecione um tenant'}</div>
          </div>

          {selectedTenant && (
            <>
              <form onSubmit={handleCreateUser} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
                <input name="username" value={userForm.username} onChange={handleUserChange} className="input-field" placeholder="Username" required />
                <input name="email" type="email" value={userForm.email} onChange={handleUserChange} className="input-field" placeholder="Email" required />
                <input name="first_name" value={userForm.first_name} onChange={handleUserChange} className="input-field" placeholder="Nome" />
                <input name="last_name" value={userForm.last_name} onChange={handleUserChange} className="input-field" placeholder="Sobrenome" />
                <input name="password" type="password" value={userForm.password} onChange={handleUserChange} className="input-field" placeholder="Senha" required />
                <input name="password_confirm" type="password" value={userForm.password_confirm} onChange={handleUserChange} className="input-field" placeholder="Confirmar senha" required />
                <select name="role" value={userForm.role} onChange={handleUserChange} className="input-field">
                  <option value="admin">Admin</option>
                  <option value="manager">Gerente</option>
                  <option value="operator">Operador</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_active" checked={userForm.is_active} onChange={handleUserChange} />
                  Ativo
                </label>
                <div className="md:col-span-4">
                  <button className="btn btn-primary" type="submit" disabled={creatingUser}>{creatingUser ? 'Criando usuário...' : 'Criar Usuário'}</button>
                </div>
              </form>

              <div className="mt-4 overflow-x-auto">
                {usersLoading ? (
                  <p className="text-sm text-gray-600">Carregando usuários...</p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhum usuário neste tenant.</p>
                ) : (
                  <table className="w-full table-auto border rounded">
                    <thead>
                      <tr className="bg-gray-50 text-left text-sm">
                        <th className="p-2">Username</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Nome</th>
                        <th className="p-2">Perfil</th>
                        <th className="p-2">Ativo</th>
                        <th className="p-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t text-sm">
                          <td className="p-2">{u.username}</td>
                          <td className="p-2">{u.email}</td>
                          <td className="p-2">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                          <td className="p-2">
                            <select
                              value={u.role || 'operator'}
                              onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                              className="input-field py-1"
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Gerente</option>
                              <option value="operator">Operador</option>
                            </select>
                          </td>
                          <td className="p-2">{u.is_active ? 'Sim' : 'Não'}</td>
                          <td className="p-2">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleUpdateUser(u.id, { is_active: !u.is_active })}
                            >
                              {u.is_active ? 'Desativar' : 'Ativar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
