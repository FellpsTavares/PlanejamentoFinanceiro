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
        label: 'Inicial',
        icon: '⌂',
        active: location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/transactions'),
        items: [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/transactions', label: 'Transações' },
          { to: '/transactions/new', label: 'Nova Transação' },
        ],
      },
    ];

    if (user?.tenant?.has_module_investments) {
      list.push({
        key: 'investments',
        label: 'Investimentos',
        icon: '↗',
        active: location.pathname.startsWith('/investments'),
        items: [
          { to: '/investments/dashboard', label: 'Dashboard' },
          { to: '/investments', label: 'Ativos' },
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
          { to: '/transport/dashboard', label: 'Dashboard' },
          { to: '/transport/trips', label: 'Gerenciar Viagens' },
          { to: '/transport/vehicles', label: 'Veículos' },
          { to: '/transport/trips/new', label: 'Nova Viagem' },
        ],
      });
    }

    const settingsItems = [{ to: '/settings/modules', label: 'Configurações' }];
    if (user?.is_platform_admin) {
      settingsItems.push({ to: '/admin/tenants', label: 'Admin Tenants' });
    }

    list.push({
      key: 'settings',
      label: 'Configurações',
      icon: '⚙',
      active: location.pathname.startsWith('/settings') || location.pathname.startsWith('/admin/tenants'),
      items: settingsItems,
    });

    return list;
  }, [location.pathname, user]);

  const isExpanded = hovered;

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
      className={`fixed top-0 left-0 h-full z-40 border-r border-slate-800/80 bg-slate-950 text-slate-100 transition-all duration-200 ${isExpanded ? 'w-72' : 'w-16'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="h-full overflow-y-auto px-2 py-3">
        <div className={`mb-4 flex items-center ${isExpanded ? 'justify-start px-2' : 'justify-center'}`}>
          <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold">K</div>
          {isExpanded && <span className="ml-2 font-semibold tracking-wide">Kaptal</span>}
        </div>

        <nav className="space-y-2">
          {modules.map((module) => (
            <div key={module.key} className={`rounded-xl ${module.active ? 'bg-slate-900 border border-slate-700' : 'border border-transparent'}`}>
              <div className={`flex items-center ${isExpanded ? 'px-3 py-2' : 'justify-center py-2'}`} title={module.label}>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-sm">{module.icon}</span>
                {isExpanded && (
                  <div className="ml-3 min-w-0">
                    <p className="text-sm font-semibold leading-5">{module.label}</p>
                  </div>
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
                        className={`rounded-md px-2 py-1.5 text-sm transition-colors ${itemActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
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
