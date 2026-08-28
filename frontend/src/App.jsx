import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initNotifications } from './services/notificationService'
import Login from './pages/Login'
import DriverDashboard from './pages/DriverDashboard'
import DriverRegrasPagamento from './pages/DriverRegrasPagamento'
import MeusDados from './pages/MeusDados'
import AdminPagamentos from './pages/AdminPagamentos'
import AdminSswUpload from './pages/AdminSswUpload'
import AdminMotoristas from './pages/AdminMotoristas'
import AdminAjudantes from './pages/AdminAjudantes'
import AdminSolicitacoesPagamento from './pages/AdminSolicitacoesPagamento'
import AdminConfiguracoes from './pages/AdminConfiguracoes'
import AdminTaxasAdiantamento from './pages/AdminTaxasAdiantamento'
import AdminSswPrecos from './pages/AdminSswPrecos'
import AdminCidadesSemPreco from './pages/AdminCidadesSemPreco'
import AdminDashboard from './pages/AdminDashboard'
import AdminPagadores from './pages/AdminPagadores'
import AdminUnidades from './pages/AdminUnidades'
import AdminGestao from './pages/AdminGestao'
import AdminOcorrencias from './pages/AdminOcorrencias'

const spinKeyframes = `@keyframes spin { to { transform: rotate(360deg); } }`;
const loadingStyle = {
  minHeight: '100vh', background: '#0d0f14', display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#6b7280',
  fontFamily: "'IBM Plex Mono', monospace",
};
const spinnerStyle = {
  width: 36, height: 36, border: '3px solid #2a2f3e', borderTopColor: '#f0c040',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};

function ProtectedRoute({ children }) {
  const [valid, setValid] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setValid(false); return; }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => {
        localStorage.setItem('user', JSON.stringify(d.user));
        setValid(true);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setValid(false);
      })
      .finally(() => clearTimeout(timer));

    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  if (valid === null) {
    return (
      <div style={loadingStyle}>
        <style>{spinKeyframes}</style>
        <div style={spinnerStyle}></div>
        <span>CARREGANDO...</span>
      </div>
    );
  }
  if (!valid) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ children, allowedRoles }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'admin';
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/admin/operacional" replace />;
  }
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function App() {
  useEffect(() => {
    initNotifications().catch(err => console.error('Erro ao inicializar notificações:', err));
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/driver" element={<ProtectedRoute><DriverDashboard /></ProtectedRoute>} />
      <Route path="/driver/regras-pagamento" element={<ProtectedRoute><DriverRegrasPagamento /></ProtectedRoute>} />
      <Route path="/driver/meus-dados" element={<ProtectedRoute><MeusDados /></ProtectedRoute>} />
      <Route path="/admin/pagamentos" element={<RoleRoute allowedRoles={['admin']}><AdminPagamentos /></RoleRoute>} />
      <Route path="/admin/upload" element={<RoleRoute allowedRoles={['admin', 'operador']}><AdminSswUpload /></RoleRoute>} />
      <Route path="/admin/motoristas" element={<RoleRoute allowedRoles={['admin']}><AdminMotoristas /></RoleRoute>} />
      <Route path="/admin/ajudantes" element={<RoleRoute allowedRoles={['admin']}><AdminAjudantes /></RoleRoute>} />
      <Route path="/admin/solicitacoes-pagamento" element={<RoleRoute allowedRoles={['admin']}><AdminSolicitacoesPagamento /></RoleRoute>} />
      <Route path="/admin/configuracoes" element={<RoleRoute allowedRoles={['admin']}><AdminConfiguracoes /></RoleRoute>} />
      <Route path="/admin/taxas-adiantamento" element={<RoleRoute allowedRoles={['admin']}><AdminTaxasAdiantamento /></RoleRoute>} />
      <Route path="/admin/precos-cidades" element={<RoleRoute allowedRoles={['admin']}><AdminSswPrecos /></RoleRoute>} />
      <Route path="/admin/cidades-sem-preco" element={<RoleRoute allowedRoles={['admin']}><AdminCidadesSemPreco /></RoleRoute>} />
      <Route path="/admin/pagadores" element={<RoleRoute allowedRoles={['admin']}><AdminPagadores /></RoleRoute>} />
      <Route path="/admin/unidades" element={<RoleRoute allowedRoles={['admin']}><AdminUnidades /></RoleRoute>} />
      <Route path="/admin/ocorrencias" element={<RoleRoute allowedRoles={['admin', 'operador']}><AdminOcorrencias /></RoleRoute>} />
      <Route path="/admin/gestao" element={<RoleRoute allowedRoles={['admin', 'operador', 'consulta']}><AdminGestao /></RoleRoute>} />
      <Route path="/admin/operacional" element={<RoleRoute allowedRoles={['admin', 'operador', 'consulta']}><AdminDashboard /></RoleRoute>} />
      <Route path="/admin/dashboard" element={<RoleRoute allowedRoles={['admin', 'operador', 'consulta']}><AdminDashboard /></RoleRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
