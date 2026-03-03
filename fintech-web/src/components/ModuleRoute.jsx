import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function ModuleRoute({ children, moduleFlag }) {
  const user = authService.getCurrentUser();
  const hasModule = user?.tenant?.[moduleFlag];
  if (!hasModule) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
