import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';

export default function Sidebar() {
  const location = useLocation();
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [hovered, setHovered] = useState(false);

  const modules = useMemo(() => {
    const list = [
      {
        key: 'initial',
        label: 'Finanças',
        icon: '💳',
        active: location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/transactions'),
        items: [
          { to: '/dashboard', label: 'Painel' },
          { to: '/transactions', label: 'Transações' },
          { to: '/transactions/new', label: 'Nova Transação' },
        ],
      },
    ];

    if (user?.tenant?.has_module_investments) {
      list.push({
        key: 'investments',
        label: 'Investimentos',
        icon: '📈',
        active: location.pathname.startsWith('/investments'),
        items: [
          { to: '/investments/dashboard', label: 'Painel' },
          { to: '/investments', label: 'Ativos' },
          { to: '/investments/recommendations', label: 'Ativos Indicados' },
        ],
      });
    }

    if (user?.tenant?.has_module_transport) {
      list.push({
        key: 'transport',
        label: 'Transportadora',
        icon: '🚚',
        active: location.pathname.startsWith('/transport'),
        items: [
          { to: '/transport/dashboard', label: 'Painel' },
          { to: '/transport/trips', label: 'Gerenciar Viagens' },
          { to: '/transport/vehicles', label: 'Veículos' },
          { to: '/transport/trips/new', label: 'Nova Viagem' },
        ],
      });
    }

    const settingsItems = [{ to: '/settings/modules', label: 'Configurações' }];
    // Removido item "Admin Tenants" — funcionalidade removida para manter código limpo
    if (user?.is_superuser) {
      settingsItems.push({ to: '/admin/user-management', label: 'Gerenciar Usuários' });
    }

    list.push({
      key: 'settings',
      label: 'Configurações',
      icon: '⚙',
      active: location.pathname.startsWith('/settings') || location.pathname.startsWith('/admin/user-management'),
      items: settingsItems,
    });

    return list;
  }, [location.pathname, user]);

  const isExpanded = hovered;

  const moduleContainerClass = (active) =>
    `relative rounded-xl transition-colors ${active ? 'bg-slate-100 border border-slate-200' : 'border border-transparent hover:border-slate-200 hover:bg-slate-50'}`;

  useEffect(() => {
    const onChange = () => setUser(authService.getCurrentUser());
    window.addEventListener('auth:userChanged', onChange);
    // também escutar storage para mudanças vindas de outra aba
    const onStorage = (e) => {
      if (e.key === 'user' || e.key === 'access_token') onChange();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:userChanged', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <aside
      className={`fixed top-0 left-0 h-full z-40 border-r border-slate-200 bg-white text-slate-900 transition-all duration-200 ${isExpanded ? 'w-72' : 'w-16'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="h-full overflow-y-auto px-2 py-3">
        <div className={`mb-4 flex items-center ${isExpanded ? 'justify-start px-2 gap-2' : 'justify-center'}`}>
          <img src="/logo/LogoEloFinancas.png" alt="Elo Financeiro" className="h-10 w-10 rounded-md object-contain shrink-0" />
          {isExpanded && <span className="font-semibold tracking-wide whitespace-nowrap">Elo Financeiro</span>}
        </div>

        <nav className="space-y-2">
          {modules.map((module) => (
            <div key={module.key} className={moduleContainerClass(module.active)}>
              <div
                className={`group flex items-center ${isExpanded ? 'px-3 py-2' : 'justify-center px-2 py-2.5'}`}
                title={isExpanded ? module.label : undefined}
              >
                <span
                  className={`inline-flex items-center justify-center rounded-lg ${isExpanded ? 'h-7 w-7 bg-slate-100 text-sm' : 'h-9 w-9 bg-slate-100 text-base'}`}
                  aria-hidden="true"
                >
                  {module.icon}
                </span>
                {isExpanded && (
                  <div className="ml-3 min-w-0">
                    <p className="text-sm font-semibold leading-5">{module.label}</p>
                  </div>
                )}

                {!isExpanded && (
                  <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-within:translate-x-0.5 group-focus-within:opacity-100">
                    {module.label}
                  </span>
                )}
              </div>

              {isExpanded && (
                <div className="pb-2 pl-12 pr-2 flex flex-col gap-1">
                  {module.items.map((item) => {
                    const itemActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`rounded-md px-2 py-1.5 text-sm transition-colors ${itemActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
