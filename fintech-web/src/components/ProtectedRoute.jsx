import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/auth';
import Sidebar from './Sidebar';
import AppHeader from './AppHeader';

export default function ProtectedRoute({ children }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
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
