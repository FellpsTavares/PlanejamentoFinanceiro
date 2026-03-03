import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../hooks/useSidebar.jsx';
import { authService } from '../services/auth';

export default function Sidebar() {
  const { open, toggle, close } = useSidebar();
  const location = useLocation();
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [expanded, setExpanded] = useState({
    initial: true,
    investments: false,
    transport: false,
    settings: false,
  });

  const toggleSection = (section) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    const path = location.pathname;
    setExpanded((prev) => ({
      ...prev,
      initial: prev.initial || path.startsWith('/dashboard') || path.startsWith('/transactions'),
      investments: prev.investments || path.startsWith('/investments'),
      transport: prev.transport || path.startsWith('/transport'),
      settings: prev.settings || path.startsWith('/settings') || path.startsWith('/admin/tenants'),
    }));
  }, [location.pathname]);

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
    <>
      <button
        onClick={toggle}
        className={`fixed top-4 z-50 p-2 bg-white rounded shadow transition-all ${open ? 'left-72' : 'left-4'}`}
        aria-label="Abrir menu"
      >
        ☰
      </button>

      {open && <div className="fixed inset-0 bg-black/20 z-30" onClick={close} />}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">FinManager</h2>
        </div>
        <nav className="p-4 flex flex-col gap-2">
          <button type="button" onClick={() => toggleSection('initial')} className="w-full p-2 hover:bg-gray-100 rounded flex items-center justify-between text-left font-semibold">
            <span>INICIAL</span>
            <span>{expanded.initial ? '˅' : '>'}</span>
          </button>
          {expanded.initial && (
            <div className="pl-2 flex flex-col gap-1">
              <Link to="/dashboard" onClick={close} className="p-2 hover:bg-gray-100 rounded">Dashboard</Link>
              <Link to="/transactions" onClick={close} className="p-2 hover:bg-gray-100 rounded">Transações</Link>
              <Link to="/transactions/new" onClick={close} className="p-2 hover:bg-gray-100 rounded">Nova Transação</Link>
            </div>
          )}

          {user?.tenant?.has_module_investments && (
            <>
              <button type="button" onClick={() => toggleSection('investments')} className="w-full p-2 hover:bg-gray-100 rounded flex items-center justify-between text-left font-semibold">
                <span>INVESTIMENTOS</span>
                <span>{expanded.investments ? '˅' : '>'}</span>
              </button>
              {expanded.investments && (
                <div className="pl-2 flex flex-col gap-1">
                  <Link to="/investments/dashboard" onClick={close} className="p-2 hover:bg-gray-100 rounded">Dashboard</Link>
                  <Link to="/investments" onClick={close} className="p-2 hover:bg-gray-100 rounded">Ativos</Link>
                </div>
              )}
            </>
          )}

          {user?.tenant?.has_module_transport && (
            <>
              <button type="button" onClick={() => toggleSection('transport')} className="w-full p-2 hover:bg-gray-100 rounded flex items-center justify-between text-left font-semibold">
                <span>TRANSPORTADORA</span>
                <span>{expanded.transport ? '˅' : '>'}</span>
              </button>
              {expanded.transport && (
                <div className="pl-2 flex flex-col gap-1">
                  <Link to="/transport/dashboard" onClick={close} className="p-2 hover:bg-gray-100 rounded">Dashboard</Link>
                  <Link to="/transport/vehicles" onClick={close} className="p-2 hover:bg-gray-100 rounded">Veículos</Link>
                  <Link to="/transport/trips/new" onClick={close} className="p-2 hover:bg-gray-100 rounded">Nova Viagem</Link>
                </div>
              )}
            </>
          )}

          <button type="button" onClick={() => toggleSection('settings')} className="w-full p-2 hover:bg-gray-100 rounded flex items-center justify-between text-left font-semibold">
            <span>CONFIGURAÇÕES</span>
            <span>{expanded.settings ? '˅' : '>'}</span>
          </button>
          {expanded.settings && (
            <div className="pl-2 flex flex-col gap-1">
              <Link to="/settings/modules" onClick={close} className="p-2 hover:bg-gray-100 rounded">Configurações</Link>
              {user?.is_platform_admin && (
                <Link to="/admin/tenants" onClick={close} className="p-2 hover:bg-gray-100 rounded">Admin Tenants</Link>
              )}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
