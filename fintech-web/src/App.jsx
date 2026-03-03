import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { authService } from './services/auth';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/ToastContainer';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import NewTransaction from './pages/NewTransaction';
import Investments from './pages/Investments';
import ModuleRoute from './components/ModuleRoute';
import TransportDashboard from './pages/TransportDashboard';
import TransportVehicles from './pages/TransportVehicles';
import TransportVehicleProfile from './pages/TransportVehicleProfile';
import TransportVehicleNew from './pages/TransportVehicleNew';
import TransportTripNew from './pages/TransportTripNew';

export default function App() {
  useEffect(() => {
    // Ao montar a app, se autenticado, buscar /users/me para sincronizar user
    if (authService.isAuthenticated()) {
      authService.getMe().catch(() => {});
    }
  }, []);
  return (
    <Router>
      <ToastContainer />
      <Routes>
        {/* Rota de Login */}
        <Route path="/login" element={<Login />} />

        {/* Rotas Protegidas */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/new"
          element={
            <ProtectedRoute>
              <NewTransaction />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investments"
          element={
            <ProtectedRoute>
              <Investments />
            </ProtectedRoute>
          }
        />

        {/* Transport module routes - protegido por flag do tenant */}
        <Route
          path="/transport/dashboard"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportDashboard />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transport/vehicles"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportVehicles />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transport/vehicles/new"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportVehicleNew />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transport/trips/new"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportTripNew />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transport/vehicles/:id"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportVehicleProfile />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />

        {/* Rota padrão */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
