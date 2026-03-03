import { Navigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function PlatformAdminRoute({ children }) {
  const user = authService.getCurrentUser();

  if (!user?.is_platform_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
