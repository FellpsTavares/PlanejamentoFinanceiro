import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authService } from './services/auth';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/ToastContainer';
import ChatWidget from './components/ChatWidget';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import NewTransaction from './pages/NewTransaction';
import Investments from './pages/Investments';
import InvestmentsDashboard from './pages/InvestmentsDashboard';
import InvestmentsRecommendations from './pages/InvestmentsRecommendations';
import ModuleRoute from './components/ModuleRoute';
import PlatformAdminRoute from './components/PlatformAdminRoute';
import SuperUserRoute from './components/SuperUserRoute';
import TransportDashboard from './pages/TransportDashboard';
import TransportVehicles from './pages/TransportVehicles';
import TransportVehicleProfile from './pages/TransportVehicleProfile';
import TransportVehicleNew from './pages/TransportVehicleNew';
import TransportTripNew from './pages/TransportTripNew';
import TransportTrips from './pages/TransportTrips';
import TransportReports from './pages/TransportReports';
import TransportDrivers from './pages/TransportDrivers';
import TransportMaintenance from './pages/TransportMaintenance';
import TransportMaintenancePreventive from './pages/TransportMaintenancePreventive';
import TransportMaintenancePredictive from './pages/TransportMaintenancePredictive';
import TransportMaintenanceCorrective from './pages/TransportMaintenanceCorrective';
import TransportMaintenanceChecklist from './pages/TransportMaintenanceChecklist';
import TransportFuelRefills from './pages/TransportFuelRefills';
import ModuleSettings from './pages/ModuleSettings';
import AccountManagement from './pages/AccountManagement';
import AdminUserManagement from './pages/AdminUserManagement';
import ChangePassword from './pages/ChangePassword';
import Reports from './pages/Reports';
 

// Redireciona a antiga rota em inglês de perfil de veículo (com :id) para a nova
// rota em português, preservando o id do veículo.
function LegacyVehicleProfileRedirect() {
  const { id } = useParams();
  return <Navigate to={`/transportadora/veiculos/${id}`} replace />;
}

function ChatFloatingButton() {
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();
  const isAuthenticated = authService.isAuthenticated();
  const isLoginPage = location.pathname === '/login';
  const isChangePasswordPage = location.pathname === '/trocar-senha' || location.pathname === '/change-password';

  // Não mostrar botão na página de login ou troca de senha
  if (!isAuthenticated || isLoginPage || isChangePasswordPage) {
    return null;
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center text-2xl"
        title="Abrir Chat Assistente"
      >
        💬
      </button>

      {/* Widget de chat */}
      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}

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
      <ChatFloatingButton />
      <Routes>
        {/* Rota de Login */}
        <Route path="/login" element={<Login />} />

        {/* Rota de troca de senha forçada (sem sidebar) */}
        <Route path="/trocar-senha" element={<ChangePassword />} />

        {/* Rotas Protegidas */}
        <Route
          path="/inicio"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transacoes"
          element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transacoes/nova"
          element={
            <ProtectedRoute>
              <NewTransaction />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investimentos"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_investments">
                <Investments />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/investimentos/painel"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_investments">
                <InvestmentsDashboard />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/investimentos/indicados"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_investments">
                <InvestmentsRecommendations />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <ProtectedRoute>
              <SuperUserRoute>
                <AdminUserManagement />
              </SuperUserRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/relatorios"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute>
              <ModuleSettings />
            </ProtectedRoute>
          }
        />
        {/* Transport module routes - protegido por flag do tenant */}
        <Route
          path="/transportadora/painel"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportDashboard />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/veiculos"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportVehicles />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/veiculos/novo"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportVehicleNew />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/viagens"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportTrips />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/viagens/nova"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportTripNew />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/veiculos/:id"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportVehicleProfile />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/relatorios"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportReports />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/motoristas"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportDrivers />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/manutencao"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportMaintenance />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/manutencao/preventiva"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportMaintenancePreventive />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/manutencao/preditiva"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportMaintenancePredictive />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/manutencao/corretiva"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportMaintenanceCorrective />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/manutencao/checklist"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportMaintenanceChecklist />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transportadora/abastecimento"
          element={
            <ProtectedRoute>
              <ModuleRoute moduleFlag="has_module_transport">
                <TransportFuelRefills />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />

        {/* Rota padrão */}
        <Route path="/" element={<Navigate to="/inicio" replace />} />

        {/* Redirecionamentos das rotas antigas (em inglês) para as novas rotas em
            português, mantendo links/favoritos salvos anteriormente funcionando. */}
        <Route path="/home" element={<Navigate to="/inicio" replace />} />
        <Route path="/change-password" element={<Navigate to="/trocar-senha" replace />} />
        <Route path="/dashboard" element={<Navigate to="/painel" replace />} />
        <Route path="/transactions" element={<Navigate to="/transacoes" replace />} />
        <Route path="/transactions/new" element={<Navigate to="/transacoes/nova" replace />} />
        <Route path="/investments" element={<Navigate to="/investimentos" replace />} />
        <Route path="/investments/dashboard" element={<Navigate to="/investimentos/painel" replace />} />
        <Route path="/investments/recommendations" element={<Navigate to="/investimentos/indicados" replace />} />
        <Route path="/admin/user-management" element={<Navigate to="/admin/usuarios" replace />} />
        <Route path="/reports" element={<Navigate to="/relatorios" replace />} />
        <Route path="/settings/modules" element={<Navigate to="/configuracoes" replace />} />
        <Route path="/transport/dashboard" element={<Navigate to="/transportadora/painel" replace />} />
        <Route path="/transport/vehicles" element={<Navigate to="/transportadora/veiculos" replace />} />
        <Route path="/transport/vehicles/new" element={<Navigate to="/transportadora/veiculos/novo" replace />} />
        <Route path="/transport/vehicles/:id" element={<LegacyVehicleProfileRedirect />} />
        <Route path="/transport/trips" element={<Navigate to="/transportadora/viagens" replace />} />
        <Route path="/transport/trips/new" element={<Navigate to="/transportadora/viagens/nova" replace />} />
        <Route path="/transport/reports" element={<Navigate to="/transportadora/relatorios" replace />} />
        <Route path="/transport/drivers" element={<Navigate to="/transportadora/motoristas" replace />} />
        <Route path="/transport/maintenance" element={<Navigate to="/transportadora/manutencao" replace />} />
        <Route path="/transport/maintenance/preventive" element={<Navigate to="/transportadora/manutencao/preventiva" replace />} />
        <Route path="/transport/maintenance/predictive" element={<Navigate to="/transportadora/manutencao/preditiva" replace />} />
        <Route path="/transport/maintenance/corrective" element={<Navigate to="/transportadora/manutencao/corretiva" replace />} />
        <Route path="/transport/maintenance/checklist" element={<Navigate to="/transportadora/manutencao/checklist" replace />} />
        <Route path="/transport/fuel-refills" element={<Navigate to="/transportadora/abastecimento" replace />} />

        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </Router>
  );
}
