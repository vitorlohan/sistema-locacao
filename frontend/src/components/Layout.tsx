import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FiHome, FiUsers, FiBox, FiFileText,
  FiDollarSign, FiBarChart2, FiDatabase, FiLogOut, FiMenu, FiX,
} from 'react-icons/fi';

const NAV = [
  { to: '/', icon: FiHome, label: 'Dashboard' },
  { to: '/clientes', icon: FiUsers, label: 'Clientes' },
  { to: '/itens', icon: FiBox, label: 'Itens' },
  { to: '/alugueis', icon: FiFileText, label: 'Aluguéis' },
  { to: '/caixa', icon: FiDollarSign, label: 'Caixa' },
  { to: '/relatorios', icon: FiBarChart2, label: 'Relatórios' },
  { to: '/backups', icon: FiDatabase, label: 'Backups' },
];

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Clientes',
  '/itens': 'Itens',
  '/alugueis': 'Aluguéis',
  '/caixa': 'Caixa',
  '/relatorios': 'Relatórios',
  '/backups': 'Backups',
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const title = TITLES[location.pathname] ?? 'Sistema de Locação';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-header">
          <h1>📦 Locação</h1>
          <small>Sistema de Gestão</small>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <n.icon />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user?.name} ({user?.role})
          </div>
          <button className="sidebar-link" onClick={logout}>
            <FiLogOut /> Sair
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {open && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 99 }} onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="menu-toggle" onClick={() => setOpen(!open)}>
              {open ? <FiX /> : <FiMenu />}
            </button>
            <h2>{title}</h2>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
