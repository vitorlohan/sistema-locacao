import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import LicenseActivationPage from './pages/LicenseActivationPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ItemsPage from './pages/ItemsPage';
import RentalsPage from './pages/RentalsPage';
import CashierPage from './pages/CashierPage';
import ReportsPage from './pages/ReportsPage';
import BackupPage from './pages/BackupPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/ativar" element={<LicenseActivationPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/clientes" element={<ClientsPage />} />
                <Route path="/itens" element={<ItemsPage />} />
                <Route path="/alugueis" element={<RentalsPage />} />
                <Route path="/caixa" element={<CashierPage />} />
                <Route path="/relatorios" element={<ReportsPage />} />
                <Route path="/backups" element={<BackupPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
