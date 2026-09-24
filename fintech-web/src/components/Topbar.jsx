import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';

const FinanceIcon = (props) => (
  <svg className={props.className || 'h-5 w-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path strokeLinecap="round" d="M2.5 9.5h19" />
    <path strokeLinecap="round" d="M6 14.5h4" />
  </svg>
);

const TransportIcon = (props) => (
  <svg className={props.className || 'h-5 w-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 7.5h11v9h-11z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5h4l3 3v3h-7z" />
    <circle cx="6.5" cy="17.5" r="1.7" />
    <circle cx="17" cy="17.5" r="1.7" />
  </svg>
);

const InvestmentsIcon = (props) => (
  <svg className={props.className || 'h-5 w-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 18l6-6 4 4 8-8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 8h6v6" />
  </svg>
);

const SettingsIcon = (props) => (
  <svg className={props.className || 'h-5 w-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const MODULE_ICONS = {
  initial: FinanceIcon,
  transport: TransportIcon,
  investments: InvestmentsIcon,
  settings: SettingsIcon,
};

export default function Topbar() {
  const location = useLocation();
  const [user, setUser] = useState(() => authService.getCurrentUser());

  useEffect(() => {
    const onChange = () => setUser(authService.getCurrentUser());
    window.addEventListener('auth:userChanged', onChange);
    const onStorage = (e) => {
      if (e.key === 'user' || e.key === 'access_token') onChange();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:userChanged', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const modules = useMemo(() => {
    const list = [
      {
        key: 'initial',
        label: 'Finanças',
        active: location.pathname.startsWith('/painel') || location.pathname.startsWith('/transacoes'),
        items: [
          { to: '/painel', label: 'Painel' },
          { to: '/transacoes', label: 'Transações' },
          { to: '/transacoes/nova', label: 'Nova Transação' },
        ],
      },
    ];

    if (user?.tenant?.has_module_investments) {
      list.push({
        key: 'investments',
        label: 'Investimentos',
        active: location.pathname.startsWith('/investimentos'),
        items: [
          { to: '/investimentos/painel', label: 'Painel' },
          { to: '/investimentos', label: 'Ativos' },
          { to: '/investimentos/indicados', label: 'Ativos Indicados' },
        ],
      });
    }

    if (user?.tenant?.has_module_transport) {
      list.push({
        key: 'transport',
        label: 'Transportadora',
        active: location.pathname.startsWith('/transportadora'),
        items: [
          { to: '/transportadora/painel', label: 'Painel' },
          { to: '/transportadora/viagens', label: 'Gerenciar Viagens' },
          { to: '/transportadora/veiculos', label: 'Veículos' },
          { to: '/transportadora/motoristas', label: 'Motoristas' },
          { to: '/transportadora/manutencao', label: 'Manutenção' },
          { to: '/transportadora/abastecimento', label: 'Abastecimento' },
        ],
      });
    }

    const settingsItems = [{ to: '/configuracoes', label: 'Configurações' }];
    if (user?.is_superuser) {
      settingsItems.push({ to: '/admin/usuarios', label: 'Gerenciar Usuários' });
    }

    list.push({
      key: 'settings',
      label: 'Configurações',
      active: location.pathname.startsWith('/configuracoes') || location.pathname.startsWith('/admin/usuarios'),
      items: settingsItems,
    });

    return list;
  }, [location.pathname, user]);

  const activeModule = modules.find((module) => module.active);

  const initials = useMemo(() => {
    const first = user?.first_name?.trim()?.[0] || '';
    const last = user?.last_name?.trim()?.[0] || '';
    const combined = `${first}${last}`.toUpperCase();
    return combined || (user?.email?.[0] || '?').toUpperCase();
  }, [user]);

  return (
    <div className="fixed top-0 left-0 right-0 z-40">
      <div className="h-[60px] bg-[#0f172a] flex items-center gap-1 px-4">
        <Link to="/inicio" className="flex items-center gap-2 mr-4 shrink-0">
          <img src="/logo/LogoEloFinancas.png" alt="Elo Financeiro" className="h-8 w-8 rounded-md object-contain" />
          <span className="hidden sm:inline text-white font-semibold tracking-wide whitespace-nowrap">Elo Financeiro</span>
        </Link>

        <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          {modules.map((module) => {
            const Icon = MODULE_ICONS[module.key];
            return (
              <Link
                key={module.key}
                to={module.items[0]?.to || '/inicio'}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  module.active ? 'bg-[#1e293b] text-white' : 'text-slate-300 hover:text-white hover:bg-[#1e293b]/60'
                }`}
              >
                {Icon && <Icon />}
                {module.label}
              </Link>
            );
          })}
        </nav>

        <div
          className="ml-2 h-9 w-9 shrink-0 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-semibold"
          title={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email}
        >
          {initials}
        </div>
      </div>

      <div className="h-[46px] bg-white border-b border-gray-200 flex items-center gap-2 px-4 overflow-x-auto">
        {(activeModule?.items || []).map((item) => {
          const itemActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                itemActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
