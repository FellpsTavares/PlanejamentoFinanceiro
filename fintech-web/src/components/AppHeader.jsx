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
    return 'Elo Financeiro';
  };

  return (
    <header className="px-4 pt-3">
      <div className="w-full bg-white/95 backdrop-blur rounded-2xl shadow-md border border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleHome}
            className="h-11 w-11 rounded-xl bg-white shadow-sm hover:shadow-md active:scale-[0.98] transition inline-flex items-center justify-center border border-gray-200"
            aria-label="Home"
            title="Home"
          >
            <img src="/logo/LogoHome.png" alt="Home" className="h-8 w-8 object-contain" />
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
