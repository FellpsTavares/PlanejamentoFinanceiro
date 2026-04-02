import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import Sidebar from './Sidebar';
import AppHeader from './AppHeader';

export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Redireciona para troca de senha se exigido, exceto se já estiver nessa rota
  const user = authService.getCurrentUser();
  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <>
      <Sidebar />
      <div className="pl-16 min-h-screen bg-white">
        <AppHeader />
        <div className="pt-2">{children}</div>
      </div>
    </>
  );
}
