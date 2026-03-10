import { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativa' },
  { value: 'past_due', label: 'Inadimplente' },
  { value: 'suspended', label: 'Suspensa' },
  { value: 'cancelled', label: 'Desistencia/Cancelada' },
];

export default function AccountManagement() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [accounts, setAccounts] = useState([]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenants/accounts/');
      setAccounts(res.data || []);
    } catch (err) {
      console.error(err);
      toast('Erro ao carregar contas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const setAccountField = (id, field, value) => {
    setAccounts((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const saveAccount = async (account) => {
    try {
      setSavingId(account.id);
      await api.patch(`/tenants/${account.slug}/account-status/`, {
        account_status: account.account_status,
        billing_due_date: account.billing_due_date || null,
        is_active: Boolean(account.is_active),
        account_notes: account.account_notes || '',
      });
      toast('Conta atualizada com sucesso', 'success');
      await loadAccounts();
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail || 'Erro ao atualizar conta';
      toast(detail, 'error');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Contas</h1>
          <p className="text-sm text-gray-600">Acesso exclusivo para superusuarios.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadAccounts}>Atualizar</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Carregando contas...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-gray-600">Nenhuma conta encontrada.</p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="card border rounded p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                  <div className="text-sm font-semibold">{account.name}</div>
                  <div className="text-xs text-gray-600">Slug: {account.slug}</div>
                  <div className="text-xs text-gray-600">Email: {account.email}</div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Status da conta</label>
                  <select
                    className="input-field"
                    value={account.account_status || 'active'}
                    onChange={(e) => setAccountField(account.id, 'account_status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Vencimento</label>
                  <input
                    type="date"
                    className="input-field"
                    value={account.billing_due_date || ''}
                    onChange={(e) => setAccountField(account.id, 'billing_due_date', e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(account.is_active)}
                      onChange={(e) => setAccountField(account.id, 'is_active', e.target.checked)}
                    />
                    Ativo
                  </label>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs text-gray-600 mb-1">Observacoes</label>
                <textarea
                  rows={2}
                  className="input-field"
                  value={account.account_notes || ''}
                  onChange={(e) => setAccountField(account.id, 'account_notes', e.target.value)}
                />
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingId === account.id}
                  onClick={() => saveAccount(account)}
                >
                  {savingId === account.id ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
