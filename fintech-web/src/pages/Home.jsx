import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { reportsService } from '../services/reports';
import { transportService } from '../services/transport';
import { investmentsMarketService } from '../services/investmentsMarket';
import { toast } from '../utils/toast';

const REPORT_CONFIGS = {
  initial: {
    title: 'Finanças',
    fields: [
      { key: 'transaction_date', label: 'Data' },
      { key: 'description', label: 'Descrição' },
      { key: 'category', label: 'Categoria' },
      { key: 'type', label: 'Tipo' },
      { key: 'amount', label: 'Valor' },
      { key: 'status', label: 'Status' },
    ],
    orderBy: [
      { key: 'transaction_date', label: 'Data da transação' },
      { key: 'amount', label: 'Valor' },
      { key: 'created_at', label: 'Data de criação' },
      { key: 'status', label: 'Status' },
      { key: 'type', label: 'Tipo' },
    ],
    defaultFields: ['transaction_date', 'description', 'category', 'type', 'amount', 'status'],
    defaultOrderBy: 'transaction_date',
  },
  transport: {
    title: 'Transportadora',
    fields: [
      { key: 'vehicle', label: 'Veículo' },
      { key: 'start_date', label: 'Início' },
      { key: 'end_date', label: 'Fim' },
      { key: 'progress_type', label: 'Andamento' },
      { key: 'status', label: 'Status' },
      { key: 'total_value', label: 'Receita' },
      { key: 'expense_value', label: 'Despesa' },
      { key: 'net_value', label: 'Líquido' },
      { key: 'is_received', label: 'Recebida' },
    ],
    orderBy: [
      { key: 'start_date', label: 'Data de início' },
      { key: 'end_date', label: 'Data de fim' },
      { key: 'status', label: 'Status' },
      { key: 'total_value', label: 'Receita' },
      { key: 'expense_value', label: 'Despesa' },
    ],
    defaultFields: ['vehicle', 'start_date', 'end_date', 'progress_type', 'status', 'net_value'],
    defaultOrderBy: 'start_date',
  },
  investments: {
    title: 'Investimentos',
    fields: [
      { key: 'ticker', label: 'Ticker' },
      { key: 'quantity', label: 'Quantidade' },
      { key: 'buy_price', label: 'Preço compra' },
      { key: 'current_price', label: 'Preço atual' },
      { key: 'pnl', label: 'PnL' },
      { key: 'buy_date', label: 'Data compra' },
    ],
    orderBy: [
      { key: 'buy_date', label: 'Data de compra' },
      { key: 'ticker', label: 'Ticker' },
      { key: 'buy_price', label: 'Preço compra' },
      { key: 'quantity', label: 'Quantidade' },
    ],
    defaultFields: ['ticker', 'quantity', 'buy_price', 'current_price', 'pnl', 'buy_date'],
    defaultOrderBy: 'buy_date',
  },
};

export default function Home() {
  const user = useMemo(() => authService.getCurrentUser(), []);
  const [transportVehicles, setTransportVehicles] = useState([]);
  const [activeReportModule, setActiveReportModule] = useState(null);
  const [financeFilters, setFinanceFilters] = useState({ start_date: '', end_date: '' });
  const [transportFilters, setTransportFilters] = useState({ start_date: '', end_date: '', vehicle_id: '', status: '' });
  const [investmentsFilters, setInvestmentsFilters] = useState({ start_date: '', end_date: '', ticker: '' });
  const [selectedFields, setSelectedFields] = useState({
    initial: REPORT_CONFIGS.initial.defaultFields,
    transport: REPORT_CONFIGS.transport.defaultFields,
    investments: REPORT_CONFIGS.investments.defaultFields,
  });
  const [ordering, setOrdering] = useState({
    initial: { order_by: REPORT_CONFIGS.initial.defaultOrderBy, order_dir: 'desc' },
    transport: { order_by: REPORT_CONFIGS.transport.defaultOrderBy, order_dir: 'desc' },
    investments: { order_by: REPORT_CONFIGS.investments.defaultOrderBy, order_dir: 'desc' },
  });

  useEffect(() => {
    const loadVehicles = async () => {
      if (!user?.tenant?.has_module_transport) return;
      try {
        const data = await transportService.getVehicles();
        setTransportVehicles(data?.results || data || []);
      } catch (err) {
        console.error('Erro ao carregar veículos para filtro de relatório', err);
      }
    };
    loadVehicles();
  }, [user]);

  useEffect(() => {
    const warmInvestments = async () => {
      if (!user?.tenant?.has_module_investments) return;
      try {
        await investmentsMarketService.warmForCurrentPortfolio();
      } catch (err) {
        // warming de cache nao deve quebrar a home
      }
    };
    warmInvestments();
  }, [user]);

  const handleOpenReports = (moduleKey) => {
    setActiveReportModule(moduleKey);
  };

  const toggleField = (moduleKey, fieldKey) => {
    setSelectedFields((prev) => {
      const current = prev[moduleKey] || [];
      if (current.includes(fieldKey)) {
        if (current.length === 1) return prev;
        return { ...prev, [moduleKey]: current.filter((item) => item !== fieldKey) };
      }
      return { ...prev, [moduleKey]: [...current, fieldKey] };
    });
  };

  const handleDownloadPdf = async () => {
    if (!activeReportModule) return;

    try {
      const params = {
        fields: (selectedFields[activeReportModule] || []).join(','),
        order_by: ordering[activeReportModule]?.order_by,
        order_dir: ordering[activeReportModule]?.order_dir,
      };

      if (activeReportModule === 'initial') {
        await reportsService.downloadFinancePdf({ ...financeFilters, ...params });
      }
      if (activeReportModule === 'transport') {
        await reportsService.downloadTransportPdf({ ...transportFilters, ...params });
      }
      if (activeReportModule === 'investments') {
        await reportsService.downloadInvestmentsPdf({ ...investmentsFilters, ...params });
      }

      toast('PDF gerado com sucesso', 'success');
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      toast('Erro ao gerar PDF deste módulo', 'error');
    }
  };

  const modules = [
    {
      key: 'initial',
      title: 'Finanças',
      description: 'Acesse transações e visão financeira principal.',
      links: [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/transactions', label: 'Transações' },
        { to: '/transactions/new', label: 'Nova Transação' },
      ],
      enabled: true,
    },
    {
      key: 'transport',
      title: 'Transportadora',
      description: 'Gerencie veículos e viagens em andamento.',
      links: [
        { to: '/transport/dashboard', label: 'Dashboard' },
        { to: '/transport/trips', label: 'Gerenciar Viagens' },
        { to: '/transport/vehicles', label: 'Veículos' },
      ],
      enabled: Boolean(user?.tenant?.has_module_transport),
    },
    {
      key: 'investments',
      title: 'Investimentos',
      description: 'Acompanhe carteira e indicadores de ativos.',
      links: [
        { to: '/investments/dashboard', label: 'Dashboard' },
        { to: '/investments', label: 'Ativos' },
      ],
      enabled: Boolean(user?.tenant?.has_module_investments),
    },
    {
      key: 'settings',
      title: 'Configurações',
      description: 'Ajuste parâmetros gerais e por módulo.',
      links: [
        { to: '/settings/modules', label: 'Configurações' },
      ],
      enabled: true,
    },
  ];

  const visibleModules = modules.filter((module) => module.enabled);
  const activeConfig = activeReportModule ? REPORT_CONFIGS[activeReportModule] : null;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Home</h1>
      <p className="text-gray-600 mb-6">Escolha um módulo para continuar.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleModules.map((module) => (
          <section key={module.title} className="card border rounded p-5 bg-white">
            <h2 className="text-xl font-semibold text-gray-900">{module.title}</h2>
            <p className="text-sm text-gray-600 mt-1 mb-4">{module.description}</p>

            <div className="flex flex-wrap gap-2">
              {module.links.map((item) => (
                <Link key={item.to} to={item.to} className="btn btn-secondary btn-sm">
                  {item.label}
                </Link>
              ))}
              {['initial', 'transport', 'investments'].includes(module.key) && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleOpenReports(module.key)}>
                  Relatórios
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      {activeConfig && (
        <section className="card border rounded p-5 mt-6 bg-white">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Relatórios • {activeConfig.title}</h3>
              <p className="text-sm text-gray-600">Escolha filtros, variáveis e ordenação antes de gerar o PDF.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveReportModule(null)}>
              Fechar
            </button>
          </div>

          {activeReportModule === 'initial' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Data inicial</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={financeFilters.start_date}
                  onChange={(e) => setFinanceFilters((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Data final</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={financeFilters.end_date}
                  onChange={(e) => setFinanceFilters((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
          )}

          {activeReportModule === 'transport' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Data inicial</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={transportFilters.start_date}
                  onChange={(e) => setTransportFilters((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Data final</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={transportFilters.end_date}
                  onChange={(e) => setTransportFilters((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Veículo</label>
                <select
                  className="input-field w-full"
                  value={transportFilters.vehicle_id}
                  onChange={(e) => setTransportFilters((prev) => ({ ...prev, vehicle_id: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {transportVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} — {vehicle.model}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Status da viagem</label>
                <select
                  className="input-field w-full"
                  value={transportFilters.status}
                  onChange={(e) => setTransportFilters((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="in_progress">Em curso</option>
                  <option value="completed">Encerrada</option>
                </select>
              </div>
            </div>
          )}

          {activeReportModule === 'investments' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Data inicial</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={investmentsFilters.start_date}
                  onChange={(e) => setInvestmentsFilters((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Data final</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={investmentsFilters.end_date}
                  onChange={(e) => setInvestmentsFilters((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Ticker</label>
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="Ex: PETR4"
                  value={investmentsFilters.ticker}
                  onChange={(e) => setInvestmentsFilters((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-800 mb-2">Variáveis do relatório</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {activeConfig.fields.map((field) => (
                <label key={field.key} className="inline-flex items-center gap-2 text-sm text-gray-700 border rounded px-3 py-2">
                  <input
                    type="checkbox"
                    checked={(selectedFields[activeReportModule] || []).includes(field.key)}
                    onChange={() => toggleField(activeReportModule, field.key)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Ordenar por</label>
              <select
                className="input-field w-full"
                value={ordering[activeReportModule]?.order_by || ''}
                onChange={(e) => setOrdering((prev) => ({
                  ...prev,
                  [activeReportModule]: {
                    ...prev[activeReportModule],
                    order_by: e.target.value,
                  },
                }))}
              >
                {activeConfig.orderBy.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Direção</label>
              <select
                className="input-field w-full"
                value={ordering[activeReportModule]?.order_dir || 'desc'}
                onChange={(e) => setOrdering((prev) => ({
                  ...prev,
                  [activeReportModule]: {
                    ...prev[activeReportModule],
                    order_dir: e.target.value,
                  },
                }))}
              >
                <option value="desc">Decrescente</option>
                <option value="asc">Crescente</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadPdf}>
              Gerar PDF
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
