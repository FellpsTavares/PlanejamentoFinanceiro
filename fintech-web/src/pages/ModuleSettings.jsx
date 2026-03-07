import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth';
import { tenantParametersService } from '../services/tenantParameters';
import { transactionService } from '../services/transactions';
import { tenantUsersService } from '../services/tenantUsers';
import { tenantAuditService } from '../services/tenantAudit';
import { transportService } from '../services/transport';
import api from '../services/api';
import { toast } from '../utils/toast';

const MODULE_LABELS = {
  general: 'Geral',
  finance: 'Finanças',
  transport: 'Transportadora',
  investments: 'Investimentos',
};

const CATEGORY_EMOJI_OPTIONS = [
  { value: '💰', label: 'Dinheiro' },
  { value: '💳', label: 'Cartão' },
  { value: '🛒', label: 'Compras' },
  { value: '🏠', label: 'Casa' },
  { value: '🚗', label: 'Transporte' },
  { value: '⛽', label: 'Combustível' },
  { value: '🍔', label: 'Alimentação' },
  { value: '🏥', label: 'Saúde' },
  { value: '🎓', label: 'Educação' },
  { value: '📱', label: 'Tecnologia' },
  { value: '🎁', label: 'Lazer' },
  { value: '📈', label: 'Investimento' },
  { value: '📉', label: 'Despesa' },
  { value: '🧾', label: 'Contas' },
];

export default function ModuleSettings() {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const canEdit = ['admin', 'manager'].includes(user?.role);
  const hasTransportModule = Boolean(user?.tenant?.has_module_transport);
  const hasInvestmentsModule = Boolean(user?.tenant?.has_module_investments);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const onChange = () => setUser(authService.getCurrentUser());
    window.addEventListener('auth:userChanged', onChange);
    return () => window.removeEventListener('auth:userChanged', onChange);
  }, []);

  const enabledModules = useMemo(() => {
    const modules = ['general', 'finance'];
    if (hasTransportModule) modules.push('transport');
    if (hasInvestmentsModule) modules.push('investments');
    return modules;
  }, [hasTransportModule, hasInvestmentsModule]);

  const [activeModule, setActiveModule] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sectionOpen, setSectionOpen] = useState({
    general: false,
    users: false,
    categories: false,
    paymentMethods: false,
    backup: false,
    audit: false,
  });
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'operator',
    password: '',
    password_confirm: '',
    is_active: true,
  });

  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: '',
    type: 'pix',
    due_day: '',
    closing_day: '',
  });
  const [generalLoading, setGeneralLoading] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [generalForm, setGeneralForm] = useState({
    passwordMinLength: '8',
    sessionTimeoutMinutes: '60',
    defaultCurrency: 'BRL',
    timezone: 'America/Sao_Paulo',
    dateFormat: 'DD/MM/YYYY',
    requireApprovalForHighExpense: false,
    approvalThresholdAmount: '1000',
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    type: 'expense',
    color: '#3B82F6',
    icon: '💰',
  });
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingCategoryForm, setEditingCategoryForm] = useState({
    name: '',
    description: '',
    type: 'expense',
    color: '#3B82F6',
    icon: '💰',
    is_active: true,
  });

  const [tipoRecebimento, setTipoRecebimento] = useState('1');
  const [porcentagem, setPorcentagem] = useState('10');
  const [tipoPorcentagem, setTipoPorcentagem] = useState('bruta');
  const [tripProgressTypes, setTripProgressTypes] = useState('Coleta,Em trânsito,Descarga,Retorno');

  const toggleSection = (key) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const data = await transactionService.listCategories();
      setCategories(data?.results || data || []);
    } catch (err) {
      toast('Erro ao carregar categorias', 'error');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    setPaymentMethodsLoading(true);
    try {
      const data = await transactionService.listPaymentMethods();
      setPaymentMethods(data?.results || data || []);
    } catch (err) {
      toast('Erro ao carregar formas de pagamento', 'error');
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  const loadGeneralSettings = async () => {
    setGeneralLoading(true);
    try {
      const data = await tenantParametersService.getByModule('general');
      const map = Object.fromEntries((data || []).map((item) => [item.key, item.value]));
      setGeneralForm({
        passwordMinLength: String(map.PASSWORD_MIN_LENGTH || '8'),
        sessionTimeoutMinutes: String(map.SESSION_TIMEOUT_MINUTES || '60'),
        defaultCurrency: String(map.DEFAULT_CURRENCY || 'BRL'),
        timezone: String(map.TIMEZONE || 'America/Sao_Paulo'),
        dateFormat: String(map.DATE_FORMAT || 'DD/MM/YYYY'),
        requireApprovalForHighExpense: String(map.REQUIRE_APPROVAL_FOR_HIGH_EXPENSE || 'false').toLowerCase() === 'true',
        approvalThresholdAmount: String(map.APPROVAL_THRESHOLD_AMOUNT || '1000'),
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.module?.[0] || 'Erro ao carregar configurações gerais';
      toast(String(detail), 'error');
    } finally {
      setGeneralLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const data = await tenantAuditService.list(30);
      setAuditLogs(data || []);
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Erro ao carregar auditoria';
      toast(String(detail), 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await tenantUsersService.list();
      setUsers(data || []);
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Erro ao carregar usuários';
      toast(String(detail), 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!enabledModules.includes(activeModule) && enabledModules.length > 0) {
      setActiveModule(enabledModules[0]);
    }
  }, [enabledModules, activeModule]);

  useEffect(() => {
    if (activeModule === 'general') {
      loadGeneralSettings();
    }
  }, [activeModule]);

  useEffect(() => {
    if (activeModule === 'finance') {
      loadCategories();
      loadPaymentMethods();
    }
  }, [activeModule]);

  useEffect(() => {
    if (activeModule === 'general' && sectionOpen.users) {
      loadUsers();
    }
  }, [activeModule, sectionOpen.users]);

  useEffect(() => {
    if (activeModule === 'general' && sectionOpen.audit && canEdit) {
      loadAuditLogs();
    }
  }, [activeModule, sectionOpen.audit, canEdit]);

  useEffect(() => {
    const load = async () => {
      if (!activeModule || !enabledModules.includes(activeModule) || activeModule === 'general') return;
      setLoading(true);
      setLoadError('');
      try {
        const data = await tenantParametersService.getByModule(activeModule);
        const map = Object.fromEntries((data || []).map((item) => [item.key, item.value]));

        if (activeModule === 'transport') {
          setTipoRecebimento(String(map.TIPO_RECEBIMENTO_MOTORISTA || '1'));
          setPorcentagem(String(map.PORCENTAGEM_MOTORISTA || '10'));
          setTipoPorcentagem(String(map.TIPO_PORCENTAGEM || 'bruta'));
          setTripProgressTypes(String(map.TRIP_PROGRESS_TYPES || 'Coleta,Em trânsito,Descarga,Retorno'));
        }
      } catch (err) {
        const detail = err?.response?.data?.detail || err?.response?.data?.module?.[0] || 'Erro ao carregar configurações do módulo';
        setLoadError(String(detail));
        toast(String(detail), 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeModule, hasTransportModule, hasInvestmentsModule]);

  const handleSaveTransport = async () => {
    try {
      setSaving(true);
      await tenantParametersService.updateByModule('transport', [
        { key: 'TIPO_RECEBIMENTO_MOTORISTA', value: String(tipoRecebimento) },
        { key: 'PORCENTAGEM_MOTORISTA', value: String(porcentagem || '0') },
        { key: 'TIPO_PORCENTAGEM', value: String(tipoPorcentagem) },
        { key: 'TRIP_PROGRESS_TYPES', value: String(tripProgressTypes || '') },
      ]);
      toast('Configurações salvas', 'success');
    } catch (err) {
      console.error('Erro ao salvar configurações', err);
      toast('Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTenantUser = async () => {
    if (!canEdit) {
      toast('Somente admin/manager pode gerenciar usuários.', 'error');
      return;
    }

    if (!userForm.username || !userForm.email || !userForm.password || !userForm.password_confirm) {
      toast('Preencha usuário, email e senha.', 'error');
      return;
    }

    try {
      await tenantUsersService.create(userForm);
      toast('Usuário criado com sucesso', 'success');
      setUserForm({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'operator',
        password: '',
        password_confirm: '',
        is_active: true,
      });
      await loadUsers();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data || 'Erro ao criar usuário';
      toast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    }
  };

  const handleToggleUserActive = async (targetUser) => {
    if (!canEdit) {
      toast('Somente admin/manager pode gerenciar usuários.', 'error');
      return;
    }

    try {
      await tenantUsersService.update(targetUser.id, { is_active: !targetUser.is_active });
      await loadUsers();
      toast('Usuário atualizado', 'success');
    } catch (err) {
      toast('Erro ao atualizar usuário', 'error');
    }
  };

  const handleChangeUserRole = async (targetUser, role) => {
    if (!canEdit) {
      toast('Somente admin/manager pode gerenciar usuários.', 'error');
      return;
    }

    try {
      await tenantUsersService.update(targetUser.id, { role });
      await loadUsers();
      toast('Papel atualizado', 'success');
    } catch (err) {
      toast('Erro ao atualizar papel do usuário', 'error');
    }
  };

  const handleCreateCategory = async () => {
    if (!canEdit) {
      toast('Somente admin/manager pode alterar categorias.', 'error');
      return;
    }

    const name = categoryForm.name.trim();
    if (!name) {
      toast('Informe o nome da categoria', 'error');
      return;
    }

    try {
      await transactionService.createCategory({ ...categoryForm, name });
      setCategoryForm({
        name: '',
        description: '',
        type: 'expense',
        color: '#3B82F6',
        icon: '💰',
      });
      await loadCategories();
      toast('Categoria criada com sucesso', 'success');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data || 'Erro ao criar categoria';
      toast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    }
  };

  const startEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryForm({
      name: category.name || '',
      description: category.description || '',
      type: category.type || 'expense',
      color: category.color || '#3B82F6',
      icon: category.icon || '💰',
      is_active: category.is_active ?? true,
    });
  };

  const handleSaveCategoryEdit = async () => {
    if (!canEdit) {
      toast('Somente admin/manager pode alterar categorias.', 'error');
      return;
    }

    if (!editingCategoryId) return;

    const payload = {
      ...editingCategoryForm,
      name: editingCategoryForm.name.trim(),
    };

    if (!payload.name) {
      toast('Informe o nome da categoria', 'error');
      return;
    }

    try {
      await transactionService.updateCategory(editingCategoryId, payload);
      setEditingCategoryId('');
      await loadCategories();
      toast('Categoria atualizada com sucesso', 'success');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data || 'Erro ao atualizar categoria';
      toast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!canEdit) {
      toast('Somente admin/manager pode excluir categorias.', 'error');
      return;
    }

    if (!window.confirm('Deseja realmente excluir esta categoria?')) {
      return;
    }

    try {
      await transactionService.deleteCategory(categoryId);
      await loadCategories();
      toast('Categoria excluída', 'success');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erro ao excluir categoria';
      toast(String(msg), 'error');
    }
  };

  const handleCreatePaymentMethod = async () => {
    if (!canEdit) {
      toast('Somente admin/manager pode alterar formas de pagamento.', 'error');
      return;
    }

    const name = paymentMethodForm.name.trim();
    if (!name) {
      toast('Informe o nome da forma de pagamento', 'error');
      return;
    }

    if (paymentMethodForm.type === 'credit_card' && !paymentMethodForm.due_day) {
      toast('Para cartão de crédito, informe o dia de vencimento.', 'error');
      return;
    }

    try {
      await transactionService.createPaymentMethod({
        name,
        type: paymentMethodForm.type,
        due_day: paymentMethodForm.due_day ? Number(paymentMethodForm.due_day) : null,
        closing_day: paymentMethodForm.closing_day ? Number(paymentMethodForm.closing_day) : null,
      });
      setPaymentMethodForm({ name: '', type: 'pix', due_day: '', closing_day: '' });
      await loadPaymentMethods();
      toast('Forma de pagamento criada com sucesso', 'success');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data || 'Erro ao criar forma de pagamento';
      toast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    }
  };

  const handleTogglePaymentMethod = async (item) => {
    if (!canEdit) {
      toast('Somente admin/manager pode alterar formas de pagamento.', 'error');
      return;
    }
    try {
      await transactionService.updatePaymentMethod(item.id, { is_active: !item.is_active });
      await loadPaymentMethods();
      toast('Forma de pagamento atualizada', 'success');
    } catch (err) {
      toast('Erro ao atualizar forma de pagamento', 'error');
    }
  };

  const handleSaveGeneralSettings = async () => {
    if (!canEdit) {
      toast('Somente admin/manager pode alterar configurações gerais.', 'error');
      return;
    }

    try {
      setGeneralSaving(true);
      await tenantParametersService.updateByModule('general', [
        { key: 'PASSWORD_MIN_LENGTH', value: String(generalForm.passwordMinLength || '8') },
        { key: 'SESSION_TIMEOUT_MINUTES', value: String(generalForm.sessionTimeoutMinutes || '60') },
        { key: 'DEFAULT_CURRENCY', value: String(generalForm.defaultCurrency || 'BRL') },
        { key: 'TIMEZONE', value: String(generalForm.timezone || 'America/Sao_Paulo') },
        { key: 'DATE_FORMAT', value: String(generalForm.dateFormat || 'DD/MM/YYYY') },
        { key: 'REQUIRE_APPROVAL_FOR_HIGH_EXPENSE', value: String(Boolean(generalForm.requireApprovalForHighExpense)) },
        { key: 'APPROVAL_THRESHOLD_AMOUNT', value: String(generalForm.approvalThresholdAmount || '1000') },
      ]);
      toast('Configurações gerais salvas', 'success');
      await loadAuditLogs();
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Erro ao salvar configurações gerais';
      toast(String(detail), 'error');
    } finally {
      setGeneralSaving(false);
    }
  };

  const downloadBlob = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const convertToDelimited = (rows, delimiter = ';') => {
    if (!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escapeCell = (value) => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      const safe = stringValue.replace(/"/g, '""');
      return `"${safe}"`;
    };
    const headerLine = headers.map(escapeCell).join(delimiter);
    const lines = rows.map((row) => headers.map((h) => escapeCell(row[h])).join(delimiter));
    return [headerLine, ...lines].join('\n');
  };

  const handleExportFinance = async (format = 'csv') => {
    try {
      const data = await transactionService.list();
      const items = data?.results || data || [];
      const rows = items.map((item) => ({
        data: item.transaction_date,
        descricao: item.description,
        tipo: item.type,
        categoria: item.category_name || '',
        valor: item.amount,
        status: item.status || '',
      }));
      const now = new Date().toISOString().slice(0, 10);
      const delimited = convertToDelimited(rows, ';');
      if (format === 'xlsx') {
        downloadBlob(delimited, `financeiro_${now}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
      } else {
        downloadBlob(delimited, `financeiro_${now}.csv`, 'text/csv;charset=utf-8;');
      }
      toast('Exportação de Financeiro concluída', 'success');
    } catch (err) {
      toast('Erro ao exportar dados de Financeiro', 'error');
    }
  };

  const handleExportInvestments = async (format = 'csv') => {
    try {
      const res = await api.get('/investments/');
      const items = res?.data || [];
      const rows = items.map((item) => ({
        ticker: item.ticker,
        preco_compra: item.buy_price,
        preco_atual: item.current_price ?? '',
        quantidade: item.quantity,
        pnl: item.pnl ?? '',
        data_compra: item.buy_date,
      }));
      const now = new Date().toISOString().slice(0, 10);
      const delimited = convertToDelimited(rows, ';');
      if (format === 'xlsx') {
        downloadBlob(delimited, `investimentos_${now}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
      } else {
        downloadBlob(delimited, `investimentos_${now}.csv`, 'text/csv;charset=utf-8;');
      }
      toast('Exportação de Investimentos concluída', 'success');
    } catch (err) {
      toast('Erro ao exportar dados de Investimentos', 'error');
    }
  };

  const handleExportTransport = async (format = 'csv') => {
    try {
      const res = await transportService.getTrips();
      const items = res?.results || res || [];
      const rows = items.map((item) => ({
        data: item.date,
        origem: item.origin,
        destino: item.destination,
        valor_total: item.total_value,
        outros_gastos: item.base_expense_value,
        combustivel: item.fuel_expense_value,
        motorista: item.driver_payment,
        liquido: item.net_value,
      }));
      const now = new Date().toISOString().slice(0, 10);
      const delimited = convertToDelimited(rows, ';');
      if (format === 'xlsx') {
        downloadBlob(delimited, `transportadora_${now}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
      } else {
        downloadBlob(delimited, `transportadora_${now}.csv`, 'text/csv;charset=utf-8;');
      }
      toast('Exportação de Transportadora concluída', 'success');
    } catch (err) {
      toast('Erro ao exportar dados de Transportadora', 'error');
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Configurações por Módulo</h1>

      <div className="flex gap-2 mb-6">
        {enabledModules.map((m) => (
          <button
            key={m}
            className={`btn ${activeModule === m ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveModule(m)}
            type="button"
          >
            {MODULE_LABELS[m] || m}
          </button>
        ))}
      </div>

      {activeModule === 'general' ? (
        <div className="space-y-4">
          <div className="card p-4 border rounded space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Configurações Gerais</h2>
                <p className="text-sm text-gray-600">Segurança, preferências e aprovação de lançamentos.</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => toggleSection('general')}>
                {sectionOpen.general ? 'Recolher' : 'Ajustar'}
              </button>
            </div>

            {sectionOpen.general && (
              <>
                {generalLoading ? (
                  <p className="text-sm text-gray-600">Carregando configurações gerais...</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Tamanho mínimo de senha</label>
                      <input
                        className="input-field w-full"
                        value={generalForm.passwordMinLength}
                        onChange={(e) => setGeneralForm((prev) => ({ ...prev, passwordMinLength: e.target.value }))}
                        disabled={!canEdit || generalSaving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Expiração de sessão (minutos)</label>
                      <input
                        className="input-field w-full"
                        value={generalForm.sessionTimeoutMinutes}
                        onChange={(e) => setGeneralForm((prev) => ({ ...prev, sessionTimeoutMinutes: e.target.value }))}
                        disabled={!canEdit || generalSaving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Moeda padrão</label>
                      <select
                        className="input-field w-full"
                        value={generalForm.defaultCurrency}
                        onChange={(e) => setGeneralForm((prev) => ({ ...prev, defaultCurrency: e.target.value }))}
                        disabled={!canEdit || generalSaving}
                      >
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Fuso horário</label>
                      <select
                        className="input-field w-full"
                        value={generalForm.timezone}
                        onChange={(e) => setGeneralForm((prev) => ({ ...prev, timezone: e.target.value }))}
                        disabled={!canEdit || generalSaving}
                      >
                        <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                        <option value="America/Manaus">America/Manaus</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Formato de data</label>
                      <select
                        className="input-field w-full"
                        value={generalForm.dateFormat}
                        onChange={(e) => setGeneralForm((prev) => ({ ...prev, dateFormat: e.target.value }))}
                        disabled={!canEdit || generalSaving}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={generalForm.requireApprovalForHighExpense}
                        onChange={(e) => setGeneralForm((prev) => ({ ...prev, requireApprovalForHighExpense: e.target.checked }))}
                        disabled={!canEdit || generalSaving}
                      />
                      Exigir aprovação para despesas altas
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Limite para aprovação (R$)</label>
                      <input
                        className="input-field w-full"
                        value={generalForm.approvalThresholdAmount}
                        onChange={(e) => setGeneralForm((prev) => ({ ...prev, approvalThresholdAmount: e.target.value }))}
                        disabled={!canEdit || generalSaving || !generalForm.requireApprovalForHighExpense}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-1 flex gap-2 flex-wrap">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleSaveGeneralSettings}
                    disabled={!canEdit || generalSaving}
                  >
                    {generalSaving ? 'Salvando...' : 'Salvar configurações gerais'}
                  </button>
                </div>
              </>
            )}

            {!canEdit && <p className="text-sm text-gray-500">Somente admin/manager pode alterar configurações gerais.</p>}
          </div>

          <div className="card p-4 border rounded space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Usuários</h3>
              <button className="btn btn-secondary" type="button" onClick={() => toggleSection('users')}>
                {sectionOpen.users ? 'Recolher' : 'Gerenciar usuários'}
              </button>
            </div>

            {sectionOpen.users && (
              <>
                <div className="flex items-center justify-end">
                  <button className="btn btn-secondary" type="button" onClick={loadUsers}>Atualizar</button>
                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input-field w-full" placeholder="Username" value={userForm.username} onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))} disabled={!canEdit} />
                <input className="input-field w-full" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} disabled={!canEdit} />
                <input className="input-field w-full" placeholder="Nome" value={userForm.first_name} onChange={(e) => setUserForm((prev) => ({ ...prev, first_name: e.target.value }))} disabled={!canEdit} />
                <input className="input-field w-full" placeholder="Sobrenome" value={userForm.last_name} onChange={(e) => setUserForm((prev) => ({ ...prev, last_name: e.target.value }))} disabled={!canEdit} />
                <select className="input-field w-full" value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))} disabled={!canEdit}>
                  <option value="admin">Admin</option>
                  <option value="manager">Gerente</option>
                  <option value="operator">Operador</option>
                </select>
                <div className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={userForm.is_active} onChange={(e) => setUserForm((prev) => ({ ...prev, is_active: e.target.checked }))} disabled={!canEdit} />
                  Ativo
                </div>
                <input className="input-field w-full" type="password" placeholder="Senha" value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} disabled={!canEdit} />
                <input className="input-field w-full" type="password" placeholder="Confirmar senha" value={userForm.password_confirm} onChange={(e) => setUserForm((prev) => ({ ...prev, password_confirm: e.target.value }))} disabled={!canEdit} />
              </div>

              <button className="btn btn-primary" type="button" onClick={handleCreateTenantUser} disabled={!canEdit}>
                Adicionar usuário
              </button>

              {usersLoading ? (
                <p className="text-sm text-gray-600">Carregando usuários...</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum usuário encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Usuário</th>
                        <th className="py-2 text-left">Email</th>
                        <th className="py-2 text-left">Papel</th>
                        <th className="py-2 text-left">Status</th>
                        <th className="py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b">
                          <td className="py-2">{u.username}</td>
                          <td className="py-2">{u.email}</td>
                          <td className="py-2">
                            <select
                              className="input-field w-full"
                              value={u.role || 'operator'}
                              onChange={(e) => handleChangeUserRole(u, e.target.value)}
                              disabled={!canEdit}
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Gerente</option>
                              <option value="operator">Operador</option>
                            </select>
                          </td>
                          <td className="py-2">{u.is_active ? 'Ativo' : 'Inativo'}</td>
                          <td className="py-2 text-right">
                            <button className="btn btn-secondary" type="button" onClick={() => handleToggleUserActive(u)} disabled={!canEdit}>
                              {u.is_active ? 'Desativar' : 'Ativar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!canEdit && <p className="text-sm text-gray-500">Somente admin/manager pode gerenciar usuários.</p>}
              </>
            )}
          </div>

          <div className="card p-4 border rounded">
            <h3 className="text-base font-semibold mb-1">Categorias e Formas de Pagamento</h3>
            <p className="text-sm text-gray-600">Esses itens foram movidos para a aba <strong>Finanças</strong>.</p>
          </div>

          <div className="card p-4 border rounded space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Backup e Exportação por Módulo</h3>
                <p className="text-sm text-gray-600">Exporte os dados em CSV ou Excel por módulo.</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => toggleSection('backup')}>
                {sectionOpen.backup ? 'Recolher' : 'Exibir exportações'}
              </button>
            </div>

            {sectionOpen.backup && (
              <>

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => handleExportFinance('csv')}>Financeiro CSV</button>
              <button className="btn btn-secondary" type="button" onClick={() => handleExportFinance('xlsx')}>Financeiro Excel</button>
              {hasInvestmentsModule && (
                <>
                  <button className="btn btn-secondary" type="button" onClick={() => handleExportInvestments('csv')}>Investimentos CSV</button>
                  <button className="btn btn-secondary" type="button" onClick={() => handleExportInvestments('xlsx')}>Investimentos Excel</button>
                </>
              )}
              {hasTransportModule && (
                <>
                  <button className="btn btn-secondary" type="button" onClick={() => handleExportTransport('csv')}>Transportadora CSV</button>
                  <button className="btn btn-secondary" type="button" onClick={() => handleExportTransport('xlsx')}>Transportadora Excel</button>
                </>
              )}
            </div>

              </>
            )}
          </div>

          <div className="card p-4 border rounded space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Auditoria</h3>
              <div className="flex gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => toggleSection('audit')}>
                  {sectionOpen.audit ? 'Recolher' : 'Exibir auditoria'}
                </button>
                {canEdit && sectionOpen.audit && <button className="btn btn-secondary" type="button" onClick={loadAuditLogs}>Atualizar</button>}
              </div>
            </div>

            {sectionOpen.audit ? (!canEdit ? (
              <p className="text-sm text-gray-500">Somente admin/manager pode visualizar auditoria.</p>
            ) : auditLoading ? (
              <p className="text-sm text-gray-600">Carregando auditoria...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-gray-600">Sem eventos de auditoria no momento.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border rounded p-3 text-sm">
                    <div className="font-medium">{log.action} • {log.entity_type}</div>
                    <div className="text-gray-600">ID: {log.entity_id || '—'} • Usuário: {log.user_email || '—'}</div>
                    <div className="text-gray-500">{new Date(log.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            )) : null}
          </div>
        </div>
      ) : activeModule === 'finance' ? (
        <div className="space-y-4">
          <div className="card p-4 border rounded space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Formas de Pagamento</h3>
              <button className="btn btn-secondary" type="button" onClick={() => toggleSection('paymentMethods')}>
                {sectionOpen.paymentMethods ? 'Recolher' : 'Gerenciar formas'}
              </button>
            </div>

            {sectionOpen.paymentMethods && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    className="input-field w-full md:col-span-2"
                    placeholder="Nome (ex: Cartão Nubank)"
                    value={paymentMethodForm.name}
                    onChange={(e) => setPaymentMethodForm((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={!canEdit}
                  />
                  <select
                    className="input-field w-full"
                    value={paymentMethodForm.type}
                    onChange={(e) => setPaymentMethodForm((prev) => ({ ...prev, type: e.target.value }))}
                    disabled={!canEdit}
                  >
                    <option value="pix">PIX</option>
                    <option value="cash">Dinheiro</option>
                    <option value="debit_card">Cartão de Débito</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="bank_transfer">Transferência</option>
                    <option value="other">Outros</option>
                  </select>
                  <input
                    className="input-field w-full"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Dia vencimento"
                    value={paymentMethodForm.due_day}
                    onChange={(e) => setPaymentMethodForm((prev) => ({ ...prev, due_day: e.target.value }))}
                    disabled={!canEdit || paymentMethodForm.type !== 'credit_card'}
                  />
                </div>

                <div className="flex gap-2">
                  <button className="btn btn-primary" type="button" onClick={handleCreatePaymentMethod} disabled={!canEdit}>
                    Incluir forma de pagamento
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={loadPaymentMethods}>
                    Atualizar
                  </button>
                </div>

                {paymentMethodsLoading ? (
                  <p className="text-sm text-gray-600">Carregando formas de pagamento...</p>
                ) : paymentMethods.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhuma forma de pagamento cadastrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 text-left">Nome</th>
                          <th className="py-2 text-left">Tipo</th>
                          <th className="py-2 text-left">Vencimento</th>
                          <th className="py-2 text-left">Status</th>
                          <th className="py-2 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentMethods.map((pm) => (
                          <tr key={pm.id} className="border-b">
                            <td className="py-2">{pm.name}</td>
                            <td className="py-2">{pm.type === 'credit_card' ? 'Cartão de Crédito' : pm.type}</td>
                            <td className="py-2">{pm.due_day || '—'}</td>
                            <td className="py-2">{pm.is_active ? 'Ativo' : 'Inativo'}</td>
                            <td className="py-2 text-right">
                              <button className="btn btn-secondary" type="button" onClick={() => handleTogglePaymentMethod(pm)} disabled={!canEdit}>
                                {pm.is_active ? 'Desativar' : 'Ativar'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!canEdit && <p className="text-sm text-gray-500">Somente admin/manager pode alterar formas de pagamento.</p>}
              </>
            )}
          </div>

          <div className="card p-4 border rounded space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Categorias</h3>
              <button className="btn btn-secondary" type="button" onClick={() => toggleSection('categories')}>
                {sectionOpen.categories ? 'Recolher' : 'Ajustar categorias'}
              </button>
            </div>

            {sectionOpen.categories && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="input-field w-full" placeholder="Nome da categoria" value={categoryForm.name} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))} disabled={!canEdit} />
                  <select className="input-field w-full" value={categoryForm.type} onChange={(e) => setCategoryForm((prev) => ({ ...prev, type: e.target.value }))} disabled={!canEdit}>
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                  <select className="input-field w-full" value={categoryForm.icon} onChange={(e) => setCategoryForm((prev) => ({ ...prev, icon: e.target.value }))} disabled={!canEdit}>
                    {CATEGORY_EMOJI_OPTIONS.map((emoji) => (
                      <option key={emoji.value} value={emoji.value}>{emoji.value} {emoji.label}</option>
                    ))}
                  </select>
                  <input className="input-field w-full" type="color" value={categoryForm.color} onChange={(e) => setCategoryForm((prev) => ({ ...prev, color: e.target.value }))} disabled={!canEdit} />
                  <input className="input-field w-full md:col-span-2" placeholder="Descrição (opcional)" value={categoryForm.description} onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))} disabled={!canEdit} />
                </div>

                <button className="btn btn-primary" type="button" onClick={handleCreateCategory} disabled={!canEdit}>
                  Incluir categoria
                </button>

                {categoriesLoading ? (
                  <p className="text-sm text-gray-600">Carregando categorias...</p>
                ) : categories.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhuma categoria cadastrada.</p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((c) => (
                      <div key={c.id} className="border rounded p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm">
                            <div className="font-medium flex items-center gap-2">
                              <span>{c.icon || '💰'}</span>
                              <span>{c.name}</span>
                            </div>
                            <div className="text-gray-600">{c.type === 'income' ? 'Receita' : 'Despesa'}</div>
                          </div>

                          <div className="flex gap-2">
                            <button className="btn btn-secondary" type="button" onClick={() => startEditCategory(c)} disabled={!canEdit}>Editar</button>
                            <button className="btn btn-secondary" type="button" onClick={() => handleDeleteCategory(c.id)} disabled={!canEdit}>Excluir</button>
                          </div>
                        </div>

                        {editingCategoryId === c.id && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <input className="input-field w-full" value={editingCategoryForm.name} onChange={(e) => setEditingCategoryForm((prev) => ({ ...prev, name: e.target.value }))} disabled={!canEdit} />
                            <select className="input-field w-full" value={editingCategoryForm.type} onChange={(e) => setEditingCategoryForm((prev) => ({ ...prev, type: e.target.value }))} disabled={!canEdit}>
                              <option value="expense">Despesa</option>
                              <option value="income">Receita</option>
                            </select>
                            <select className="input-field w-full" value={editingCategoryForm.icon} onChange={(e) => setEditingCategoryForm((prev) => ({ ...prev, icon: e.target.value }))} disabled={!canEdit}>
                              {CATEGORY_EMOJI_OPTIONS.map((emoji) => (
                                <option key={`edit-opt-${emoji.value}`} value={emoji.value}>{emoji.value} {emoji.label}</option>
                              ))}
                            </select>
                            <input className="input-field w-full" type="color" value={editingCategoryForm.color} onChange={(e) => setEditingCategoryForm((prev) => ({ ...prev, color: e.target.value }))} disabled={!canEdit} />
                            <input className="input-field w-full md:col-span-2" value={editingCategoryForm.description} onChange={(e) => setEditingCategoryForm((prev) => ({ ...prev, description: e.target.value }))} disabled={!canEdit} />
                            <div className="md:col-span-2 flex gap-2">
                              <button className="btn btn-primary" type="button" onClick={handleSaveCategoryEdit} disabled={!canEdit}>Salvar</button>
                              <button className="btn btn-secondary" type="button" onClick={() => setEditingCategoryId('')}>Cancelar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!canEdit && <p className="text-sm text-gray-500">Somente admin/manager pode alterar categorias.</p>}
              </>
            )}
          </div>
        </div>
      ) : loading ? (
        <div>Carregando...</div>
      ) : activeModule === 'transport' ? (
        <div className="card p-4 border rounded space-y-4">
          <h2 className="text-lg font-semibold">Parâmetros da Transportadora</h2>
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}

          <div>
            <label className="block text-sm font-medium">Tipo de recebimento do motorista</label>
            <select
              className="input-field w-full"
              value={tipoRecebimento}
              onChange={(e) => setTipoRecebimento(e.target.value)}
              disabled={!canEdit || saving}
            >
              <option value="1">Valor fixo por viagem (manual)</option>
              <option value="2">Porcentagem automática</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Porcentagem do motorista (%)</label>
              <input
                className="input-field w-full"
                value={porcentagem}
                onChange={(e) => setPorcentagem(e.target.value)}
                disabled={!canEdit || saving || tipoRecebimento !== '2'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Tipo da porcentagem</label>
              <select
                className="input-field w-full"
                value={tipoPorcentagem}
                onChange={(e) => setTipoPorcentagem(e.target.value)}
                disabled={!canEdit || saving || tipoRecebimento !== '2'}
              >
                <option value="bruta">Bruta (sobre valor total da viagem)</option>
                <option value="liquida">Líquida (valor da viagem - gastos base)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Tipos de andamento da viagem</label>
            <input
              className="input-field w-full"
              value={tripProgressTypes}
              onChange={(e) => setTripProgressTypes(e.target.value)}
              disabled={!canEdit || saving}
              placeholder="Ex: Coleta,Em trânsito,Descarga,Retorno"
            />
            <p className="text-xs text-gray-500 mt-1">Separe por vírgula os tipos disponíveis para seleção durante a viagem.</p>
          </div>

          <div className="pt-2">
            <button className="btn btn-primary" type="button" onClick={handleSaveTransport} disabled={!canEdit || saving}>
              Salvar configurações
            </button>
            {!canEdit && <p className="text-sm text-gray-500 mt-2">Somente admin/manager pode alterar configurações.</p>}
          </div>
        </div>
      ) : (
        <div className="card p-4 border rounded">
          <h2 className="text-lg font-semibold mb-2">Parâmetros de Investimentos</h2>
          <p className="text-sm text-gray-600">Sem parâmetros configuráveis neste módulo no momento.</p>
        </div>
      )}
    </div>
  );
}
