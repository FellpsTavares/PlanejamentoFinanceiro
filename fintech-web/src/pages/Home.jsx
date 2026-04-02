import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { transportService } from '../services/transport';
import { investmentsMarketService } from '../services/investmentsMarket';

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
  },
};

export default function Home() {
  const user = useMemo(() => authService.getCurrentUser(), []);
  const [transportVehicles, setTransportVehicles] = useState([]);

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

  const modules = [
    {
      key: 'initial',
      title: 'Finanças',
      description: 'Acesse transações e visão financeira principal.',
      links: [
        { to: '/dashboard', label: 'Painel' },
        { to: '/transactions', label: 'Transações' },
        { to: '/transactions/new', label: 'Nova Transação' },
      ],
      enabled: true,
    },
    {
      key: 'transport',
      title: 'Transportadora',
      description: 'Gerencie veículos, viagens e receitas.',
      links: [
        { to: '/transport/dashboard', label: 'Painel' },
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
        { to: '/investments/dashboard', label: 'Painel' },
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

  const visibleModules = modules.filter((m) => m.enabled);

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900">Olá — bem-vindo ao Painel</h1>
        <p className="text-gray-600 mt-2">Acesse os módulos abaixo ou gere relatórios rápidos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {visibleModules.map((module) => (
          <div key={module.key} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{module.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{module.description}</p>
              </div>
              <div className="text-sm text-gray-400">{module.key.toUpperCase()}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {module.links.map((link) => (
                <Link key={link.to} to={link.to} className="btn btn-secondary btn-sm">
                  {link.label}
                </Link>
              ))}
            </div>

            {['initial', 'transport', 'investments'].includes(module.key) && (
              <div className="mt-6 flex items-center justify-between">
                <Link to={`/reports?module=${module.key}`} className="btn btn-primary">
                  Ir para Relatórios
                </Link>
                <div className="text-sm text-gray-500">Variáveis disponíveis: {REPORT_CONFIGS[module.key].fields.length}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
