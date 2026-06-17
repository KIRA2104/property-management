import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthPage } from '@/pages/AuthPage';
import { PropertiesPage } from '@/pages/PropertiesPage';

import { TenantsPage } from '@/pages/TenantsPage';
import { AgreementsPage } from '@/pages/AgreementsPage';
import { PaymentsPage } from '@/pages/PaymentsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/properties" replace /> : <AuthPage />} />
      
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/properties" replace />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="agreements" element={<AgreementsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
