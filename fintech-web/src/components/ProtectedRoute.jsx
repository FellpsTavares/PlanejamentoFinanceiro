import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { SidebarProvider } from '../hooks/useSidebar.jsx';
import Sidebar from './Sidebar';

export default function ProtectedRoute({ children }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <Sidebar />
      <div className="pl-16">{children}</div>
    </SidebarProvider>
  );
}
