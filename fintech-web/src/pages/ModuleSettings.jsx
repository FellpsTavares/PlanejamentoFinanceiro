import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth';
import { tenantParametersService } from '../services/tenantParameters';
import { toast } from '../utils/toast';

const MODULE_LABELS = {
  transport: 'Transportadora',
  investments: 'Investimentos',
};

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
    const modules = [];
    if (hasTransportModule) modules.push('transport');
    if (hasInvestmentsModule) modules.push('investments');
    return modules;
  }, [hasTransportModule, hasInvestmentsModule]);

  const [activeModule, setActiveModule] = useState(enabledModules[0] || 'transport');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tipoRecebimento, setTipoRecebimento] = useState('1');
  const [porcentagem, setPorcentagem] = useState('10');
  const [tipoPorcentagem, setTipoPorcentagem] = useState('bruta');

  useEffect(() => {
    if (!enabledModules.includes(activeModule) && enabledModules.length > 0) {
      setActiveModule(enabledModules[0]);
    }
  }, [enabledModules, activeModule]);

  useEffect(() => {
    const load = async () => {
      if (!activeModule || !enabledModules.includes(activeModule)) return;
      setLoading(true);
      setLoadError('');
      try {
        const data = await tenantParametersService.getByModule(activeModule);
        const map = Object.fromEntries((data || []).map((item) => [item.key, item.value]));

        if (activeModule === 'transport') {
          setTipoRecebimento(String(map.TIPO_RECEBIMENTO_MOTORISTA || '1'));
          setPorcentagem(String(map.PORCENTAGEM_MOTORISTA || '10'));
          setTipoPorcentagem(String(map.TIPO_PORCENTAGEM || 'bruta'));
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
      ]);
      toast('Configurações salvas', 'success');
    } catch (err) {
      console.error('Erro ao salvar configurações', err);
      toast('Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (enabledModules.length === 0) {
    return <div className="p-6">Nenhum módulo habilitado para este tenant.</div>;
  }

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

      {loading ? (
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
