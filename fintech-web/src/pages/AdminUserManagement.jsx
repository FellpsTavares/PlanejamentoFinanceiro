import { useEffect, useState } from 'react';
import api from '../services/api';
import { authService } from '../services/auth';
import { toast } from '../utils/toast';
import ConfirmModal from '../components/ConfirmModal';

// ─── Constantes ──────────────────────────────────────────────────────────────

const ACCOUNT_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativa' },
  { value: 'past_due', label: 'Inadimplente' },
  { value: 'suspended', label: 'Suspensa' },
  { value: 'cancelled', label: 'Desistência/Cancelada' },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Gerente' },
  { value: 'operator', label: 'Operador' },
];

const TENANT_FIELD_LABELS = {
  name: 'Nome',
  slug: 'Slug',
  description: 'Descrição',
  email: 'Email',
  phone: 'Telefone',
  is_active: 'Ativo',
  has_module_investments: 'Módulo Investimentos',
  has_module_transport: 'Módulo Transportadora',
  account_status: 'Status da Conta',
  billing_due_date: 'Vencimento',
  account_notes: 'Observações',
};

const EMPTY_TENANT_FORM = {
  name: '',
  slug: '',
  description: '',
  email: '',
  phone: '',
  is_active: true,
  has_module_investments: false,
  has_module_transport: false,
  account_status: 'active',
  billing_due_date: '',
  account_notes: '',
  admin_username: '',
  admin_email: '',
  admin_first_name: '',
  admin_last_name: '',
  admin_password: '',
  admin_password_confirm: '',
  admin_role: 'admin',
};

const EMPTY_USER_FORM = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  role: 'operator',
  is_active: true,
  must_change_password: false,
  password: '',
  password_confirm: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const suggestSlug = (name) =>
  String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

const formatBool = (v) => (v ? 'Sim' : 'Não');
const formatStatus = (v) => ACCOUNT_STATUS_OPTIONS.find((o) => o.value === v)?.label || v;
const formatRole = (v) => ROLE_OPTIONS.find((o) => o.value === v)?.label || v;

function statusBadge(status) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    past_due: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-200 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

// ─── Componente modal de criação/edição de tenant ────────────────────────────

function TenantFormModal({ tenant, onClose, onSaved }) {
  const isEdit = Boolean(tenant);
  const [form, setForm] = useState(
    isEdit
      ? {
          name: tenant.name || '',
          slug: tenant.slug || '',
          description: tenant.description || '',
          email: tenant.email || '',
          phone: tenant.phone || '',
          is_active: Boolean(tenant.is_active),
          has_module_investments: Boolean(tenant.has_module_investments),
          has_module_transport: Boolean(tenant.has_module_transport),
          account_status: tenant.account_status || 'active',
          billing_due_date: tenant.billing_due_date || '',
          account_notes: tenant.account_notes || '',
        }
      : { ...EMPTY_TENANT_FORM }
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [diff, setDiff] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleNameBlur = () => {
    if (!isEdit && !form.slug && form.name) {
      setForm((prev) => ({ ...prev, slug: suggestSlug(prev.name) }));
    }
  };

  const buildDiff = () => {
    const fields = ['name', 'slug', 'description', 'email', 'phone', 'is_active',
      'has_module_investments', 'has_module_transport', 'account_status', 'billing_due_date', 'account_notes'];
    return fields.filter((key) => String(tenant[key] ?? '') !== String(form[key] ?? '')).map((key) => ({
      label: TENANT_FIELD_LABELS[key] || key,
      from: typeof tenant[key] === 'boolean' ? formatBool(tenant[key]) : (tenant[key] ?? '—'),
      to: typeof form[key] === 'boolean' ? formatBool(form[key]) : (form[key] ?? '—'),
    }));
  };

  const handleSave = () => {
    if (!form.name || !form.email) {
      toast('Nome e email são obrigatórios.', 'error');
      return;
    }
    if (isEdit) {
      const d = buildDiff();
      if (d.length === 0) {
        toast('Nenhuma alteração detectada.', 'info');
        return;
      }
      setDiff(d);
      setConfirmOpen(true);
    } else {
      doSubmit();
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/tenants/${tenant.slug}/admin-update/`, form);
        toast('Empresa atualizada com sucesso.', 'success');
      } else {
        await api.post('/tenants/create/', form);
        toast('Empresa criada com sucesso.', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Erro ao salvar empresa.';
      toast(detail, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmMessage = (
    <div>
      <p className="mb-2 font-medium">As seguintes alterações serão salvas:</p>
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-1 pr-4">Campo</th>
            <th className="pb-1 pr-4">Valor atual</th>
            <th className="pb-1">Novo valor</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((d) => (
            <tr key={d.label} className="border-t border-gray-100">
              <td className="py-1 pr-4 font-medium">{d.label}</td>
              <td className="py-1 pr-4 text-gray-500 line-through">{String(d.from)}</td>
              <td className="py-1 text-emerald-700 font-semibold">{String(d.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <h2 className="text-xl font-bold mb-4">{isEdit ? `Alterar Empresa: ${tenant.name}` : 'Nova Empresa'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input className="input w-full" name="name" value={form.name} onChange={handleChange} onBlur={handleNameBlur} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input className="input w-full" name="slug" value={form.slug} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input className="input w-full" type="email" name="email" value={form.email} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input className="input w-full" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea className="input w-full" rows={2} name="description" value={form.description} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status da Conta</label>
              <select className="input w-full" name="account_status" value={form.account_status} onChange={handleChange}>
                {ACCOUNT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimento</label>
              <input className="input w-full" type="date" name="billing_due_date" value={form.billing_due_date} onChange={handleChange} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea className="input w-full" rows={2} name="account_notes" value={form.account_notes} onChange={handleChange} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="w-4 h-4" />
                <span className="text-sm font-medium">Ativo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="has_module_transport" checked={form.has_module_transport} onChange={handleChange} className="w-4 h-4" />
                <span className="text-sm font-medium">Módulo Transportadora</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="has_module_investments" checked={form.has_module_investments} onChange={handleChange} className="w-4 h-4" />
                <span className="text-sm font-medium">Módulo Investimentos</span>
              </label>
            </div>
          </div>

          {!isEdit && (
            <>
              <hr className="my-4" />
              <h3 className="font-semibold mb-3">Usuário Administrador Inicial</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input className="input w-full" name="admin_username" value={form.admin_username} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email do admin</label>
                  <input className="input w-full" type="email" name="admin_email" value={form.admin_email} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nome</label>
                  <input className="input w-full" name="admin_first_name" value={form.admin_first_name} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sobrenome</label>
                  <input className="input w-full" name="admin_last_name" value={form.admin_last_name} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Senha</label>
                  <input className="input w-full" type="password" name="admin_password" value={form.admin_password} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirmar senha</label>
                  <input className="input w-full" type="password" name="admin_password_confirm" value={form.admin_password_confirm} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cargo</label>
                  <select className="input w-full" name="admin_role" value={form.admin_role} onChange={handleChange}>
                    {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirmar alterações na empresa"
        message={confirmMessage}
        confirmText="Confirmar alterações"
        cancelText="Voltar"
        onConfirm={() => { setConfirmOpen(false); doSubmit(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ─── Componente: card de usuário ─────────────────────────────────────────────

function UserCard({ user, tenantSlug, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    email: user.email || '',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    role: user.role || 'operator',
    is_active: Boolean(user.is_active),
    must_change_password: Boolean(user.must_change_password),
    password: '',
    password_confirm: '',
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        is_active: form.is_active,
        must_change_password: form.must_change_password,
      };
      if (form.password) {
        if (form.password !== form.password_confirm) {
          toast('As senhas não coincidem.', 'error');
          setSaving(false);
          return;
        }
        payload.password = form.password;
        payload.password_confirm = form.password_confirm;
      }
      await api.patch(`/tenants/${tenantSlug}/users/${user.id}/`, payload);
      toast('Usuário atualizado.', 'success');
      setEditing(false);
      onUpdated();
    } catch (err) {
      const detail = err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Erro ao salvar.';
      toast(detail, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/tenants/${tenantSlug}/users/${user.id}/`);
      toast('Usuário excluído.', 'success');
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Erro ao excluir.';
      toast(detail, 'error');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition-shadow hover:shadow-md">
      {!editing ? (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">
                {user.first_name || user.last_name
                  ? `${user.first_name} ${user.last_name}`.trim()
                  : user.username}
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{formatRole(user.role)}</span>
              {!user.is_active && (
                <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">Inativo</span>
              )}
              {user.must_change_password && (
                <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">⚠ Troca de senha pendente</span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">{user.email}</div>
            <div className="text-xs text-gray-400">@{user.username}</div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button className="btn btn-secondary text-xs py-1 px-3" onClick={() => setEditing(true)}>Editar</button>
            <button className="btn btn-danger text-xs py-1 px-3" onClick={() => setConfirmDelete(true)}>Excluir</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
              <input className="input w-full text-sm" name="email" value={form.email} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cargo</label>
              <select className="input w-full text-sm" name="role" value={form.role} onChange={handleChange}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nome</label>
              <input className="input w-full text-sm" name="first_name" value={form.first_name} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sobrenome</label>
              <input className="input w-full text-sm" name="last_name" value={form.last_name} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nova senha (opcional)</label>
              <input className="input w-full text-sm" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Deixe vazio para não alterar" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Confirmar senha</label>
              <input className="input w-full text-sm" type="password" name="password_confirm" value={form.password_confirm} onChange={handleChange} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mb-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="w-4 h-4" />
              Ativo
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="must_change_password" checked={form.must_change_password} onChange={handleChange} className="w-4 h-4" />
              Forçar troca de senha no próximo login
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary text-xs py-1 px-3" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary text-xs py-1 px-3" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Excluir usuário"
        message={`Tem certeza que deseja excluir o usuário "${user.email}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

// ─── Componente: formulário de novo usuário ───────────────────────────────────

function NewUserForm({ tenantSlug, onCreated, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_USER_FORM });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    if (!form.username || !form.email || !form.password) {
      toast('Username, email e senha são obrigatórios.', 'error');
      return;
    }
    if (form.password !== form.password_confirm) {
      toast('As senhas não coincidem.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/tenants/${tenantSlug}/users/`, form);
      toast('Usuário criado com sucesso.', 'success');
      onCreated();
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail || JSON.stringify(err?.response?.data) || 'Erro ao criar usuário.';
      toast(detail, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <h4 className="font-semibold mb-3 text-blue-800">Nova Conta de Usuário</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Username *</label>
          <input className="input w-full text-sm" name="username" value={form.username} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Email *</label>
          <input className="input w-full text-sm" type="email" name="email" value={form.email} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Nome</label>
          <input className="input w-full text-sm" name="first_name" value={form.first_name} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Sobrenome</label>
          <input className="input w-full text-sm" name="last_name" value={form.last_name} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Cargo</label>
          <select className="input w-full text-sm" name="role" value={form.role} onChange={handleChange}>
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div />
        <div>
          <label className="block text-xs font-medium mb-1">Senha *</label>
          <input className="input w-full text-sm" type="password" name="password" value={form.password} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Confirmar senha *</label>
          <input className="input w-full text-sm" type="password" name="password_confirm" value={form.password_confirm} onChange={handleChange} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="w-4 h-4" />
          Ativo
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" name="must_change_password" checked={form.must_change_password} onChange={handleChange} className="w-4 h-4" />
          Forçar troca de senha no primeiro login
        </label>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-secondary text-sm" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary text-sm" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Criando…' : 'Criar usuário'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminUserManagement() {
  const user = authService.getCurrentUser();

  // Verifica acesso (redundante — SuperUserRoute já protege, mas boa camada extra)
  if (!user?.is_superuser) {
    return (
      <div className="p-6">
        <p className="text-red-600 font-semibold">Acesso restrito a superusuários.</p>
      </div>
    );
  }

  const [view, setView] = useState('tenants'); // 'tenants' | 'users'
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modais
  const [tenantModal, setTenantModal] = useState(null); // null | 'create' | tenantObj
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadTenants = async () => {
    setLoadingTenants(true);
    try {
      const res = await api.get('/tenants/');
      setTenants(res.data?.results || res.data || []);
    } catch {
      toast('Erro ao carregar empresas.', 'error');
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadUsers = async (tenant) => {
    setLoadingUsers(true);
    setUsers([]);
    try {
      const res = await api.get(`/tenants/${tenant.slug}/users/`);
      setUsers(res.data?.results || res.data || []);
    } catch {
      toast('Erro ao carregar usuários.', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // ── Navegação para view de usuários ──────────────────────────────────────

  const openUsers = (tenant) => {
    setSelectedTenant(tenant);
    setShowNewUserForm(false);
    setView('users');
    loadUsers(tenant);
  };

  const backToTenants = () => {
    setView('tenants');
    setSelectedTenant(null);
    setUsers([]);
  };

  // ── Render: lista de empresas ─────────────────────────────────────────────

  const renderTenantList = () => (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">Acesso exclusivo para superusuários.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm" onClick={loadTenants} disabled={loadingTenants}>
            {loadingTenants ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button className="btn btn-primary text-sm" onClick={() => setTenantModal('create')}>
            + Nova Empresa
          </button>
        </div>
      </div>

      {loadingTenants ? (
        <div className="text-sm text-gray-500 py-8 text-center">Carregando empresas…</div>
      ) : tenants.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">Nenhuma empresa cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tenants.map((t) => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-base">{t.name}</span>
                    {!t.is_active && (
                      <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">Inativa</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">slug: {t.slug}</div>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium flex-shrink-0 ${statusBadge(t.account_status)}`}>
                  {formatStatus(t.account_status)}
                </span>
              </div>

              <div className="text-sm text-gray-600 mb-1">{t.email}</div>

              <div className="flex flex-wrap gap-1 mb-3">
                <span className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">Finanças</span>
                {t.has_module_transport && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">Transportadora</span>
                )}
                {t.has_module_investments && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">Investimentos</span>
                )}
              </div>

              {t.billing_due_date && (
                <div className="text-xs text-gray-400 mb-2">Vencimento: {t.billing_due_date}</div>
              )}

              <div className="flex gap-2">
                <button
                  className="btn btn-secondary text-xs py-1 px-3"
                  onClick={() => setTenantModal(t)}
                >
                  Alterar Empresa
                </button>
                <button
                  className="btn btn-primary text-xs py-1 px-3"
                  onClick={() => openUsers(t)}
                >
                  Gerenciar Usuários
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Render: lista de usuários ─────────────────────────────────────────────

  const renderUserList = () => (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            className="text-gray-500 hover:text-gray-800 text-sm flex items-center gap-1"
            onClick={backToTenants}
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedTenant?.name}</h1>
            <p className="text-xs text-gray-400">Usuários da empresa</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm" onClick={() => loadUsers(selectedTenant)} disabled={loadingUsers}>
            {loadingUsers ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button
            className="btn btn-primary text-sm"
            onClick={() => setShowNewUserForm((v) => !v)}
          >
            {showNewUserForm ? 'Cancelar' : '+ Nova Conta'}
          </button>
        </div>
      </div>

      {showNewUserForm && (
        <NewUserForm
          tenantSlug={selectedTenant.slug}
          onCreated={() => loadUsers(selectedTenant)}
          onClose={() => setShowNewUserForm(false)}
        />
      )}

      {loadingUsers ? (
        <div className="text-sm text-gray-500 py-8 text-center">Carregando usuários…</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">Nenhum usuário encontrado.</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              tenantSlug={selectedTenant.slug}
              onUpdated={() => loadUsers(selectedTenant)}
              onDeleted={() => loadUsers(selectedTenant)}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── Render principal ──────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {view === 'tenants' ? renderTenantList() : renderUserList()}

      {tenantModal && (
        <TenantFormModal
          tenant={tenantModal === 'create' ? null : tenantModal}
          onClose={() => setTenantModal(null)}
          onSaved={loadTenants}
        />
      )}
    </div>
  );
}
