import { useState, useEffect, useCallback } from 'react';
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
import api from './services/api';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const [licenseOk, setLicenseOk] = useState<boolean | null>(null); // null = checking

  const checkLicense = useCallback(async () => {
    try {
      const { data } = await api.get('/license/status');
      setLicenseOk(!!data.licensed);
    } catch {
      // If we can't reach the backend yet, retry after 1s
      setTimeout(() => checkLicense(), 1000);
    }
  }, []);

  useEffect(() => {
    checkLicense();
  }, [checkLicense]);

  // While checking license, show loading
  if (licenseOk === null) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <p style={{ marginTop: 16, color: '#94a3b8', fontSize: '0.9rem' }}>
          Verificando licença...
        </p>
      </div>
    );
  }

  // Not licensed → only show activation page
  if (!licenseOk) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <LicenseActivationPage
              onActivated={() => setLicenseOk(true)}
            />
          }
        />
      </Routes>
    );
  }

  // Licensed → normal routing (login → dashboard)
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/ativar" element={<LicenseActivationPage onActivated={() => {}} />} />
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
