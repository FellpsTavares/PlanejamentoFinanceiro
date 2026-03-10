import { Navigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function SuperUserRoute({ children }) {
  const user = authService.getCurrentUser();

  if (!user?.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
