import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    navigate(-1);
  };

  const handleHome = () => {
    navigate('/home');
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const titleByPath = () => {
    if (location.pathname.startsWith('/transport')) return 'Transportadora';
    if (location.pathname.startsWith('/investments')) return 'Investimentos';
    if (location.pathname.startsWith('/home')) return 'Home';
    if (location.pathname.startsWith('/transactions/new')) return 'Nova Transação';
    if (location.pathname.startsWith('/transactions')) return 'Transações';
    if (location.pathname.startsWith('/settings')) return 'Configurações';
    if (location.pathname.startsWith('/admin')) return 'Administração';
    return 'Kaptal Pro';
  };

  return (
    <header className="px-4 pt-3">
      <div className="w-full bg-white/95 backdrop-blur rounded-2xl shadow-md border border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleHome}
            className="h-9 w-9 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition inline-flex items-center justify-center"
            aria-label="Home"
            title="Home"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5.5 9.5V21h13V9.5" />
              <path d="M9.5 21v-6h5v6" />
            </svg>
          </button>
          <button type="button" onClick={handleBack} className="btn btn-sm btn-secondary">← Voltar</button>
        </div>

        <div className="hidden md:block text-sm font-semibold text-gray-700">{titleByPath()}</div>

        <div>
          <button type="button" onClick={handleLogout} className="btn btn-sm btn-danger">Sair</button>
        </div>
      </div>
    </header>
  );
}
